"""
Сервис для работы с World Bank Open Data API.
Документация: https://datahelpdesk.worldbank.org/knowledgebase/articles/898590
"""

import httpx
from typing import Optional
from core.config import settings

# Индикаторы которые поддерживаем на тепловой карте
INDICATORS = {
    "NY.GDP.PCAP.CD":  {"label": "ВВП на душу населения", "unit": "$"},
    "FP.CPI.TOTL.ZG":  {"label": "Инфляция", "unit": "%"},
    "SL.UEM.TOTL.ZS":  {"label": "Безработица", "unit": "%"},
    "SP.POP.TOTL":     {"label": "Население", "unit": ""},
    "NY.GDP.MKTP.CD":  {"label": "ВВП (всего)", "unit": "$"},
}


async def fetch_indicator(indicator_code: str, year: Optional[int] = None) -> dict:
    """
    Загружает данные по индикатору для всех стран.
    Возвращает dict с данными и min/max для цветовой шкалы.
    """
    url = f"{settings.WORLD_BANK_BASE_URL}/country/all/indicator/{indicator_code}"
    params = {
        "format": "json",
        "per_page": 400,   # все страны
        "mrv": 1,          # most recent value
    }
    if year:
        params["date"] = str(year)

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        raw = response.json()

    # World Bank всегда возвращает [metadata, data_array]
    if not isinstance(raw, list) or len(raw) < 2 or not raw[1]:
        return {"indicator": indicator_code, "data": [], "min": 0, "max": 0, "year": None}

    data = []
    for item in raw[1]:
        if item.get("value") is None:
            continue
        # Пропускаем агрегаты (регионы, группы стран)
        iso3 = item.get("countryiso3code", "")
        if not iso3 or len(iso3) != 3:
            continue

        data.append({
            "country_code": iso3,
            "country_name": item["country"]["value"],
            "value": round(float(item["value"]), 2),
            "year": item["date"],
        })

    if not data:
        return {"indicator": indicator_code, "data": [], "min": 0, "max": 0, "year": None}

    values = [d["value"] for d in data]
    min_val = round(min(values), 2)
    max_val = round(max(values), 2)
    latest_year = data[0]["year"] if data else None

    return {
        "indicator": indicator_code,
        "meta": INDICATORS.get(indicator_code, {"label": indicator_code, "unit": ""}),
        "year": latest_year,
        "min": min_val,
        "max": max_val,
        "data": data,
    }


async def fetch_country_details(country_iso2: str) -> dict:
    """
    Загружает несколько ключевых показателей для одной страны (карточка по клику).
    """
    indicator_codes = list(INDICATORS.keys())[:4]
    results = {}

    async with httpx.AsyncClient(timeout=15.0) as client:
        for code in indicator_codes:
            url = f"{settings.WORLD_BANK_BASE_URL}/country/{country_iso2}/indicator/{code}"
            params = {"format": "json", "mrv": 1, "per_page": 5}
            try:
                response = await client.get(url, params=params)
                raw = response.json()
                if isinstance(raw, list) and len(raw) > 1 and raw[1]:
                    item = raw[1][0]
                    if item.get("value") is not None:
                        results[code] = {
                            "label": INDICATORS[code]["label"],
                            "unit": INDICATORS[code]["unit"],
                            "value": round(float(item["value"]), 2),
                            "year": item["date"],
                        }
            except Exception:
                continue

    return {
        "country": country_iso2.upper(),
        "indicators": results,
    }
