"""
Сервис FRED (Federal Reserve Economic Data).
Документация: https://fred.stlouisfed.org/docs/api/fred/

Бесплатный API key: https://fred.stlouisfed.org/docs/api/api_key.html
Без FRED_API_KEY возвращает пустые данные.
"""

import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.stlouisfed.org/fred"

# Ключевые ряды FRED
SERIES = {
    "FEDFUNDS":  {"label": "Fed Funds Rate",          "unit": "%",  "country": "USA"},
    "DFF":       {"label": "Eff. Federal Funds Rate", "unit": "%",  "country": "USA"},
    "T10YIE":    {"label": "10Y Breakeven Inflation",  "unit": "%",  "country": "USA"},
    "DGS10":     {"label": "10Y Treasury Yield",      "unit": "%",  "country": "USA"},
    "M2SL":      {"label": "M2 Money Supply",         "unit": "$B", "country": "USA"},
    "CPIAUCSL":  {"label": "CPI (US)",                "unit": "idx","country": "USA"},
    "UNRATE":    {"label": "Unemployment Rate (US)",  "unit": "%",  "country": "USA"},
    "ECBDFR":    {"label": "ECB Deposit Rate",        "unit": "%",  "country": "EUR"},
}


def _is_configured() -> bool:
    return bool(settings.FRED_API_KEY)


def _date_range(period: str) -> tuple[str, str]:
    end = datetime.utcnow()
    if period == "1m":
        start = end - timedelta(days=31)
    elif period == "1y":
        start = end - timedelta(days=365)
    else:  # 5y
        start = end - timedelta(days=365 * 5)
    fmt = "%Y-%m-%d"
    return start.strftime(fmt), end.strftime(fmt)


async def fetch_series(series_id: str, period: str = "1y") -> dict:
    """
    Загружает временной ряд из FRED по коду серии.
    """
    if not _is_configured():
        return _empty_response(series_id, period, "fred_key_missing")

    start_date, end_date = _date_range(period)
    params = {
        "series_id":         series_id,
        "observation_start": start_date,
        "observation_end":   end_date,
        "api_key":           settings.FRED_API_KEY,
        "file_type":         "json",
        "sort_order":        "asc",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{BASE_URL}/series/observations", params=params)
            resp.raise_for_status()
            data = resp.json()

        observations = data.get("observations", [])
        series = []
        for obs in observations:
            val_str = obs.get("value", ".")
            if val_str == ".":
                continue
            series.append({
                "date":  obs["date"],
                "value": float(val_str),
            })

        meta = SERIES.get(series_id, {"label": series_id, "unit": "", "country": None})
        return {
            "series_id": series_id,
            "label":     meta["label"],
            "unit":      meta["unit"],
            "country":   meta["country"],
            "period":    period,
            "series":    series,
            "source":    "fred",
        }

    except httpx.HTTPError as e:
        logger.error("FRED HTTP error: %s", e)
        return _empty_response(series_id, period, str(e))


async def fetch_rates_summary() -> list:
    """
    Загружает последние значения всех ключевых ставок.
    Используется для карточки страны и дашборда.
    """
    if not _is_configured():
        return []

    results = []
    key_series = ["FEDFUNDS", "DGS10", "ECBDFR", "T10YIE"]

    async with httpx.AsyncClient(timeout=15.0) as client:
        for sid in key_series:
            params = {
                "series_id":    sid,
                "api_key":      settings.FRED_API_KEY,
                "file_type":    "json",
                "sort_order":   "desc",
                "limit":        1,
            }
            try:
                resp = await client.get(f"{BASE_URL}/series/observations", params=params)
                data = resp.json()
                obs = data.get("observations", [])
                if obs and obs[0]["value"] != ".":
                    meta = SERIES.get(sid, {"label": sid, "unit": ""})
                    results.append({
                        "series_id": sid,
                        "label":     meta["label"],
                        "unit":      meta["unit"],
                        "value":     float(obs[0]["value"]),
                        "date":      obs[0]["date"],
                    })
            except Exception as e:
                logger.warning("FRED series %s error: %s", sid, e)

    return results


def list_series() -> list:
    """Список доступных серий с мета-данными."""
    return [
        {"series_id": sid, **meta}
        for sid, meta in SERIES.items()
    ]


def _empty_response(series_id: str, period: str, reason: str) -> dict:
    meta = SERIES.get(series_id, {"label": series_id, "unit": "", "country": None})
    return {
        "series_id": series_id,
        "label":     meta["label"],
        "unit":      meta["unit"],
        "period":    period,
        "series":    [],
        "source":    "fred",
        "error":     reason,
    }
