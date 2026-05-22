
"""
Production probabilistic pipeline for prediction markets.

This pipeline ingests both datasets:
- archive (US OHLCV files)
- archive (1) (NSE OHLCV files)

It performs:
1) inspection
2) cleaning
3) strict time split (70/15/15)
4) feature engineering (lag/rolling/momentum/volatility/sentiment proxies)
5) probabilistic model training
6) market-grade evaluation
7) Bayesian hyperparameter tuning (Optuna)
8) final model selection by log loss + calibration + stability
9) artifact export
10) risk controls (probability clipping, anomaly and drift metadata)
"""

from __future__ import annotations

import argparse
import json
import logging
import warnings
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import optuna
import pandas as pd
from matplotlib import pyplot as plt
from scipy import sparse
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from lightgbm import LGBMClassifier
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)


RANDOM_STATE = 42
PROB_CLIP_LOW = 0.01
PROB_CLIP_HIGH = 0.99


@dataclass
class PipelineConfig:
    project_root: Path
    archive_dir: Path
    archive1_dir: Path
    output_dir: Path
    max_symbols_archive: int | None
    max_rows_per_symbol_archive: int | None
    max_rows_per_symbol_archive1: int | None
    tune_trials: int
    cv_splits: int


class QuantileClipper(BaseEstimator, TransformerMixin):
    """Winsorize numeric columns using train-only quantiles."""

    def __init__(self, lower: float = 0.005, upper: float = 0.995):
        self.lower = lower
        self.upper = upper

    def fit(self, X, y=None):
        arr = self._to_array(X)
        self.lower_bounds_ = np.nanquantile(arr, self.lower, axis=0)
        self.upper_bounds_ = np.nanquantile(arr, self.upper, axis=0)
        return self

    def transform(self, X):
        arr = self._to_array(X)
        arr = np.clip(arr, self.lower_bounds_, self.upper_bounds_)
        return arr

    def get_feature_names_out(self, input_features=None):
        if input_features is None:
            return np.array([], dtype=object)
        return np.asarray(input_features, dtype=object)


def clip_numeric_outliers_train_based(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    numeric_cols: list[str],
    logger: logging.Logger,
    lower: float = 0.005,
    upper: float = 0.995,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Leakage-safe outlier treatment using train quantiles only."""
    train_df = train_df.copy()
    val_df = val_df.copy()
    test_df = test_df.copy()

    bounds: dict[str, tuple[float, float]] = {}
    for c in numeric_cols:
        if c not in train_df.columns:
            continue
        lo = float(train_df[c].quantile(lower))
        hi = float(train_df[c].quantile(upper))
        if np.isnan(lo) or np.isnan(hi):
            continue
        bounds[c] = (lo, hi)

    for c, (lo, hi) in bounds.items():
        train_df[c] = train_df[c].clip(lo, hi)
        val_df[c] = val_df[c].clip(lo, hi)
        test_df[c] = test_df[c].clip(lo, hi)

    logger.info("Applied train-based outlier clipping on %s numeric features.", len(bounds))
    return train_df, val_df, test_df

    @staticmethod
    def _to_array(X):
        if sparse.issparse(X):
            return X.toarray()
        return np.asarray(X)


def configure_logging() -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    return logging.getLogger("prediction_market_pipeline")


def _safe_read_csv(path: Path, usecols: list[str] | None = None) -> pd.DataFrame:
    try:
        return pd.read_csv(path, usecols=usecols, low_memory=False)
    except ValueError:
        # Some files may miss optional columns.
        return pd.read_csv(path, low_memory=False)


def _sample_symbol_files(files: list[Path], max_symbols: int | None) -> list[Path]:
    if max_symbols is None or max_symbols >= len(files):
        return files
    rng = np.random.default_rng(RANDOM_STATE)
    idx = rng.choice(len(files), size=max_symbols, replace=False)
    return [files[i] for i in sorted(idx)]


def load_archive_dataset(
    folder: Path,
    max_symbols: int | None,
    max_rows_per_symbol: int | None,
    logger: logging.Logger,
) -> pd.DataFrame:
    files = sorted([p for p in folder.glob("*.csv") if p.name.lower() != "symbols_valid_meta.csv"])
    files = _sample_symbol_files(files, max_symbols)

    frames: list[pd.DataFrame] = []
    for idx, file in enumerate(files, start=1):
        df = _safe_read_csv(file, usecols=["Date", "Open", "High", "Low", "Close", "Adj Close", "Volume"])
        if max_rows_per_symbol is not None and len(df) > max_rows_per_symbol:
            df = df.tail(max_rows_per_symbol)

        df = df.rename(
            columns={
                "Date": "date",
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Adj Close": "adj_close",
                "Volume": "volume",
            }
        )
        df["symbol"] = file.stem.upper()
        df["series"] = "COMMON"
        df["market"] = "US"
        df["source"] = "archive"
        df["prev_close"] = np.nan
        df["vwap"] = np.nan
        df["turnover"] = np.nan
        df["trades"] = np.nan
        df["deliv_volume"] = np.nan
        df["pct_deliv"] = np.nan

        frames.append(df)
        if idx % 500 == 0:
            logger.info("Loaded %s/%s files from archive", idx, len(files))

    if not frames:
        raise RuntimeError(f"No valid CSV files found in {folder}")

    data = pd.concat(frames, ignore_index=True)
    return data

def load_archive1_dataset(
    folder: Path,
    max_rows_per_symbol: int | None,
    logger: logging.Logger,
) -> pd.DataFrame:
    files = sorted([p for p in folder.glob("*.csv") if p.name.lower() != "stock_metadata.csv"])

    frames: list[pd.DataFrame] = []
    for idx, file in enumerate(files, start=1):
        df = _safe_read_csv(
            file,
            usecols=[
                "Date",
                "Symbol",
                "Series",
                "Prev Close",
                "Open",
                "High",
                "Low",
                "Close",
                "VWAP",
                "Volume",
                "Turnover",
                "Trades",
                "Deliverable Volume",
                "%Deliverble",
            ],
        )
        if max_rows_per_symbol is not None and len(df) > max_rows_per_symbol:
            df = df.tail(max_rows_per_symbol)

        df = df.rename(
            columns={
                "Date": "date",
                "Symbol": "symbol",
                "Series": "series",
                "Prev Close": "prev_close",
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "VWAP": "vwap",
                "Volume": "volume",
                "Turnover": "turnover",
                "Trades": "trades",
                "Deliverable Volume": "deliv_volume",
                "%Deliverble": "pct_deliv",
            }
        )
        df["market"] = "NSE"
        df["source"] = "archive (1)"
        df["adj_close"] = np.nan

        frames.append(df)
        if idx % 25 == 0:
            logger.info("Loaded %s/%s files from archive (1)", idx, len(files))

    if not frames:
        raise RuntimeError(f"No valid CSV files found in {folder}")

    data = pd.concat(frames, ignore_index=True)
    return data


def step1_inspect(df: pd.DataFrame, logger: logging.Logger, title: str, target_col: str | None = None) -> None:
    logger.info("==== STEP 1 | Data Inspection [%s] ====", title)
    logger.info("Shape: %s", df.shape)
    logger.info("Columns: %s", list(df.columns))
    dtype_preview = df.dtypes.astype(str).to_dict()
    logger.info("Dtypes: %s", json.dumps(dtype_preview, default=str))

    time_cols = [c for c in df.columns if "date" in c.lower() or np.issubdtype(df[c].dtype, np.datetime64)]
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    logger.info("Identified time/date columns: %s", time_cols)
    logger.info("Identified categorical features: %s", cat_cols)
    logger.info("Identified numerical features: %s", num_cols)

    if target_col and target_col in df.columns:
        vc = df[target_col].value_counts(normalize=True, dropna=False)
        logger.info("Class balance for '%s': %s", target_col, vc.to_dict())


def step2_clean(df: pd.DataFrame, logger: logging.Logger) -> pd.DataFrame:
    logger.info("==== STEP 2 | Data Cleaning ====")

    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["date", "symbol", "open", "high", "low", "close", "volume"])
    logger.info("Dropped rows with critical nulls: %s", before - len(df))

    before = len(df)
    df = df.drop_duplicates(subset=["date", "symbol", "market"])  # exact duplicate candles
    logger.info("Removed duplicates: %s", before - len(df))

    df["symbol"] = df["symbol"].astype(str).str.upper().str.strip()
    df["series"] = df["series"].astype(str).str.upper().str.strip()
    df["market"] = df["market"].astype(str).str.upper().str.strip()
    df["source"] = df["source"].astype(str).str.strip()

    for col in [
        "open",
        "high",
        "low",
        "close",
        "adj_close",
        "volume",
        "prev_close",
        "vwap",
        "turnover",
        "trades",
        "deliv_volume",
        "pct_deliv",
    ]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Guard against parser artifacts before preprocessing.
    df.replace([np.inf, -np.inf], np.nan, inplace=True)

    df = df.sort_values(["symbol", "date"]).reset_index(drop=True)

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        outlier_rates: dict[str, float] = {}
        for c in numeric_cols:
            s = df[c]
            if s.notna().sum() < 50:
                continue
            q1 = s.quantile(0.25)
            q3 = s.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0 or np.isnan(iqr):
                continue
            lo = q1 - 1.5 * iqr
            hi = q3 + 1.5 * iqr
            rate = float(((s < lo) | (s > hi)).mean())
            outlier_rates[c] = round(rate, 4)
        logger.info("Outlier rate by numeric column (IQR heuristic): %s", outlier_rates)

    logger.info("Cleaned shape: %s", df.shape)
    return df


def step4_feature_engineering(df: pd.DataFrame, logger: logging.Logger) -> pd.DataFrame:
    logger.info("==== STEP 4 | Feature Engineering ====")

    df = df.copy().sort_values(["symbol", "date"]).reset_index(drop=True)
    g = df.groupby("symbol", group_keys=False)

    # Build prev_close where missing.
    shifted_close = g["close"].shift(1)
    df["prev_close"] = df["prev_close"].fillna(shifted_close)

    # Core returns.
    df["return_1d"] = (df["close"] - df["prev_close"]) / (df["prev_close"].abs() + 1e-9)
    df["log_return_1d"] = np.log1p(df["return_1d"].clip(lower=-0.95))

    # Lag features.
    for lag in [1, 2, 3, 5, 10]:
        df[f"lag_close_{lag}"] = g["close"].shift(lag)
        df[f"lag_return_{lag}"] = g["return_1d"].shift(lag)
        df[f"lag_volume_{lag}"] = g["volume"].shift(lag)

    # Rolling stats.
    for win in [5, 10, 20]:
        df[f"roll_mean_close_{win}"] = g["close"].transform(lambda s: s.rolling(win, min_periods=2).mean())
        df[f"roll_std_close_{win}"] = g["close"].transform(lambda s: s.rolling(win, min_periods=2).std())
        df[f"roll_mean_volume_{win}"] = g["volume"].transform(lambda s: s.rolling(win, min_periods=2).mean())
        df[f"volatility_{win}"] = g["return_1d"].transform(lambda s: s.rolling(win, min_periods=2).std())

    # Momentum indicators.
    df["momentum_3"] = g["close"].pct_change(3)
    df["momentum_10"] = g["close"].pct_change(10)
    df["volume_momentum_3"] = g["volume"].pct_change(3)

    # Intraday structure.
    df["intraday_range"] = (df["high"] - df["low"]) / (df["close"].abs() + 1e-9)
    df["candle_body"] = (df["close"] - df["open"]) / (df["open"].abs() + 1e-9)
    spread = (df["high"] - df["low"]).replace(0, np.nan)
    df["price_position"] = ((df["close"] - df["low"]) / spread).fillna(0.5)

    # Liquidity and sentiment proxies.
    df["volume_ratio_10"] = df["volume"] / (df["roll_mean_volume_10"].abs() + 1e-9)
    if "vwap" in df.columns:
        df["vwap_gap"] = (df["close"] - df["vwap"]) / (df["vwap"].abs() + 1e-9)
    else:
        df["vwap_gap"] = 0.0

    market_grp = df.groupby(["date", "market"], group_keys=False)
    df["market_return_1d"] = market_grp["return_1d"].transform("mean")
    df["market_up_ratio"] = market_grp["return_1d"].transform(lambda s: (s > 0).mean())
    df["relative_strength"] = df["return_1d"] - df["market_return_1d"]

    df["day_of_week"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month

    # Binary target for probabilistic market prediction.
    next_close = g["close"].shift(-1)
    df["target"] = (next_close > df["close"]).astype(int)

    # Remove rows where target is undefined.
    df = df[next_close.notna()].copy()
    df.replace([np.inf, -np.inf], np.nan, inplace=True)

    logger.info("Feature engineered shape: %s", df.shape)
    return df


def step3_time_split(df: pd.DataFrame, logger: logging.Logger) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    logger.info("==== STEP 3 | Time-Series Split (70/15/15, no shuffle) ====")

    df = df.sort_values("date").reset_index(drop=True)
    unique_dates = np.array(sorted(df["date"].dropna().unique()))
    n_dates = len(unique_dates)
    if n_dates < 10:
        raise RuntimeError("Not enough unique dates for time-based split.")

    train_cut = unique_dates[int(n_dates * 0.70) - 1]
    val_cut = unique_dates[int(n_dates * 0.85) - 1]

    train_df = df[df["date"] <= train_cut].copy()
    val_df = df[(df["date"] > train_cut) & (df["date"] <= val_cut)].copy()
    test_df = df[df["date"] > val_cut].copy()

    logger.info(
        "Train: %s rows | %s -> %s",
        len(train_df),
        train_df["date"].min().date(),
        train_df["date"].max().date(),
    )
    logger.info(
        "Valid: %s rows | %s -> %s",
        len(val_df),
        val_df["date"].min().date(),
        val_df["date"].max().date(),
    )
    logger.info(
        "Test : %s rows | %s -> %s",
        len(test_df),
        test_df["date"].min().date(),
        test_df["date"].max().date(),
    )

    for name, frame in [("train", train_df), ("valid", val_df), ("test", test_df)]:
        balance = frame["target"].value_counts(normalize=True).to_dict()
        logger.info("Class balance (%s): %s", name, balance)

    return train_df, val_df, test_df


def build_preprocessor(df: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str], list[str]]:
    feature_cols = [
        c
        for c in df.columns
        if c not in {"target", "date"}
    ]

    categorical_cols = [c for c in ["symbol", "series", "market", "source"] if c in feature_cols]
    numeric_cols = [c for c in feature_cols if c not in categorical_cols]

    num_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    cat_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                    min_frequency=20,
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_pipeline, numeric_cols),
            ("cat", cat_pipeline, categorical_cols),
        ],
        remainder="drop",
        sparse_threshold=0.3,
    )

    return preprocessor, feature_cols, numeric_cols, categorical_cols


def _time_subsample_indices(n_rows: int, max_rows: int | None) -> np.ndarray:
    if max_rows is None or n_rows <= max_rows:
        return np.arange(n_rows)
    return np.linspace(0, n_rows - 1, max_rows, dtype=int)


def _subset_matrix(X, y, max_rows: int | None):
    idx = _time_subsample_indices(len(y), max_rows)
    if len(idx) == len(y):
        return X, y
    return X[idx], y[idx]


def make_models(train_rows: int) -> dict[str, Any]:
    models: dict[str, Any] = {
        "LogisticRegression": LogisticRegression(
            solver="saga",
            max_iter=2000,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=260,
            max_depth=14,
            min_samples_leaf=8,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            class_weight="balanced_subsample",
        ),
        "XGBoost": XGBClassifier(
            n_estimators=320,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=RANDOM_STATE,
            n_jobs=-1,
            tree_method="hist",
            reg_lambda=1.0,
            min_child_weight=1,
        ),
        "LightGBM": LGBMClassifier(
            n_estimators=320,
            learning_rate=0.05,
            num_leaves=64,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            objective="binary",
            verbosity=-1,
        ),
    }

    if train_rows >= 200000:
        models["NeuralNetwork"] = MLPClassifier(
            hidden_layer_sizes=(128, 64),
            activation="relu",
            solver="adam",
            alpha=1e-4,
            batch_size=512,
            learning_rate_init=1e-3,
            max_iter=80,
            early_stopping=True,
            random_state=RANDOM_STATE,
        )

    return models


def compute_classification_metrics(y_true: np.ndarray, proba: np.ndarray) -> dict[str, float]:
    p = np.clip(proba, PROB_CLIP_LOW, PROB_CLIP_HIGH)
    pred = (p >= 0.5).astype(int)

    out = {
        "accuracy": float(accuracy_score(y_true, pred)),
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred, zero_division=0)),
        "f1": float(f1_score(y_true, pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, p)) if len(np.unique(y_true)) > 1 else float("nan"),
        "log_loss": float(log_loss(y_true, p, labels=[0, 1])),
        "brier": float(brier_score_loss(y_true, p)),
    }
    return out


def temporal_stability_metrics(
    dates: pd.Series,
    y_true: np.ndarray,
    proba: np.ndarray,
    window_dates: int = 30,
) -> dict[str, float]:
    frame = pd.DataFrame({"date": dates.values, "y": y_true, "p": np.clip(proba, PROB_CLIP_LOW, PROB_CLIP_HIGH)})
    uniq = np.array(sorted(frame["date"].unique()))
    if len(uniq) <= window_dates:
        return {"rolling_logloss_mean": np.nan, "rolling_logloss_std": np.nan}

    scores: list[float] = []
    for i in range(window_dates, len(uniq) + 1):
        win_dates = uniq[i - window_dates : i]
        chunk = frame[frame["date"].isin(win_dates)]
        if chunk["y"].nunique() < 2:
            continue
        scores.append(log_loss(chunk["y"], chunk["p"], labels=[0, 1]))

    if not scores:
        return {"rolling_logloss_mean": np.nan, "rolling_logloss_std": np.nan}

    return {
        "rolling_logloss_mean": float(np.mean(scores)),
        "rolling_logloss_std": float(np.std(scores)),
    }


def train_and_evaluate_models(
    X_train,
    y_train,
    X_val,
    y_val,
    X_test,
    y_test,
    val_dates: pd.Series,
    logger: logging.Logger,
    cv_splits: int,
) -> tuple[dict[str, Any], pd.DataFrame]:
    logger.info("==== STEP 5 + STEP 6 | Model Training and Evaluation ====")

    models = make_models(len(y_train))
    tscv = TimeSeriesSplit(n_splits=cv_splits)

    records: list[dict[str, Any]] = []
    trained: dict[str, Any] = {}

    fit_caps = {
        "LogisticRegression": 800000,
        "RandomForest": 250000,
        "XGBoost": 500000,
        "LightGBM": 500000,
        "NeuralNetwork": 200000,
    }
    cv_cap = 300000

    for name, model in models.items():
        logger.info("Training %s", name)

        X_fit, y_fit = _subset_matrix(X_train, y_train, fit_caps.get(name))
        X_cv, y_cv = _subset_matrix(X_train, y_train, cv_cap)

        # Cross-validation for robust probability quality.
        try:
            cv_scores = cross_val_score(
                model,
                X_cv,
                y_cv,
                cv=tscv,
                scoring="neg_log_loss",
                n_jobs=1,
            )
            cv_logloss = float(-np.mean(cv_scores))
        except Exception:
            cv_logloss = float("nan")

        # MLP requires dense matrix.
        if name == "NeuralNetwork" and sparse.issparse(X_fit):
            X_fit = X_fit.toarray()
            X_val_infer = X_val.toarray() if sparse.issparse(X_val) else X_val
            X_test_infer = X_test.toarray() if sparse.issparse(X_test) else X_test
            X_train_infer = X_train.toarray() if sparse.issparse(X_train) else X_train
        else:
            X_val_infer = X_val
            X_test_infer = X_test
            X_train_infer = X_train

        model.fit(X_fit, y_fit)

        train_proba = model.predict_proba(X_train_infer)[:, 1]
        val_proba = model.predict_proba(X_val_infer)[:, 1]
        test_proba = model.predict_proba(X_test_infer)[:, 1]

        train_metrics = compute_classification_metrics(y_train, train_proba)
        val_metrics = compute_classification_metrics(y_val, val_proba)
        test_metrics = compute_classification_metrics(y_test, test_proba)
        stability = temporal_stability_metrics(val_dates, y_val, val_proba)

        overfit_gap = train_metrics["log_loss"] - val_metrics["log_loss"]

        row = {
            "model": name,
            "cv_log_loss": cv_logloss,
            "train_log_loss": train_metrics["log_loss"],
            "val_log_loss": val_metrics["log_loss"],
            "test_log_loss": test_metrics["log_loss"],
            "val_brier": val_metrics["brier"],
            "test_brier": test_metrics["brier"],
            "val_auc": val_metrics["roc_auc"],
            "test_auc": test_metrics["roc_auc"],
            "val_f1": val_metrics["f1"],
            "test_f1": test_metrics["f1"],
            "val_accuracy": val_metrics["accuracy"],
            "test_accuracy": test_metrics["accuracy"],
            "overfit_gap_logloss": overfit_gap,
            "val_rolling_logloss_std": stability["rolling_logloss_std"],
        }
        records.append(row)

        trained[name] = {
            "model": model,
            "val_proba": np.clip(val_proba, PROB_CLIP_LOW, PROB_CLIP_HIGH),
            "test_proba": np.clip(test_proba, PROB_CLIP_LOW, PROB_CLIP_HIGH),
        }

        logger.info(
            "%s | val_logloss=%.5f val_brier=%.5f val_auc=%.5f overfit_gap=%.5f",
            name,
            row["val_log_loss"],
            row["val_brier"],
            row["val_auc"],
            row["overfit_gap_logloss"],
        )

    metrics_df = pd.DataFrame(records).sort_values(
        by=["val_log_loss", "val_brier", "val_rolling_logloss_std"],
        ascending=[True, True, True],
    )
    return trained, metrics_df


def build_tuned_model(name: str, trial: optuna.trial.Trial):
    if name == "LogisticRegression":
        return LogisticRegression(
            solver="saga",
            C=trial.suggest_float("C", 1e-3, 10.0, log=True),
            max_iter=2500,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )

    if name == "RandomForest":
        return RandomForestClassifier(
            n_estimators=trial.suggest_int("n_estimators", 120, 380),
            max_depth=trial.suggest_int("max_depth", 6, 20),
            min_samples_leaf=trial.suggest_int("min_samples_leaf", 2, 16),
            max_features=trial.suggest_float("max_features", 0.3, 1.0),
            class_weight="balanced_subsample",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )

    if name == "XGBoost":
        return XGBClassifier(
            n_estimators=trial.suggest_int("n_estimators", 120, 500),
            max_depth=trial.suggest_int("max_depth", 3, 10),
            learning_rate=trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            subsample=trial.suggest_float("subsample", 0.6, 1.0),
            colsample_bytree=trial.suggest_float("colsample_bytree", 0.5, 1.0),
            min_child_weight=trial.suggest_float("min_child_weight", 1.0, 10.0),
            reg_lambda=trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=RANDOM_STATE,
            n_jobs=-1,
            tree_method="hist",
        )

    if name == "LightGBM":
        return LGBMClassifier(
            n_estimators=trial.suggest_int("n_estimators", 120, 500),
            learning_rate=trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            num_leaves=trial.suggest_int("num_leaves", 16, 128),
            max_depth=trial.suggest_int("max_depth", -1, 16),
            min_child_samples=trial.suggest_int("min_child_samples", 10, 80),
            subsample=trial.suggest_float("subsample", 0.6, 1.0),
            colsample_bytree=trial.suggest_float("colsample_bytree", 0.5, 1.0),
            reg_lambda=trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            objective="binary",
            random_state=RANDOM_STATE,
            n_jobs=-1,
            verbosity=-1,
        )

    raise ValueError(f"Unsupported model for tuning: {name}")


def step7_tune_best_model(
    best_model_name: str,
    X_train,
    y_train,
    logger: logging.Logger,
    tune_trials: int,
    cv_splits: int,
):
    logger.info("==== STEP 7 | Hyperparameter Tuning (%s) ====", best_model_name)

    if best_model_name == "NeuralNetwork":
        logger.info("Skipping Optuna tuning for NeuralNetwork (runtime guard).")
        model = make_models(len(y_train))["NeuralNetwork"]
        X_fit, y_fit = _subset_matrix(X_train, y_train, 200000)
        if sparse.issparse(X_fit):
            X_fit = X_fit.toarray()
        model.fit(X_fit, y_fit)
        return model, {"note": "default_mlp_params"}, np.nan

    X_tune, y_tune = _subset_matrix(X_train, y_train, 300000)
    tscv = TimeSeriesSplit(n_splits=cv_splits)

    def objective(trial: optuna.trial.Trial) -> float:
        model = build_tuned_model(best_model_name, trial)
        scores = cross_val_score(
            model,
            X_tune,
            y_tune,
            cv=tscv,
            scoring="neg_log_loss",
            n_jobs=1,
        )
        return float(-np.mean(scores))

    study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=RANDOM_STATE))
    study.optimize(objective, n_trials=tune_trials, show_progress_bar=False)

    best_model = build_tuned_model(best_model_name, optuna.trial.FixedTrial(study.best_params))
    X_fit, y_fit = _subset_matrix(X_train, y_train, 600000)
    best_model.fit(X_fit, y_fit)

    logger.info("Best tuning objective (CV log loss): %.5f", study.best_value)
    logger.info("Best params: %s", study.best_params)
    return best_model, study.best_params, study.best_value


def step8_calibrate_and_select(
    tuned_model,
    X_val,
    y_val,
    X_test,
    y_test,
    test_dates: pd.Series,
    logger: logging.Logger,
):
    logger.info("==== STEP 8 | Final Calibration + Selection ====")

    if sparse.issparse(X_val) and isinstance(tuned_model, MLPClassifier):
        X_val_infer = X_val.toarray()
        X_test_infer = X_test.toarray() if sparse.issparse(X_test) else X_test
    else:
        X_val_infer = X_val
        X_test_infer = X_test

    # Calibrate on validation set (holdout) to improve probability quality.
    calibrated = CalibratedClassifierCV(tuned_model, method="sigmoid", cv="prefit")
    calibrated.fit(X_val_infer, y_val)

    val_proba = calibrated.predict_proba(X_val_infer)[:, 1]
    test_proba = calibrated.predict_proba(X_test_infer)[:, 1]

    val_metrics = compute_classification_metrics(y_val, val_proba)
    test_metrics = compute_classification_metrics(y_test, test_proba)
    stability = temporal_stability_metrics(test_dates, y_test, test_proba)

    logger.info(
        "Calibrated model | val_logloss=%.5f val_brier=%.5f test_logloss=%.5f test_brier=%.5f test_auc=%.5f",
        val_metrics["log_loss"],
        val_metrics["brier"],
        test_metrics["log_loss"],
        test_metrics["brier"],
        test_metrics["roc_auc"],
    )
    logger.info("Temporal stability (test rolling logloss std): %.5f", stability["rolling_logloss_std"])

    return calibrated, val_metrics, test_metrics, stability, np.clip(test_proba, PROB_CLIP_LOW, PROB_CLIP_HIGH)


def step9_feature_importance(
    base_model,
    feature_names: list[str],
    output_dir: Path,
    logger: logging.Logger,
) -> pd.DataFrame:
    logger.info("==== STEP 9 | Feature Importance ====")

    if hasattr(base_model, "feature_importances_"):
        importance = np.asarray(base_model.feature_importances_)
    elif hasattr(base_model, "coef_"):
        coef = np.asarray(base_model.coef_)
        importance = np.abs(coef[0]) if coef.ndim > 1 else np.abs(coef)
    else:
        logger.warning("Model type does not expose feature importance.")
        return pd.DataFrame(columns=["feature", "importance"])

    if len(importance) != len(feature_names):
        logger.warning("Feature importance length mismatch; skipping detailed ranking.")
        return pd.DataFrame(columns=["feature", "importance"])

    fi = pd.DataFrame({"feature": feature_names, "importance": importance})
    fi = fi.sort_values("importance", ascending=False).reset_index(drop=True)

    fi.to_csv(output_dir / "feature_importance.csv", index=False)

    topn = fi.head(30)
    plt.figure(figsize=(10, 8))
    plt.barh(topn["feature"][::-1], topn["importance"][::-1], color="#1f77b4")
    plt.title("Top 30 Feature Importances")
    plt.xlabel("Importance")
    plt.tight_layout()
    plt.savefig(output_dir / "feature_importance_top30.png", dpi=130)
    plt.close()

    logger.info("Top features saved to %s", output_dir / "feature_importance.csv")
    return fi


def step10_plots_and_risk_baselines(
    calibrated_model,
    X_val,
    y_val,
    X_train,
    output_dir: Path,
    logger: logging.Logger,
) -> tuple[dict[str, Any], IsolationForest]:
    logger.info("==== STEP 10 | Calibration Plot + Risk Baselines ====")

    X_val_plot = X_val.toarray() if sparse.issparse(X_val) else X_val
    val_proba = np.clip(calibrated_model.predict_proba(X_val_plot)[:, 1], PROB_CLIP_LOW, PROB_CLIP_HIGH)

    prob_true, prob_pred = calibration_curve(y_val, val_proba, n_bins=12)
    plt.figure(figsize=(7, 5))
    plt.plot(prob_pred, prob_true, marker="o", label="Model")
    plt.plot([0, 1], [0, 1], linestyle="--", color="black", label="Perfect")
    plt.title("Calibration Curve")
    plt.xlabel("Predicted Probability")
    plt.ylabel("Observed Frequency")
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_dir / "calibration_curve.png", dpi=130)
    plt.close()

    # Anomaly detector baseline on transformed train features.
    X_ad, _ = _subset_matrix(X_train, np.zeros(X_train.shape[0]), 250000)
    X_ad_fit = X_ad.toarray() if sparse.issparse(X_ad) else X_ad
    anomaly_detector = IsolationForest(
        n_estimators=200,
        contamination=0.01,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    anomaly_detector.fit(X_ad_fit)

    hist, edges = np.histogram(val_proba, bins=10, range=(0.0, 1.0), density=True)

    drift_baseline = {
        "prob_hist": hist.tolist(),
        "prob_bin_edges": edges.tolist(),
        "psi_alert_threshold": 0.2,
        "psi_danger_threshold": 0.3,
    }

    return drift_baseline, anomaly_detector


def export_artifacts(
    output_dir: Path,
    calibrated_model,
    tuned_base_model,
    preprocessor: ColumnTransformer,
    feature_columns: list[str],
    numeric_features: list[str],
    categorical_features: list[str],
    metrics_df: pd.DataFrame,
    tuned_params: dict[str, Any],
    tuned_objective: float,
    final_val_metrics: dict[str, float],
    final_test_metrics: dict[str, float],
    stability: dict[str, float],
    drift_baseline: dict[str, Any],
    anomaly_detector: IsolationForest,
    logger: logging.Logger,
) -> None:
    bundle = {
        "model": calibrated_model,
        "base_model": tuned_base_model,
        "preprocessor": preprocessor,
        "feature_columns": feature_columns,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "probability_clip": [PROB_CLIP_LOW, PROB_CLIP_HIGH],
        "metrics_table": metrics_df,
        "tuned_params": tuned_params,
        "tuned_objective": tuned_objective,
        "final_val_metrics": final_val_metrics,
        "final_test_metrics": final_test_metrics,
        "stability": stability,
        "drift_baseline": drift_baseline,
        "anomaly_detector": anomaly_detector,
        "created_at_utc": datetime.utcnow().isoformat(),
        "random_state": RANDOM_STATE,
    }

    joblib.dump(bundle, output_dir / "final_prediction_market_model.pkl")

    scaler = preprocessor.named_transformers_["num"].named_steps["scaler"]
    encoder = preprocessor.named_transformers_["cat"].named_steps["encoder"]
    joblib.dump(scaler, output_dir / "scaler.pkl")
    joblib.dump(encoder, output_dir / "encoder.pkl")
    joblib.dump(preprocessor, output_dir / "preprocessor.pkl")

    metrics_df.to_csv(output_dir / "model_metrics_comparison.csv", index=False)

    logger.info("Saved model bundle: %s", output_dir / "final_prediction_market_model.pkl")
    logger.info("Saved scaler: %s", output_dir / "scaler.pkl")
    logger.info("Saved encoder: %s", output_dir / "encoder.pkl")


def run_pipeline(cfg: PipelineConfig) -> None:
    logger = configure_logging()

    t0 = datetime.now()
    cfg.output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Using archive dir: %s", cfg.archive_dir)
    logger.info("Using archive (1) dir: %s", cfg.archive1_dir)

    # Load both datasets.
    us_df = load_archive_dataset(
        folder=cfg.archive_dir,
        max_symbols=cfg.max_symbols_archive,
        max_rows_per_symbol=cfg.max_rows_per_symbol_archive,
        logger=logger,
    )
    nse_df = load_archive1_dataset(
        folder=cfg.archive1_dir,
        max_rows_per_symbol=cfg.max_rows_per_symbol_archive1,
        logger=logger,
    )

    step1_inspect(us_df, logger, title="archive")
    step1_inspect(nse_df, logger, title="archive (1)")

    data = pd.concat([us_df, nse_df], ignore_index=True, sort=False)
    step1_inspect(data, logger, title="combined_raw")

    # Step 2 clean.
    data = step2_clean(data, logger)

    # Step 4 feature engineering.
    data = step4_feature_engineering(data, logger)
    step1_inspect(data, logger, title="combined_featured", target_col="target")

    # Step 3 time split.
    train_df, val_df, test_df = step3_time_split(data, logger)

    # Build preprocessing with leakage-safe train-only fit.
    preprocessor, feature_cols, numeric_features, categorical_features = build_preprocessor(train_df)
    train_df, val_df, test_df = clip_numeric_outliers_train_based(
        train_df,
        val_df,
        test_df,
        numeric_features,
        logger,
    )

    X_train_raw = train_df[feature_cols]
    y_train = train_df["target"].astype(int).values
    X_val_raw = val_df[feature_cols]
    y_val = val_df["target"].astype(int).values
    X_test_raw = test_df[feature_cols]
    y_test = test_df["target"].astype(int).values

    preprocessor.fit(X_train_raw)
    X_train = preprocessor.transform(X_train_raw)
    X_val = preprocessor.transform(X_val_raw)
    X_test = preprocessor.transform(X_test_raw)

    # Model training and market-grade evaluation.
    _, metrics_df = train_and_evaluate_models(
        X_train,
        y_train,
        X_val,
        y_val,
        X_test,
        y_test,
        val_dates=val_df["date"],
        logger=logger,
        cv_splits=cfg.cv_splits,
    )

    logger.info("==== STEP 6 | Model Comparison ====")
    logger.info("\n%s", metrics_df.to_string(index=False))

    # Select best by val log loss, calibration proxy (brier), stability.
    best_row = metrics_df.iloc[0]
    best_name = str(best_row["model"])
    logger.info("Selected baseline best model: %s", best_name)

    # Hyperparameter tuning.
    tuned_model, tuned_params, tuned_objective = step7_tune_best_model(
        best_name,
        X_train,
        y_train,
        logger,
        tune_trials=cfg.tune_trials,
        cv_splits=min(cfg.cv_splits, 4),
    )

    # Calibration and final selection.
    calibrated_model, final_val_metrics, final_test_metrics, stability, _ = step8_calibrate_and_select(
        tuned_model,
        X_val,
        y_val,
        X_test,
        y_test,
        test_dates=test_df["date"],
        logger=logger,
    )

    # Feature importance on tuned base model.
    feature_names = preprocessor.get_feature_names_out().tolist()
    step9_feature_importance(tuned_model, feature_names, cfg.output_dir, logger)

    # Calibration curve and risk baselines.
    drift_baseline, anomaly_detector = step10_plots_and_risk_baselines(
        calibrated_model,
        X_val,
        y_val,
        X_train,
        cfg.output_dir,
        logger,
    )

    # Save artifacts.
    export_artifacts(
        output_dir=cfg.output_dir,
        calibrated_model=calibrated_model,
        tuned_base_model=tuned_model,
        preprocessor=preprocessor,
        feature_columns=feature_cols,
        numeric_features=numeric_features,
        categorical_features=categorical_features,
        metrics_df=metrics_df,
        tuned_params=tuned_params,
        tuned_objective=tuned_objective,
        final_val_metrics=final_val_metrics,
        final_test_metrics=final_test_metrics,
        stability=stability,
        drift_baseline=drift_baseline,
        anomaly_detector=anomaly_detector,
        logger=logger,
    )

    summary = {
        "selected_model": best_name,
        "final_val_metrics": final_val_metrics,
        "final_test_metrics": final_test_metrics,
        "stability": stability,
        "tuned_params": tuned_params,
    }
    with (cfg.output_dir / "final_summary.json").open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    elapsed = (datetime.now() - t0).total_seconds()
    logger.info("Pipeline complete in %.1f seconds", elapsed)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prediction market probabilistic pipeline")
    parser.add_argument("--archive-dir", type=Path, default=Path("archive"))
    parser.add_argument("--archive1-dir", type=Path, default=Path("archive (1)"))
    parser.add_argument("--output-dir", type=Path, default=Path("ml_pipeline") / "outputs")

    parser.add_argument(
        "--max-symbols-archive",
        type=int,
        default=500,
        help="Runtime guard for archive symbol count; set 0 for all symbols.",
    )
    parser.add_argument(
        "--max-rows-per-symbol-archive",
        type=int,
        default=2000,
        help="Tail rows per symbol from archive; set 0 for full history.",
    )
    parser.add_argument(
        "--max-rows-per-symbol-archive1",
        type=int,
        default=0,
        help="Tail rows per symbol from archive (1); set 0 for full history.",
    )
    parser.add_argument("--tune-trials", type=int, default=25)
    parser.add_argument("--cv-splits", type=int, default=4)

    return parser.parse_args()


def normalize_limits(v: int | None) -> int | None:
    if v is None:
        return None
    return None if v <= 0 else int(v)


def main():
    args = parse_args()
    root = Path(__file__).resolve().parent.parent

    cfg = PipelineConfig(
        project_root=root,
        archive_dir=(root / args.archive_dir).resolve() if not args.archive_dir.is_absolute() else args.archive_dir,
        archive1_dir=(root / args.archive1_dir).resolve() if not args.archive1_dir.is_absolute() else args.archive1_dir,
        output_dir=(root / args.output_dir).resolve() if not args.output_dir.is_absolute() else args.output_dir,
        max_symbols_archive=normalize_limits(args.max_symbols_archive),
        max_rows_per_symbol_archive=normalize_limits(args.max_rows_per_symbol_archive),
        max_rows_per_symbol_archive1=normalize_limits(args.max_rows_per_symbol_archive1),
        tune_trials=int(args.tune_trials),
        cv_splits=int(args.cv_splits),
    )

    run_pipeline(cfg)


if __name__ == "__main__":
    main()
