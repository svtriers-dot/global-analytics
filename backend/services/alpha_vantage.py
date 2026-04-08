"""
Сервис Alpha Vantage — котировки акций и forex.
Документация: https://www.alphavantage.co/documentation/

Бесплатный tier: 25 запросов/день, 5 запросов/мин.
Без ALPHA_VANTAGE_API_KEY возвращает пустые данные.
"""

import httpx
import logging
from datetime import datetime
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alphavantage.co/query"

# Форекс-пары, которые отслеживаем по умолчанию
DEFAULT_FOREX_PAIRS = [
    ("USD", "EUR"),
    ("USD", "CNY"),
    ("USD", "RUB"),
    ("USD", "GBP"),
    ("USD", "JPY"),
]

# Популярные индексы / акции
DEFAULT_SYMBOLS = ["SPY", "EEM", "GLD", "USO"]


def _is_configured() -> bool:
    return bool(settings.ALPHA_VANTAGE_API_KEY)


async def fetch_forex_timeseries(
    from_symbol: str,
    to_symbol: str,
    period: str = "1y",
) -> dict:
    """
    Исторические данные курса валюты.
    period: '1m' | '1y' | '5y'
    """
    if not _is_configured():
        return _empty_response(f"{from_symbol}/{to_symbol}", period, "alpha_vantage_key_missing")

    # Выбираем функцию в зависимости от периода
    if period == "1m":
        function = "FX_DAILY"
        output_size = "compact"   # последние 100 точек
    else:
        function = "FX_WEEKLY"
        output_size = "full"

    params = {
        "function": function,
        "from_symbol": from_symbol,
        "to_symbol": to_symbol,
        "outputsize": output_size,
        "apikey": settings.ALPHA_VANTAGE_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        if "Error Message" in data or "Note" in data:
            msg = data.get("Error Message") or data.get("Note", "rate limit or error")
            logger.warning("Alpha Vantage forex error: %s", msg)
            return _empty_response(f"{from_symbol}/{to_symbol}", period, msg)

        # Парсим ответ
        key = "Time Series FX (Daily)" if function == "FX_DAILY" else "Time Series FX (Weekly)"
        raw_series = data.get(key, {})

        series = []
        for date_str, values in sorted(raw_series.items()):
            series.append({
                "date": date_str,
                "open":  float(values.get("1. open", 0)),
                "high":  float(values.get("2. high", 0)),
                "low":   float(values.get("3. low", 0)),
                "close": float(values.get("4. close", 0)),
            })

        # Обрезаем по периоду
        series = _trim_by_period(series, period)

        return {
            "symbol": f"{from_symbol}/{to_symbol}",
            "type": "forex",
            "period": period,
            "unit": to_symbol,
            "series": series,
            "source": "alpha_vantage",
        }

    except httpx.HTTPError as e:
        logger.error("Alpha Vantage HTTP error: %s", e)
        return _empty_response(f"{from_symbol}/{to_symbol}", period, str(e))


async def fetch_stock_timeseries(symbol: str, period: str = "1y") -> dict:
    """
    Исторические данные акции/ETF.
    """
    if not _is_configured():
        return _empty_response(symbol, period, "alpha_vantage_key_missing")

    if period == "1m":
        function = "TIME_SERIES_DAILY"
        output_size = "compact"
    else:
        function = "TIME_SERIES_WEEKLY"
        output_size = "full"

    params = {
        "function": function,
        "symbol": symbol,
        "outputsize": output_size,
        "apikey": settings.ALPHA_VANTAGE_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        if "Error Message" in data or "Note" in data:
            msg = data.get("Error Message") or data.get("Note", "rate limit or error")
            logger.warning("Alpha Vantage stock error: %s", msg)
            return _empty_response(symbol, period, msg)

        key = "Time Series (Daily)" if function == "TIME_SERIES_DAILY" else "Weekly Time Series"
        raw_series = data.get(key, {})

        series = []
        for date_str, values in sorted(raw_series.items()):
            series.append({
                "date":   date_str,
                "open":   float(values.get("1. open", 0)),
                "high":   float(values.get("2. high", 0)),
                "low":    float(values.get("3. low", 0)),
                "close":  float(values.get("4. close", 0)),
                "volume": int(float(values.get("5. volume", 0))),
            })

        series = _trim_by_period(series, period)

        return {
            "symbol": symbol,
            "type": "stock",
            "period": period,
            "unit": "USD",
            "series": series,
            "source": "alpha_vantage",
        }

    except httpx.HTTPError as e:
        logger.error("Alpha Vantage HTTP error: %s", e)
        return _empty_response(symbol, period, str(e))


def _trim_by_period(series: list, period: str) -> list:
    """Оставляем только точки в нужном периоде."""
    from datetime import timedelta
    now = datetime.utcnow()
    if period == "1m":
        cutoff = now - timedelta(days=31)
    elif period == "1y":
        cutoff = now - timedelta(days=365)
    else:  # 5y
        cutoff = now - timedelta(days=365 * 5)

    return [
        p for p in series
        if datetime.strptime(p["date"], "%Y-%m-%d") >= cutoff
    ]


def _empty_response(symbol: str, period: str, reason: str) -> dict:
    return {
        "symbol": symbol,
        "type": "unknown",
        "period": period,
        "unit": "",
        "series": [],
        "source": "alpha_vantage",
        "error": reason,
    }
