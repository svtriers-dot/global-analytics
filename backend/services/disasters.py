"""
Сервис стихийных бедствий и природных катастроф.

Источники:
- USGS Earthquake Hazards Program (бесплатно, без ключа)
  https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
- GDACS (Global Disaster Alert and Coordination System)
  https://www.gdacs.org/gdacsapi/

Кеш в памяти (TTL 30 мин) — данные не меняются чаще.
"""

import httpx
import time
from typing import Optional

# Простой in-memory кеш: (data, timestamp)
_cache: dict[str, tuple[dict | list, float]] = {}
CACHE_TTL = 30 * 60  # 30 минут


def _cached(key: str) -> Optional[dict | list]:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cache(key: str, data: dict | list) -> None:
    _cache[key] = (data, time.time())


async def fetch_earthquakes(min_magnitude: float = 4.5) -> dict:
    """
    Землетрясения за последние 30 дней (USGS GeoJSON feed).
    Возвращает оригинальный GeoJSON — фронтенд рендерит его напрямую.
    """
    cache_key = f"earthquakes_{min_magnitude}"
    cached = _cached(cache_key)
    if cached is not None:
        return cached  # type: ignore

    # USGS предоставляет готовые фиды по порогам магнитуды
    if min_magnitude >= 7.0:
        feed = "7.0_month"
    elif min_magnitude >= 6.0:
        feed = "significant_month"
    else:
        feed = "4.5_month"

    url = f"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{feed}.geojson"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

    # Упрощаем: оставляем только нужные поля для маркеров
    features = []
    for f in data.get("features", []):
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            continue
        mag = props.get("mag")
        if mag is None or mag < min_magnitude:
            continue
        features.append({
            "lon":   coords[0],
            "lat":   coords[1],
            "depth": coords[2] if len(coords) > 2 else None,
            "mag":   round(mag, 1),
            "place": props.get("place", ""),
            "time":  props.get("time"),
            "url":   props.get("url", ""),
        })

    result = {
        "count":    len(features),
        "events":   features,
        "source":   "USGS Earthquake Hazards Program",
        "feed":     feed,
    }
    _set_cache(cache_key, result)
    return result


async def fetch_gdacs_events() -> dict:
    """
    Активные стихийные бедствия из GDACS (ураганы, наводнения, засухи).
    Только оранжевые и красные алерты (серьёзные события).
    """
    cache_key = "gdacs_events"
    cached = _cached(cache_key)
    if cached is not None:
        return cached  # type: ignore

    url = (
        "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
        "?eventlist=TC,FL,DR,VO&alertlevel=Red,Orange&limit=100"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            raw = response.json()

        events = []
        for f in raw.get("features", []):
            props  = f.get("properties", {})
            coords = f.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue

            event_type = props.get("eventtype", "")
            type_labels = {"TC": "Тропический шторм", "FL": "Наводнение",
                           "DR": "Засуха", "VO": "Вулкан", "EQ": "Землетрясение"}

            events.append({
                "lon":        coords[0],
                "lat":        coords[1],
                "type":       event_type,
                "type_label": type_labels.get(event_type, event_type),
                "name":       props.get("eventname", ""),
                "alert":      props.get("alertlevel", ""),
                "country":    props.get("country", ""),
                "from_date":  props.get("fromdate", ""),
                "url":        props.get("url", ""),
            })

        result = {"count": len(events), "events": events, "source": "GDACS"}
        _set_cache(cache_key, result)
        return result

    except Exception as e:
        # GDACS иногда недоступен — возвращаем пустой ответ, не падаем
        return {"count": 0, "events": [], "source": "GDACS", "error": str(e)}
