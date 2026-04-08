from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from services.world_bank import fetch_indicator, fetch_country_details, INDICATORS

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
