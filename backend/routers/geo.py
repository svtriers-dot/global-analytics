from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()


@router.get("/countries")
async def get_countries_data(
    indicator: str = Query("NY.GDP.PCAP.CD", description="Код индикатора World Bank"),
    year: Optional[int] = Query(None, description="Год (по умолчанию — последний доступный"),
):
    """
    Данные по странам для тепловой карты.
    Этап 1: здесь будет обращение к World Bank API и возврат GeoJSON.
    """
    # TODO: Этап 1 — подключить World Bank API
    return {
        "indicator": indicator,
        "year": year,
        "data": [],  # список {country_code, country_name, value}
        "status": "not_implemented",
    }


@router.get("/country/{country_code}")
async def get_country_details(country_code: str):
    """
    Детальная карточка страны по клику на карте.
    """
    # TODO: Этап 1 — агрегировать данные из World Bank + FRED
    return {
        "country_code": country_code,
        "indicators": {},
        "status": "not_implemented",
    }
