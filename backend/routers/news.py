from fastapi import APIRouter, Query
from typing import Optional

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
    # TODO: Этап 5 — NewsAPI + sentiment
    return {"country": country, "topic": topic, "articles": [], "status": "not_implemented"}


@router.get("/sentiment/{country_code}")
async def get_country_sentiment(country_code: str):
    """
    Тональный индекс страны из GDELT.
    """
    # TODO: Этап 5 — GDELT API
    return {"country_code": country_code, "sentiment": None, "status": "not_implemented"}
