"""
Роутер /api/status — внутренний дашборд состояния источников данных.
Показывает: последнее обновление, количество записей, наличие ошибок, настроен ли API ключ.
"""

from fastapi import APIRouter
from datetime import datetime, timezone
from core.config import settings

router = APIRouter()

# Метаданные источников (статические)
SOURCE_META = {
    "world_bank": {
        "label":       "World Bank Open Data",
        "url":         "https://data.worldbank.org",
        "key_env":     None,
        "description": "ВВП, инфляция, население, безработица для всех стран",
    },
    "alpha_vantage": {
        "label":       "Alpha Vantage",
        "url":         "https://www.alphavantage.co",
        "key_env":     "ALPHA_VANTAGE_API_KEY",
        "description": "Котировки акций, форекс, ETF",
    },
    "fred": {
        "label":       "FRED (Federal Reserve)",
        "url":         "https://fred.stlouisfed.org",
        "key_env":     "FRED_API_KEY",
        "description": "Процентные ставки, M2, CPI, Treasury yields",
    },
    "gdelt": {
        "label":       "GDELT Project",
        "url":         "https://www.gdeltproject.org",
        "key_env":     None,
        "description": "Тональность новостей по странам (без ключа)",
    },
}


def _is_key_configured(key_env: str | None) -> bool:
    """Проверяет наличие API ключа в settings."""
    if key_env is None:
        return True  # нет ключа = не нужен
    val = getattr(settings, key_env, "")
    return bool(val)


def _try_db_status() -> dict:
    """Пытается получить статусы из БД. Возвращает пустой dict при ошибке."""
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT * FROM data_source_status")).mappings().all()
        return {row["source"]: dict(row) for row in rows}
    except Exception:
        return {}


@router.get("/status")
async def get_data_status():
    """
    Состояние всех источников данных.
    Используется внутренним дашбордом.
    """
    db_status = _try_db_status()
    now = datetime.now(timezone.utc)

    sources = []
    overall_healthy = True

    for source_id, meta in SOURCE_META.items():
        db = db_status.get(source_id, {})
        key_ok = _is_key_configured(meta["key_env"])

        last_success = db.get("last_success")
        last_attempt = db.get("last_attempt")
        last_error   = db.get("last_error")
        records      = int(db.get("records_count") or 0)

        # Вычисляем возраст данных
        age_hours = None
        if last_success:
            if hasattr(last_success, "replace"):
                # naive datetime → assume UTC
                ls_utc = last_success.replace(tzinfo=timezone.utc)
            else:
                ls_utc = last_success
            age_hours = round((now - ls_utc).total_seconds() / 3600, 1)

        # Определяем статус
        if not key_ok:
            status = "no_key"
        elif last_error and not last_success:
            status = "error"
            overall_healthy = False
        elif age_hours is not None and age_hours > 48:
            status = "stale"
            overall_healthy = False
        elif last_success:
            status = "ok"
        else:
            status = "never_fetched"

        sources.append({
            "source":       source_id,
            "label":        meta["label"],
            "description":  meta["description"],
            "url":          meta["url"],
            "key_required": meta["key_env"] is not None,
            "key_configured": key_ok,
            "status":       status,
            "last_success": last_success.isoformat() if last_success else None,
            "last_attempt": last_attempt.isoformat() if last_attempt else None,
            "last_error":   last_error,
            "records_count": records,
            "data_age_hours": age_hours,
        })

    return {
        "overall_healthy": overall_healthy,
        "checked_at":      now.isoformat(),
        "sources":         sources,
    }
