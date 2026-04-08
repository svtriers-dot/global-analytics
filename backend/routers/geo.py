from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from services.world_bank import (
    fetch_indicator, fetch_country_details, fetch_country_history,
    fetch_all_countries, fetch_compare_series, fetch_compare_summary,
    INDICATORS,
)

router = APIRouter()


@router.get("/indicators")
async def list_indicators():
    """Список доступных индикаторов для тепловой карты."""
    return [
        {"code": code, **meta}
        for code, meta in INDICATORS.items()
    ]


@router.get("/map-data")
async def get_map_data(
    indicator: str = Query("NY.GDP.PCAP.CD", description="Код индикатора World Bank"),
    year: Optional[int] = Query(None, description="Год (по умолчанию — последний доступный)"),
):
    """
    Данные для тепловой карты: значение по каждой стране + min/max для градиента.
    """
    if indicator not in INDICATORS:
        raise HTTPException(
            status_code=400,
            detail=f"Неизвестный индикатор. Доступные: {list(INDICATORS.keys())}"
        )
    return await fetch_indicator(indicator, year)


@router.get("/country/{country_iso2}")
async def get_country_card(country_iso2: str):
    """
    Карточка страны: несколько ключевых показателей.
    country_iso2 — двухбуквенный ISO-код (US, DE, CN...).
    """
    if len(country_iso2) != 2:
        raise HTTPException(status_code=400, detail="Нужен ISO2-код страны (2 буквы)")
    return await fetch_country_details(country_iso2.upper())


@router.get("/countries")
async def list_countries():
    """Список всех стран (ISO2, название, регион) для селектора сравнения."""
    return await fetch_all_countries()


@router.get("/compare")
async def get_compare_series(
    countries: str = Query(..., description="ISO2-коды через запятую: US,DE,CN"),
    indicator: str = Query("NY.GDP.PCAP.CD", description="Код индикатора World Bank"),
    years: int = Query(10, ge=1, le=30, description="Глубина истории в годах"),
):
    """
    Временные ряды одного индикатора для нескольких стран.
    Используется для сравнительного мультилинейного графика.
    """
    country_list = [c.strip().upper() for c in countries.split(",") if c.strip()]
    if len(country_list) < 2:
        raise HTTPException(status_code=400, detail="Нужно минимум 2 страны")
    if len(country_list) > 5:
        raise HTTPException(status_code=400, detail="Максимум 5 стран")
    if indicator not in INDICATORS:
        raise HTTPException(
            status_code=400,
            detail=f"Неизвестный индикатор. Доступные: {list(INDICATORS.keys())}"
        )
    return await fetch_compare_series(country_list, indicator, years)


@router.get("/compare/summary")
async def get_compare_summary(
    countries: str = Query(..., description="ISO2-коды через запятую: US,DE,CN"),
):
    """
    Сводная таблица ключевых показателей для нескольких стран (side-by-side).
    """
    country_list = [c.strip().upper() for c in countries.split(",") if c.strip()]
    if len(country_list) < 2:
        raise HTTPException(status_code=400, detail="Нужно минимум 2 страны")
    if len(country_list) > 5:
        raise HTTPException(status_code=400, detail="Максимум 5 стран")
    return await fetch_compare_summary(country_list)


@router.get("/country/{country_iso2}/history/{indicator}")
async def get_country_history(
    country_iso2: str,
    indicator: str,
    years: int = Query(10, ge=1, le=30, description="Глубина истории в годах"),
):
    """
    Временной ряд одного индикатора для одной страны.
    Используется виджетами дашборда (линейный график).
    """
    if len(country_iso2) != 2:
        raise HTTPException(status_code=400, detail="Нужен ISO2-код страны (2 буквы)")
    if indicator not in INDICATORS:
        raise HTTPException(
            status_code=400,
            detail=f"Неизвестный индикатор. Доступные: {list(INDICATORS.keys())}"
        )
    return await fetch_country_history(country_iso2.upper(), indicator, years)
