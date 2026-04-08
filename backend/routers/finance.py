from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()


@router.get("/timeseries")
async def get_timeseries(
    symbol: str = Query(..., description="Тикер или код (напр. USD/EUR, AAPL)"),
    period: str = Query("1y", description="Период: 1m | 1y | 5y"),
):
    """
    Временной ряд финансового инструмента.
    Этап 2: Alpha Vantage / Yahoo Finance.
    """
    # TODO: Этап 2 — подключить Alpha Vantage API
    return {"symbol": symbol, "period": period, "series": [], "status": "not_implemented"}


@router.get("/rates")
async def get_interest_rates(country: Optional[str] = Query(None)):
    """
    Процентные ставки из FRED.
    """
    # TODO: Этап 2 — FRED API
    return {"country": country, "rates": [], "status": "not_implemented"}
