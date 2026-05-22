
"""
Inference module for the production prediction-market model.

Exposes:
    predict_market_probability(input_data, history=None)

Output:
{
    "probability": float,
    "confidence": float,
    "raw_score": float,
    "signal": str,
    "risk_flags": list[str]
}
"""

from __future__ import annotations

import logging
import time
from collections import deque
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from scipy import sparse

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("predict")

# ── Constants ────────────────────────────────────────────────────────────────
PROB_CLIP_LOW = 0.01
PROB_CLIP_HIGH = 0.99
LOW_CONFIDENCE_THRESHOLD = 0.3


class DriftDetector:
    """Streaming PSI drift detector on predicted probabilities."""

    def __init__(
        self,
        baseline_hist: list[float],
        bin_edges: list[float],
        alert_threshold: float = 0.2,
        danger_threshold: float = 0.3,
        window_size: int = 500,
    ) -> None:
        self.baseline = np.asarray(baseline_hist, dtype=float)
        self.edges = np.asarray(bin_edges, dtype=float)
        self.alert_threshold = float(alert_threshold)
        self.danger_threshold = float(danger_threshold)
        self.window = deque(maxlen=window_size)

        # Avoid divide by zero.
        self.baseline = np.clip(self.baseline, 1e-6, None)
        self.baseline = self.baseline / self.baseline.sum()

    def update(self, p: float) -> None:
        self.window.append(float(p))

    def psi(self) -> float | None:
        if len(self.window) < self.window.maxlen:
            return None
        curr_hist, _ = np.histogram(np.asarray(self.window), bins=self.edges, density=True)
        curr = np.clip(curr_hist, 1e-6, None)
        curr = curr / curr.sum()
        return float(np.sum((curr - self.baseline) * np.log(curr / self.baseline)))

    def status(self) -> str | None:
        psi_val = self.psi()
        if psi_val is None:
            return None
        if psi_val >= self.danger_threshold:
            return f"DRIFT_DANGER: PSI={psi_val:.3f}"
        if psi_val >= self.alert_threshold:
            return f"DRIFT_ALERT: PSI={psi_val:.3f}"
        return None


def _find_model_bundle(pkl_files: list[Path]) -> Path:
    """Dynamically discover the model bundle from a list of .pkl files.

    Strategy: try loading each file; the one whose top-level object is a
    dict containing a 'model' key is the main bundle.
    Fallback: pick the largest .pkl if nothing matches.
    """
    candidates: list[tuple[Path, int]] = []
    for p in pkl_files:
        try:
            obj = joblib.load(p)
            if isinstance(obj, dict) and "model" in obj:
                log.info("Discovered model bundle: %s", p.name)
                return p
            candidates.append((p, p.stat().st_size))
        except Exception:
            candidates.append((p, p.stat().st_size))

    # Fallback: largest .pkl
    if candidates:
        candidates.sort(key=lambda x: x[1], reverse=True)
        log.warning(
            "No .pkl with 'model' key found — falling back to largest file: %s",
            candidates[0][0].name,
        )
        return candidates[0][0]

    raise RuntimeError("No .pkl artifacts found in outputs/. Run pipeline.py first.")


class _ArtifactCache:
    def __init__(self) -> None:
        self.loaded = False
        self.artifact_manifest: list[dict[str, Any]] = []

    def load(self) -> None:
        if self.loaded:
            return

        output_dir = Path(__file__).resolve().parent / "outputs"
        if not output_dir.exists():
            raise RuntimeError(f"Outputs directory not found: {output_dir}")

        # ── Dynamic discovery ────────────────────────────────────────
        pkl_files = sorted(output_dir.glob("*.pkl"))
        if not pkl_files:
            raise RuntimeError(f"No .pkl files in {output_dir}. Run pipeline.py first.")

        self.artifact_manifest = [
            {"name": p.name, "size_bytes": p.stat().st_size, "path": str(p)}
            for p in pkl_files
        ]
        log.info(
            "Found %d .pkl artifacts: %s",
            len(pkl_files),
            [p.name for p in pkl_files],
        )

        bundle_path = _find_model_bundle(pkl_files)
        bundle = joblib.load(bundle_path)
        self.bundle = bundle
        self.model = bundle["model"]
        self.preprocessor = bundle["preprocessor"]
        self.feature_columns = bundle["feature_columns"]
        self.anomaly_detector = bundle.get("anomaly_detector")

        log.info(
            "Model loaded: type=%s  features=%d  bundle=%s",
            type(self.model).__name__,
            len(self.feature_columns),
            bundle_path.name,
        )

        drift = bundle.get("drift_baseline", {})
        self.drift_detector = DriftDetector(
            baseline_hist=drift.get("prob_hist", [0.1] * 10),
            bin_edges=drift.get("prob_bin_edges", list(np.linspace(0.0, 1.0, 11))),
            alert_threshold=drift.get("psi_alert_threshold", 0.2),
            danger_threshold=drift.get("psi_danger_threshold", 0.3),
            window_size=500,
        )

        self.loaded = True
        log.info("Artifact cache fully initialized.")


_CACHE = _ArtifactCache()


def _f(x: Any, default: float = 0.0) -> float:
    try:
        if x is None:
            return float(default)
        return float(x)
    except Exception:
        return float(default)


def _prepare_history(history: pd.DataFrame | None) -> pd.DataFrame | None:
    if history is None or len(history) == 0:
        return None

    h = history.copy()
    cols = {c.lower(): c for c in h.columns}
    required = ["close", "volume"]
    if not all(c in cols for c in required):
        return None

    for c in ["open", "high", "low", "close", "volume"]:
        if c in cols:
            h[c] = pd.to_numeric(h[cols[c]], errors="coerce")
        else:
            h[c] = np.nan
    if "date" in cols:
        h["date"] = pd.to_datetime(h[cols["date"]], errors="coerce")
        h = h.sort_values("date")
    return h


def _build_feature_row(input_data: dict[str, Any], feature_cols: list[str], history: pd.DataFrame | None) -> pd.DataFrame:
    symbol = str(input_data.get("symbol", "UNKNOWN")).upper()
    market = str(input_data.get("market", "US")).upper()
    source = str(input_data.get("source", "api")).strip()
    series = str(input_data.get("series", "COMMON")).upper()

    close = _f(input_data.get("close"), 0.0)
    prev_close = _f(input_data.get("prev_close"), close)
    open_ = _f(input_data.get("open"), close)
    high = _f(input_data.get("high"), close)
    low = _f(input_data.get("low"), close)

    row: dict[str, Any] = {
        "symbol": symbol,
        "series": series,
        "market": market,
        "source": source,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "adj_close": _f(input_data.get("adj_close"), close),
        "volume": _f(input_data.get("volume"), 0.0),
        "prev_close": prev_close,
        "vwap": _f(input_data.get("vwap"), close),
        "turnover": _f(input_data.get("turnover"), 0.0),
        "trades": _f(input_data.get("trades"), 0.0),
        "deliv_volume": _f(input_data.get("deliv_volume"), _f(input_data.get("deliverable_volume"), 0.0)),
        "pct_deliv": _f(input_data.get("pct_deliv"), 0.0),
    }

    row["return_1d"] = (row["close"] - row["prev_close"]) / (abs(row["prev_close"]) + 1e-9)
    row["log_return_1d"] = np.log1p(max(row["return_1d"], -0.95))

    h = _prepare_history(history)

    if h is not None and len(h) >= 2:
        c = h["close"].values
        v = h["volume"].values

        for lag in [1, 2, 3, 5, 10]:
            row[f"lag_close_{lag}"] = float(c[-lag]) if len(c) >= lag else row["close"]
            if len(c) > lag:
                ret_lag = (c[-lag] - c[-lag - 1]) / (abs(c[-lag - 1]) + 1e-9)
            else:
                ret_lag = 0.0
            row[f"lag_return_{lag}"] = float(ret_lag)
            row[f"lag_volume_{lag}"] = float(v[-lag]) if len(v) >= lag else row["volume"]

        for win in [5, 10, 20]:
            if len(c) >= 2:
                row[f"roll_mean_close_{win}"] = float(np.mean(c[-win:])) if len(c) >= win else float(np.mean(c))
                row[f"roll_std_close_{win}"] = float(np.std(c[-win:])) if len(c) >= win else float(np.std(c))
                row[f"roll_mean_volume_{win}"] = float(np.mean(v[-win:])) if len(v) >= win else float(np.mean(v))
                rets = np.diff(c[-win:]) / (np.abs(c[-win:-1]) + 1e-9) if len(c) >= 3 else np.array([0.0])
                row[f"volatility_{win}"] = float(np.std(rets))
            else:
                row[f"roll_mean_close_{win}"] = row["close"]
                row[f"roll_std_close_{win}"] = 0.0
                row[f"roll_mean_volume_{win}"] = row["volume"]
                row[f"volatility_{win}"] = 0.0

        row["momentum_3"] = float((row["close"] - c[-3]) / (abs(c[-3]) + 1e-9)) if len(c) >= 3 else 0.0
        row["momentum_10"] = float((row["close"] - c[-10]) / (abs(c[-10]) + 1e-9)) if len(c) >= 10 else 0.0
        row["volume_momentum_3"] = float((row["volume"] - v[-3]) / (abs(v[-3]) + 1e-9)) if len(v) >= 3 else 0.0
    else:
        for lag in [1, 2, 3, 5, 10]:
            row[f"lag_close_{lag}"] = row["close"]
            row[f"lag_return_{lag}"] = 0.0
            row[f"lag_volume_{lag}"] = row["volume"]
        for win in [5, 10, 20]:
            row[f"roll_mean_close_{win}"] = row["close"]
            row[f"roll_std_close_{win}"] = 0.0
            row[f"roll_mean_volume_{win}"] = row["volume"]
            row[f"volatility_{win}"] = 0.0
        row["momentum_3"] = 0.0
        row["momentum_10"] = 0.0
        row["volume_momentum_3"] = 0.0

    row["intraday_range"] = (row["high"] - row["low"]) / (abs(row["close"]) + 1e-9)
    row["candle_body"] = (row["close"] - row["open"]) / (abs(row["open"]) + 1e-9)
    spread = row["high"] - row["low"]
    row["price_position"] = (row["close"] - row["low"]) / spread if spread != 0 else 0.5

    row["volume_ratio_10"] = row["volume"] / (abs(row.get("roll_mean_volume_10", row["volume"])) + 1e-9)
    row["vwap_gap"] = (row["close"] - row["vwap"]) / (abs(row["vwap"]) + 1e-9)

    row["market_return_1d"] = _f(input_data.get("market_return_1d"), 0.0)
    row["market_up_ratio"] = _f(input_data.get("market_up_ratio"), 0.5)
    row["relative_strength"] = row["return_1d"] - row["market_return_1d"]

    dt = pd.to_datetime(input_data.get("date"), errors="coerce")
    if pd.isna(dt):
        dt = pd.Timestamp.utcnow()
    row["day_of_week"] = int(dt.dayofweek)
    row["month"] = int(dt.month)

    data = {c: row.get(c, np.nan) for c in feature_cols}
    return pd.DataFrame([data], columns=feature_cols)


def _confidence_from_probability(probability: float, risk_flags: list[str]) -> float:
    base = abs(probability - 0.5) * 2.0
    penalty = 0.0
    if any(flag.startswith("ANOMALY") for flag in risk_flags):
        penalty += 0.15
    if any(flag.startswith("DRIFT_ALERT") for flag in risk_flags):
        penalty += 0.10
    if any(flag.startswith("DRIFT_DANGER") for flag in risk_flags):
        penalty += 0.20
    return float(np.clip(base - penalty, 0.0, 1.0))


def predict_market_probability(
    input_data: dict[str, Any],
    history: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """Predict upward next-session move probability with risk controls."""
    t0 = time.monotonic()

    try:
        _CACHE.load()
    except Exception as exc:
        log.error("Model load failed: %s", exc)
        return {
            "probability": 0.5,
            "confidence": 0.0,
            "raw_score": 0.5,
            "signal": "NEUTRAL",
            "risk_flags": [f"MODEL_LOAD_ERROR: {type(exc).__name__}"],
        }

    try:
        x_raw = _build_feature_row(input_data, _CACHE.feature_columns, history)
        x = _CACHE.preprocessor.transform(x_raw)

        x_for_model = x.toarray() if sparse.issparse(x) else x

        # ── Check for NaN/inf in transformed features ────────────────
        if np.any(~np.isfinite(x_for_model)):
            nan_count = int(np.sum(~np.isfinite(x_for_model)))
            x_for_model = np.nan_to_num(x_for_model, nan=0.0, posinf=0.0, neginf=0.0)
            log.warning("Replaced %d NaN/inf values in feature vector", nan_count)

        raw_score = float(_CACHE.model.predict_proba(x_for_model)[0, 1])
        probability = float(np.clip(raw_score, PROB_CLIP_LOW, PROB_CLIP_HIGH))

        risk_flags: list[str] = []

        # ── INPUT_OUTLIER detection via anomaly detector ──────────────
        if _CACHE.anomaly_detector is not None:
            ad_score = float(_CACHE.anomaly_detector.decision_function(x_for_model)[0])
            if ad_score < 0:
                risk_flags.append(f"INPUT_OUTLIER: decision_score={ad_score:.4f}")

        # ── Drift monitoring ─────────────────────────────────────────
        _CACHE.drift_detector.update(probability)
        drift_status = _CACHE.drift_detector.status()
        if drift_status:
            risk_flags.append(drift_status)
            if "DANGER" in drift_status:
                risk_flags.append("DATA_DRIFT")

        confidence = _confidence_from_probability(probability, risk_flags)

        # ── LOW_CONFIDENCE flag ──────────────────────────────────────
        if confidence < LOW_CONFIDENCE_THRESHOLD:
            risk_flags.append("LOW_CONFIDENCE")

        if probability >= 0.55:
            signal = "BUY"
        elif probability <= 0.45:
            signal = "SELL"
        else:
            signal = "NEUTRAL"

        elapsed_ms = (time.monotonic() - t0) * 1000
        log.info(
            "predict symbol=%s prob=%.4f conf=%.4f signal=%s flags=%s latency=%.1fms",
            input_data.get("symbol", "?"),
            probability,
            confidence,
            signal,
            risk_flags,
            elapsed_ms,
        )

        return {
            "probability": round(probability, 6),
            "confidence": round(confidence, 6),
            "raw_score": round(raw_score, 6),
            "signal": signal,
            "risk_flags": risk_flags,
        }

    except Exception as exc:
        log.error("Prediction failed: %s", exc, exc_info=True)
        return {
            "probability": 0.5,
            "confidence": 0.0,
            "raw_score": 0.5,
            "signal": "NEUTRAL",
            "risk_flags": [f"MODEL_ERROR: {type(exc).__name__}"],
        }


def predict_batch(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [predict_market_probability(item) for item in items]


if __name__ == "__main__":
    sample = {
        "symbol": "AAPL",
        "market": "US",
        "date": "2020-04-01",
        "open": 246.5,
        "high": 248.7,
        "low": 241.0,
        "close": 244.5,
        "prev_close": 240.9,
        "volume": 124_000_000,
    }

    result = predict_market_probability(sample)
    print(result)
