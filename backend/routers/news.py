from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Literal
from services import gdelt as gdelt_service

router = APIRouter()


@router.get("/feed")
async def get_news_feed(
    country: Optional[str] = Query(None, description="Код страны ISO2 (напр. US, DE, CN)"),
    topic: Optional[str] = Query(None, description="Тема (finance, economy, trade...)"),
    limit: int = Query(20, le=100),
):
    """
    Новостная лента.
    Этап 5: NewsAPI + тональный анализ.
    """
    # TODO: Этап 5 — NewsAPI
    return {"country": country, "topic": topic, "articles": [], "status": "coming_in_stage_5"}


@router.get("/sentiment/{country_code}")
async def get_country_sentiment(
    country_code: str,
    timespan: Literal["LAST24H", "LAST7D", "LAST30D", "LAST90D"] = Query(
        "LAST7D", description="Период анализа"
    ),
):
    """
    Тональный индекс новостей по стране из GDELT.
    Работает без API ключа. country_code — ISO2 (US, DE) или ISO3 (USA, DEU).
    """
    code = country_code.upper()

    # Конвертируем ISO3 → ISO2 если нужно
    if len(code) == 3:
        iso2 = gdelt_service.iso3_to_iso2(code)
        if not iso2:
            raise HTTPException(
                status_code=400,
                detail=f"Неизвестный ISO3-код: {code}. Используйте ISO2 (US, DE, CN...)"
            )
        code = iso2

    if len(code) != 2:
        raise HTTPException(status_code=400, detail="Нужен ISO2-код (2 буквы) или ISO3-код (3 буквы)")

    return await gdelt_service.fetch_country_sentiment(code, timespan)


@router.get("/sentiment")
async def get_all_sentiment(
    timespan: Literal["LAST24H", "LAST7D", "LAST30D"] = Query("LAST7D"),
):
    """
    Тональность новостей для всех стран — используется для слоя тепловой карты.
    """
    return await gdelt_service.fetch_all_countries_sentiment(timespan)
