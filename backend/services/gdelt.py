"""
Сервис GDELT v2 — тональность новостей по странам.
Документация: https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/

Бесплатный, без API ключа. Работает сразу.

Используем artlist API с JSON-форматом:
  https://api.gdeltproject.org/api/v2/doc/doc
  mode=artlist, format=json → список статей с полем `seendate`

Тональность вычисляем через GKG-сводку:
  https://api.gdeltproject.org/api/v2/summary/summary
  d=web, t=summary → JSON со средним тоном

Тональность: от -100 (крайне негативно) до +100 (крайне позитивно).
Обычный диапазон: -10..+5.
"""

import httpx
import asyncio
import logging
import time
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

DOC_URL     = "https://api.gdeltproject.org/api/v2/doc/doc"
SUMMARY_URL = "https://api.gdeltproject.org/api/v2/summary/summary"

# In-memory TTL cache: key → (timestamp, data)
# Предотвращает повторные запросы к GDELT при rate limit
_cache: dict = {}
_CACHE_TTL = 3600  # 1 час


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: str, value):
    _cache[key] = (time.time(), value)

# Маппинг ISO3 → ISO2 для запросов к GDELT (использует ISO2)
_ISO3_TO_ISO2 = {
    "USA": "US", "GBR": "GB", "DEU": "DE", "FRA": "FR", "CHN": "CN",
    "JPN": "JP", "RUS": "RU", "BRA": "BR", "IND": "IN", "CAN": "CA",
    "AUS": "AU", "KOR": "KR", "MEX": "MX", "IDN": "ID", "TUR": "TR",
    "SAU": "SA", "ARG": "AR", "ZAF": "ZA", "NGA": "NG", "EGY": "EG",
    "POL": "PL", "UKR": "UA", "NLD": "NL", "CHE": "CH", "SWE": "SE",
    "NOR": "NO", "DNK": "DK", "FIN": "FI", "AUT": "AT", "BEL": "BE",
    "ESP": "ES", "ITA": "IT", "PRT": "PT", "GRC": "GR", "CZE": "CZ",
    "HUN": "HU", "ROU": "RO", "BGR": "BG", "HRV": "HR", "SVK": "SK",
    "ISR": "IL", "ARE": "AE", "IRN": "IR", "IRQ": "IQ", "PAK": "PK",
    "BGD": "BD", "VNM": "VN", "THA": "TH", "MYS": "MY", "SGP": "SG",
    "PHL": "PH", "NZL": "NZ", "CHL": "CL", "COL": "CO", "PER": "PE",
    "VEN": "VE", "AGO": "AO", "ETH": "ET", "KEN": "KE", "TZA": "TZ",
    "GHA": "GH", "CMR": "CM", "CIV": "CI", "MDG": "MG", "MOZ": "MZ",
}

# Полные названия стран для более точных запросов к GDELT
_ISO2_TO_NAME = {
    "US": "United States", "GB": "United Kingdom", "DE": "Germany",
    "FR": "France", "CN": "China", "JP": "Japan", "RU": "Russia",
    "BR": "Brazil", "IN": "India", "CA": "Canada", "AU": "Australia",
    "KR": "South Korea", "MX": "Mexico", "ID": "Indonesia", "TR": "Turkey",
    "SA": "Saudi Arabia", "AR": "Argentina", "ZA": "South Africa",
    "PL": "Poland", "UA": "Ukraine", "NL": "Netherlands",
    "ES": "Spain", "IT": "Italy", "SE": "Sweden", "NO": "Norway",
    "CH": "Switzerland", "IL": "Israel", "AE": "UAE", "EG": "Egypt",
}


async def _fetch_with_retry(client: httpx.AsyncClient, url: str, params: dict, retries: int = 2) -> httpx.Response:
    """Выполняет запрос с повтором при 429 (rate limit)."""
    for attempt in range(retries + 1):
        try:
            resp = await client.get(url, params=params)
            if resp.status_code == 429:
                if attempt < retries:
                    wait = 3 * (attempt + 1)
                    logger.warning("GDELT 429, retry in %ds...", wait)
                    await asyncio.sleep(wait)
                    continue
                resp.raise_for_status()
            return resp
        except httpx.TimeoutException:
            if attempt < retries:
                await asyncio.sleep(2)
                continue
            raise
    return resp


async def fetch_country_sentiment(
    country_iso2: str,
    timespan: str = "LAST7D",
) -> dict:
    """
    Тональный индекс новостей для страны за указанный период.
    Результат кешируется на 1 час чтобы не получать rate limit.

    country_iso2 — двухбуквенный ISO код (US, DE, CN...)
    timespan     — LAST24H | LAST7D | LAST30D | LAST90D
    """
    iso2 = country_iso2.upper()
    cache_key = f"sentiment:{iso2}:{timespan}"
    cached = _cache_get(cache_key)
    if cached:
        return {**cached, "cached": True}

    country_name = _ISO2_TO_NAME.get(iso2, iso2)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # Запрос к Summary API для получения тональности
            summary_params = {
                "d": "web",
                "t": "summary",
                "q": country_name,
                "timespan": timespan,
                "output": "json",
            }
            resp = await _fetch_with_retry(client, SUMMARY_URL, summary_params)

            data = resp.json()

            # Summary API возвращает объект с полями tone, numArticles и т.д.
            avg_tone = None
            total_articles = 0

            if isinstance(data, dict):
                # Пробуем разные поля в зависимости от версии ответа
                avg_tone = data.get("avgtone") or data.get("tone") or data.get("avgTone")
                total_articles = int(data.get("numArticles") or data.get("articles") or 0)

            if avg_tone is None:
                # Fallback: artlist чтобы хотя бы посчитать статьи
                artlist_params = {
                    "query": f"sourcecountry:{iso2}",
                    "mode": "artlist",
                    "format": "json",
                    "maxrecords": "10",
                    "timespan": timespan,
                }
                resp2 = await _fetch_with_retry(client, DOC_URL, artlist_params)
                try:
                    d2 = resp2.json()
                    articles = d2.get("articles", [])
                    total_articles = len(articles)
                except Exception:
                    total_articles = 0

            if avg_tone is not None:
                avg_tone = round(float(avg_tone), 2)

            result = {
                "country_iso2":    iso2,
                "timespan":        timespan,
                "avg_tone":        avg_tone,
                "total_articles":  total_articles,
                "sentiment_label": _tone_label(avg_tone) if avg_tone is not None else "unknown",
                "source":          "gdelt",
            }
            _cache_set(cache_key, result)
            return result

    except httpx.HTTPStatusError as e:
        logger.error("GDELT HTTP error for %s: %s", iso2, e)
        return _empty_sentiment(iso2, timespan, f"HTTP {e.response.status_code}")
    except Exception as e:
        logger.error("GDELT error for %s: %s", iso2, e)
        return _empty_sentiment(iso2, timespan, str(e))


async def fetch_all_countries_sentiment(timespan: str = "LAST7D") -> list:
    """
    Тональность для набора ключевых стран (для слоя на тепловой карте).
    Запросы с паузой между ними чтобы не получить rate limit.
    """
    countries = list(_ISO2_TO_NAME.keys())
    results = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        for iso2 in countries:
            country_name = _ISO2_TO_NAME[iso2]
            params = {
                "d": "web",
                "t": "summary",
                "q": country_name,
                "timespan": timespan,
                "output": "json",
            }
            try:
                resp = await _fetch_with_retry(client, SUMMARY_URL, params)
                data = resp.json()

                avg_tone = data.get("avgtone") or data.get("tone") or data.get("avgTone")
                total_articles = int(data.get("numArticles") or data.get("articles") or 0)

                if avg_tone is not None:
                    results.append({
                        "country_iso2":    iso2,
                        "avg_tone":        round(float(avg_tone), 2),
                        "total_articles":  total_articles,
                        "sentiment_label": _tone_label(float(avg_tone)),
                    })
            except Exception as e:
                logger.warning("GDELT skip %s: %s", iso2, e)

            # Пауза между запросами чтобы не получить rate limit
            await asyncio.sleep(0.5)

    return results


def iso3_to_iso2(iso3: str) -> Optional[str]:
    return _ISO3_TO_ISO2.get(iso3.upper())


def _tone_label(tone: Optional[float]) -> str:
    if tone is None:
        return "unknown"
    if tone >= 2.0:
        return "positive"
    elif tone <= -2.0:
        return "negative"
    else:
        return "neutral"


def _empty_sentiment(iso2: str, timespan: str, error: Optional[str] = None) -> dict:
    result = {
        "country_iso2":    iso2,
        "timespan":        timespan,
        "avg_tone":        None,
        "total_articles":  0,
        "sentiment_label": "unknown",
        "source":          "gdelt",
    }
    if error:
        result["error"] = error
    return result
