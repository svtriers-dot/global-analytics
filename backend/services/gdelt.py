"""
Сервис GDELT v2 — тональность новостей по странам.
Документация: https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/

Бесплатный, без API ключа. Работает сразу.

GDELT ArtList API: https://api.gdeltproject.org/api/v2/doc/doc
  - mode=tonechart  → средняя тональность за период
  - query=sourcecountry:XX → новости из страны XX (ISO2)

Тональность: от -100 (крайне негативно) до +100 (крайне позитивно).
Обычный диапазон: -10..+5.
"""

import httpx
import csv
import io
import logging
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

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


async def fetch_country_sentiment(
    country_iso2: str,
    timespan: str = "LAST7D",
) -> dict:
    """
    Тональный индекс новостей для страны за указанный период.

    country_iso2 — двухбуквенный ISO код (US, DE, CN...)
    timespan     — LAST24H | LAST7D | LAST30D | LAST90D
    Возвращает средний tone и количество статей.
    """
    params = {
        "query":    f"sourcecountry:{country_iso2.upper()}",
        "mode":     "tonechart",
        "format":   "csv",
        "timespan": timespan,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            text = resp.text

        # GDELT возвращает CSV: Date,ToneChartBin,ToneChartArticles
        # ToneChartBin — значение тональности (-50..+50 шкала)
        rows = list(csv.DictReader(io.StringIO(text)))

        if not rows:
            return _empty_sentiment(country_iso2, timespan)

        # Вычисляем средневзвешенную тональность
        total_articles = 0
        weighted_sum = 0.0
        for row in rows:
            try:
                articles = int(row.get("ToneChartArticles") or row.get("Count") or 0)
                tone_val = float(row.get("ToneChartBin") or row.get("Tone") or 0)
                weighted_sum += tone_val * articles
                total_articles += articles
            except (ValueError, KeyError):
                continue

        avg_tone = round(weighted_sum / total_articles, 2) if total_articles > 0 else 0.0

        return {
            "country_iso2":   country_iso2.upper(),
            "timespan":       timespan,
            "avg_tone":       avg_tone,
            "total_articles": total_articles,
            "sentiment_label": _tone_label(avg_tone),
            "source":         "gdelt",
        }

    except httpx.HTTPError as e:
        logger.error("GDELT HTTP error for %s: %s", country_iso2, e)
        return _empty_sentiment(country_iso2, timespan, str(e))
    except Exception as e:
        logger.error("GDELT parse error for %s: %s", country_iso2, e)
        return _empty_sentiment(country_iso2, timespan, str(e))


async def fetch_all_countries_sentiment(timespan: str = "LAST7D") -> list:
    """
    Тональность для набора ключевых стран (для слоя на тепловой карте).
    Делаем запросы последовательно чтобы не перегружать GDELT.
    """
    countries = list(_ISO3_TO_ISO2.values())[:30]  # берём топ-30
    results = []

    async with httpx.AsyncClient(timeout=20.0) as client:
        for iso2 in countries:
            params = {
                "query":    f"sourcecountry:{iso2}",
                "mode":     "tonechart",
                "format":   "csv",
                "timespan": timespan,
            }
            try:
                resp = await client.get(BASE_URL, params=params)
                text = resp.text
                rows = list(csv.DictReader(io.StringIO(text)))

                total_articles = 0
                weighted_sum = 0.0
                for row in rows:
                    try:
                        articles = int(row.get("ToneChartArticles") or row.get("Count") or 0)
                        tone_val = float(row.get("ToneChartBin") or row.get("Tone") or 0)
                        weighted_sum += tone_val * articles
                        total_articles += articles
                    except (ValueError, KeyError):
                        continue

                if total_articles > 0:
                    avg_tone = round(weighted_sum / total_articles, 2)
                    results.append({
                        "country_iso2":   iso2,
                        "avg_tone":       avg_tone,
                        "total_articles": total_articles,
                        "sentiment_label": _tone_label(avg_tone),
                    })
            except Exception as e:
                logger.warning("GDELT skip %s: %s", iso2, e)
                continue

    return results


def iso3_to_iso2(iso3: str) -> Optional[str]:
    return _ISO3_TO_ISO2.get(iso3.upper())


def _tone_label(tone: float) -> str:
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
