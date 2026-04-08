from fastapi import APIRouter, Query, HTTPException
from typing import Literal
from services import alpha_vantage as av_service
from services import fred as fred_service

router = APIRouter()


@router.get("/timeseries")
async def get_timeseries(
    symbol: str = Query(..., description="Форекс-пара или тикер (напр. USD/EUR, SPY)"),
    period: Literal["1m", "1y", "5y"] = Query("1y", description="Период"),
    type: Literal["forex", "stock"] = Query("forex", description="Тип инструмента"),
):
    """
    Временной ряд финансового инструмента из Alpha Vantage.
    Без ALPHA_VANTAGE_API_KEY возвращает пустой ряд с пояснением.
    """
    if type == "forex":
        parts = symbol.upper().replace("-", "/").split("/")
        if len(parts) != 2:
            raise HTTPException(
                status_code=400,
                detail="Для forex нужен формат FROM/TO (напр. USD/EUR)",
            )
        return await av_service.fetch_forex_timeseries(parts[0], parts[1], period)
    else:
        return await av_service.fetch_stock_timeseries(symbol.upper(), period)


@router.get("/rates")
async def get_interest_rates():
    """
    Последние значения ключевых процентных ставок (FRED).
    Без FRED_API_KEY возвращает пустой список.
    """
    return await fred_service.fetch_rates_summary()


@router.get("/series")
async def list_fred_series():
    """Список доступных серий FRED с метаданными."""
    return fred_service.list_series()


@router.get("/series/{series_id}")
async def get_fred_series(
    series_id: str,
    period: Literal["1m", "1y", "5y"] = Query("1y"),
):
    """
    Полный временной ряд из FRED по коду серии (напр. FEDFUNDS, DGS10).
    """
    series_id = series_id.upper()
    known_ids = [s["series_id"] for s in fred_service.list_series()]
    if series_id not in known_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Неизвестная серия. Доступные: {known_ids}",
        )
    return await fred_service.fetch_series(series_id, period)
