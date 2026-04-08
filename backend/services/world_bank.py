"""
Сервис для работы с World Bank Open Data API.
Документация: https://datahelpdesk.worldbank.org/knowledgebase/articles/898590
"""

import httpx
from typing import Optional
from core.config import settings

# Коды World Bank для агрегатов/регионов — не являются отдельными странами.
# Их нет в GeoJSON, поэтому при матчинге они промахиваются и только
# искажают шкалу цвета.
_WB_AGGREGATE_ISO3 = {
    "AFE", "AFW", "ARB", "CSS", "CEB", "EAP", "EAR", "EAS", "ECA", "ECE", "ECS",
    "EMU", "EUU", "FCS", "HIC", "HPC", "IBD", "IBT", "IDA", "IDB", "IDX", "LAC",
    "LCN", "LDC", "LIC", "LMC", "LMY", "LTE", "MEA", "MIC", "MNA", "NAC", "OED",
    "OSS", "PRE", "PSS", "PST", "SAS", "SSA", "SSF", "SST", "TEA", "TEC", "TLA",
    "TMN", "TSA", "TSS", "UMC", "WLD",
}

# Индикаторы которые поддерживаем на тепловой карте
# scale: "log"    — логарифмическая шкала (ВВП, население — log-нормальное распределение)
#         "linear" — линейная шкала (инфляция, безработица — уже в узком диапазоне)
INDICATORS = {
    "NY.GDP.PCAP.CD":  {"label": "ВВП на душу населения", "unit": "$",  "scale": "log"},
    "FP.CPI.TOTL.ZG":  {"label": "Инфляция",              "unit": "%",  "scale": "linear"},
    "SL.UEM.TOTL.ZS":  {"label": "Безработица",            "unit": "%",  "scale": "linear"},
    "SP.POP.TOTL":     {"label": "Население",              "unit": "",   "scale": "log"},
    "NY.GDP.MKTP.CD":  {"label": "ВВП (всего)",            "unit": "$",  "scale": "log"},
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

        # Пропускаем агрегаты World Bank (регионы, группы стран)
        if iso3 in _WB_AGGREGATE_ISO3:
            continue

        data.append({
            "country_code": iso3,
            "country_name": item["country"]["value"],
            "value": round(float(item["value"]), 2),
            "year": item["date"],
        })

    if not data:
        return {"indicator": indicator_code, "data": [], "min": 0, "max": 0, "year": None}

    values = sorted([d["value"] for d in data])
    n = len(values)

    # Используем P5–P95 для шкалы цвета, чтобы выбросы (Monaco, Bermuda)
    # не сжимали все остальные страны в синий диапазон.
    p5  = round(values[max(0, int(n * 0.05))], 2)
    p95 = round(values[min(n - 1, int(n * 0.95))], 2)
    latest_year = data[0]["year"] if data else None

    meta = INDICATORS.get(indicator_code, {"label": indicator_code, "unit": "", "scale": "linear"})
    return {
        "indicator": indicator_code,
        "meta": meta,
        "year": latest_year,
        "min": p5,    # P5 вместо абсолютного min
        "max": p95,   # P95 вместо абсолютного max
        "data": data,
    }


async def fetch_country_history(
    country_iso2: str,
    indicator_code: str,
    years: int = 10,
) -> dict:
    """
    Временной ряд одного индикатора для одной страны.
    Используется виджетами дашборда (линейный график).
    """
    current_year = 2024
    start_year   = current_year - years
    date_range   = f"{start_year}:{current_year}"

    url = f"{settings.WORLD_BANK_BASE_URL}/country/{country_iso2}/indicator/{indicator_code}"
    params = {
        "format":   "json",
        "date":     date_range,
        "per_page": years + 5,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        raw = response.json()

    if not isinstance(raw, list) or len(raw) < 2 or not raw[1]:
        return {"indicator": indicator_code, "country": country_iso2, "series": []}

    series = []
    for item in sorted(raw[1], key=lambda x: x["date"]):
        if item.get("value") is None:
            continue
        series.append({
            "year":  item["date"],
            "value": round(float(item["value"]), 2),
        })

    meta = INDICATORS.get(indicator_code, {"label": indicator_code, "unit": ""})
    return {
        "indicator":    indicator_code,
        "label":        meta["label"],
        "unit":         meta["unit"],
        "country":      country_iso2.upper(),
        "series":       series,
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
