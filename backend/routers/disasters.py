from fastapi import APIRouter, Query
from services.disasters import fetch_earthquakes, fetch_gdacs_events

router = APIRouter()


@router.get("/earthquakes")
async def get_earthquakes(
    min_magnitude: float = Query(4.5, ge=2.5, le=9.0,
                                  description="Минимальная магнитуда (по шкале Рихтера)"),
):
    """
    Землетрясения за последние 30 дней (USGS).
    Кеш 30 минут. Возвращает список событий с координатами и магнитудой.
    """
    return await fetch_earthquakes(min_magnitude)


@router.get("/events")
async def get_disaster_events():
    """
    Активные стихийные бедствия: ураганы, наводнения, засухи, вулканы (GDACS).
    Только оранжевые и красные алерты. Кеш 30 минут.
    """
    return await fetch_gdacs_events()
