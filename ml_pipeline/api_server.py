"""
PumpX — ML Microservice
FastAPI server exposing predict_market_probability() over HTTP.

Startup: uvicorn api_server:app --host 0.0.0.0 --port 8001 --workers 1
Or:       python api_server.py
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from functools import lru_cache
from typing import Any

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

# Import the singleton inference engine
from predict import predict_market_probability, _CACHE, PROB_CLIP_LOW, PROB_CLIP_HIGH

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ml_service")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PumpX ML Prediction Service",
    description="Probabilistic market prediction microservice",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── In-process cache (60 s TTL) ───────────────────────────────────────────────
_PREDICTION_CACHE: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 60.0  # seconds


def _cache_key(data: dict) -> str:
    """Stable hash for input dict (excludes ephemeral date fields)."""
    stable = {k: v for k, v in sorted(data.items()) if k != "date"}
    return hashlib.md5(json.dumps(stable, sort_keys=True, default=str).encode()).hexdigest()


def _get_cached(key: str) -> dict | None:
    if key in _PREDICTION_CACHE:
        result, ts = _PREDICTION_CACHE[key]
        if time.monotonic() - ts < CACHE_TTL:
            return result
        del _PREDICTION_CACHE[key]
    return None


def _set_cached(key: str, result: dict) -> None:
    # Evict oldest entries if cache grows too large
    if len(_PREDICTION_CACHE) > 500:
        oldest = min(_PREDICTION_CACHE, key=lambda k: _PREDICTION_CACHE[k][1])
        del _PREDICTION_CACHE[oldest]
    _PREDICTION_CACHE[key] = (result, time.monotonic())


# ── Input Models ──────────────────────────────────────────────────────────────
_FALLBACK = {
    "probability": 0.5,
    "confidence": 0.0,
    "raw_score": 0.5,
    "signal": "NEUTRAL",
    "risk_flags": ["MODEL_UNAVAILABLE"],
}


def _safe_float(v: Any, default: float = 0.0) -> float:
    """Convert value to float, replacing NaN/inf with default."""
    try:
        f = float(v)
        if not np.isfinite(f):
            return default
        return f
    except Exception:
        return default


def _sanitize_input(data: dict) -> dict:
    """Replace NaN/inf in all numeric fields, reject completely malformed input."""
    numeric_keys = [
        "close", "open", "high", "low", "prev_close", "volume",
        "adj_close", "vwap", "turnover", "trades", "deliv_volume",
        "pct_deliv", "market_return_1d", "market_up_ratio",
    ]
    sanitized = dict(data)
    for k in numeric_keys:
        if k in sanitized:
            sanitized[k] = _safe_float(sanitized[k])
    # Enforce string fields
    for k in ["symbol", "market", "source", "series", "date"]:
        if k in sanitized and not isinstance(sanitized[k], str):
            sanitized[k] = str(sanitized[k])
    return sanitized


class PredictRequest(BaseModel):
    symbol: str = "UNKNOWN"
    market: str = "US"
    date: str | None = None
    source: str = "api"
    series: str = "COMMON"

    # Price fields — all optional with safe defaults
    close: float | None = None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    prev_close: float | None = None
    adj_close: float | None = None
    volume: float | None = None
    vwap: float | None = None
    turnover: float | None = None
    trades: float | None = None
    deliv_volume: float | None = None
    pct_deliv: float | None = None
    market_return_1d: float | None = None
    market_up_ratio: float | None = None

    @field_validator("close", "open", "high", "low", "prev_close", "volume",
                     "adj_close", "vwap", "turnover", "trades", "deliv_volume",
                     "pct_deliv", "market_return_1d", "market_up_ratio",
                     mode="before")
    @classmethod
    def sanitize_float(cls, v: Any) -> float | None:
        if v is None:
            return None
        try:
            f = float(v)
            return f if np.isfinite(f) else None
        except Exception:
            return None

    def to_input_dict(self) -> dict:
        return {k: v for k, v in self.model_dump().items() if v is not None}


class BatchPredictRequest(BaseModel):
    items: list[PredictRequest]

    @field_validator("items")
    @classmethod
    def limit_batch(cls, v: list) -> list:
        if len(v) > 100:
            raise ValueError("Batch size cannot exceed 100 items")
        return v


# ── Lifespan: pre-warm model ──────────────────────────────────────────────────
@app.on_event("startup")
async def load_model() -> None:
    log.info("Pre-warming model artifacts…")
    try:
        _CACHE.load()
        log.info("Model loaded successfully. Feature count: %d", len(_CACHE.feature_columns))
    except Exception as exc:
        log.error("Model failed to load: %s", exc)
        # Server starts anyway — /predict returns fallback


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    """Model health check."""
    model_ok = _CACHE.loaded
    drift_info: dict = {}
    if model_ok:
        psi = _CACHE.drift_detector.psi()
        status = _CACHE.drift_detector.status()
        drift_info = {
            "psi": round(psi, 4) if psi is not None else None,
            "status": status,
            "window_size": len(_CACHE.drift_detector.window),
            "window_capacity": _CACHE.drift_detector.window.maxlen,
        }

    return {
        "status": "ok" if model_ok else "degraded",
        "model_loaded": model_ok,
        "model_type": type(_CACHE.model).__name__ if model_ok else None,
        "feature_count": len(_CACHE.feature_columns) if model_ok else 0,
        "cache_size": len(_PREDICTION_CACHE),
        "drift": drift_info,
        "timestamp": time.time(),
    }


@app.get("/drift")
async def drift_status() -> dict:
    """Detailed drift detector state."""
    if not _CACHE.loaded:
        raise HTTPException(503, "Model not loaded")

    psi = _CACHE.drift_detector.psi()
    status = _CACHE.drift_detector.status()
    window_vals = list(_CACHE.drift_detector.window)

    return {
        "psi": round(psi, 4) if psi is not None else None,
        "status": status,
        "alert_threshold": _CACHE.drift_detector.alert_threshold,
        "danger_threshold": _CACHE.drift_detector.danger_threshold,
        "window_size": len(window_vals),
        "window_capacity": _CACHE.drift_detector.window.maxlen,
        "recent_window_mean": round(float(np.mean(window_vals)), 4) if window_vals else None,
        "recent_window_std": round(float(np.std(window_vals)), 4) if window_vals else None,
        "is_degrading": status is not None and "DANGER" in status,
        "ready": len(window_vals) >= _CACHE.drift_detector.window.maxlen,
    }


@app.get("/artifacts")
async def list_artifacts() -> dict:
    """List dynamically discovered model artifacts. Admin introspection only — no model internals."""
    if not _CACHE.loaded:
        return {"status": "not_loaded", "artifacts": []}

    return {
        "status": "loaded",
        "model_type": type(_CACHE.model).__name__,
        "feature_count": len(_CACHE.feature_columns),
        "artifacts": [
            {"name": a["name"], "size_bytes": a["size_bytes"]}
            for a in _CACHE.artifact_manifest
        ],
    }


@app.post("/predict")
async def predict_single(req: PredictRequest, request: Request) -> dict:
    """
    Single market prediction.
    Returns: { probability, confidence, raw_score, signal, risk_flags, cached, latency_ms }
    """
    t0 = time.monotonic()
    input_dict = req.to_input_dict()
    sanitized = _sanitize_input(input_dict)

    # Cache lookup
    key = _cache_key(sanitized)
    cached = _get_cached(key)
    if cached:
        return {**cached, "cached": True, "latency_ms": round((time.monotonic() - t0) * 1000, 1)}

    # Guard: max 200ms budget
    try:
        result = predict_market_probability(sanitized)
    except Exception as exc:
        log.warning("Prediction error for %s: %s", sanitized.get("symbol", "?"), exc)
        result = dict(_FALLBACK)
        result["risk_flags"] = [f"MODEL_ERROR: {type(exc).__name__}"]

    # Add LOW_CONFIDENCE flag
    if result["confidence"] < 0.3:
        if "LOW_CONFIDENCE" not in result["risk_flags"]:
            result["risk_flags"].append("LOW_CONFIDENCE")

    latency_ms = round((time.monotonic() - t0) * 1000, 1)
    log.info(
        "predict symbol=%s prob=%.4f conf=%.4f signal=%s flags=%s latency=%.1fms",
        sanitized.get("symbol", "?"),
        result["probability"],
        result["confidence"],
        result["signal"],
        result["risk_flags"],
        latency_ms,
    )

    _set_cached(key, result)
    return {**result, "cached": False, "latency_ms": latency_ms}


@app.post("/predict/batch")
async def predict_batch(req: BatchPredictRequest) -> dict:
    """Batch prediction — up to 100 items."""
    t0 = time.monotonic()
    results = []
    for item in req.items:
        input_dict = _sanitize_input(item.to_input_dict())
        key = _cache_key(input_dict)
        cached = _get_cached(key)
        if cached:
            results.append({**cached, "cached": True})
            continue
        try:
            r = predict_market_probability(input_dict)
            if r["confidence"] < 0.3 and "LOW_CONFIDENCE" not in r["risk_flags"]:
                r["risk_flags"].append("LOW_CONFIDENCE")
        except Exception as exc:
            log.warning("Batch prediction error: %s", exc)
            r = dict(_FALLBACK)
        _set_cached(key, r)
        results.append({**r, "cached": False})

    return {
        "results": results,
        "count": len(results),
        "total_latency_ms": round((time.monotonic() - t0) * 1000, 1),
    }


@app.get("/")
async def root() -> dict:
    return {"service": "PumpX ML Prediction Service", "version": "1.0.0", "docs": "/docs"}


# ── Error Handler ─────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Internal server error", "detail": str(exc)})


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("ML_SERVICE_PORT", "8001"))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=False, log_level="info")
