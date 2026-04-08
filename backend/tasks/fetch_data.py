"""
Celery-задачи для фонового обновления данных.

Расписание (настраивается в beat_schedule ниже):
  - World Bank indicators → раз в сутки
  - Alpha Vantage forex   → раз в час (в рамках 25 req/day)
  - FRED rates            → раз в сутки
  - GDELT sentiment       → раз в 6 часов

Запуск воркера:  celery -A tasks.fetch_data worker --loglevel=info
Запуск планировщика: celery -A tasks.fetch_data beat --loglevel=info
"""

import asyncio
import logging
from celery import Celery
from celery.schedules import crontab
from datetime import datetime

from core.config import settings

logger = logging.getLogger(__name__)

# ── Celery app ────────────────────────────────────────────────────────
celery_app = Celery(
    "globalanalytics",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Расписание автоматических задач
    beat_schedule={
        "fetch-world-bank-daily": {
            "task": "tasks.fetch_data.task_fetch_world_bank",
            "schedule": crontab(hour=3, minute=0),   # 03:00 UTC каждый день
        },
        "fetch-fred-daily": {
            "task": "tasks.fetch_data.task_fetch_fred",
            "schedule": crontab(hour=4, minute=0),   # 04:00 UTC каждый день
        },
        "fetch-gdelt-every-6h": {
            "task": "tasks.fetch_data.task_fetch_gdelt",
            "schedule": crontab(minute=0, hour="*/6"),  # каждые 6 часов
        },
        "fetch-alpha-vantage-hourly": {
            "task": "tasks.fetch_data.task_fetch_alpha_vantage",
            "schedule": crontab(minute=30),           # каждый час в :30
        },
    },
)


# ── Вспомогательная функция для записи статуса ────────────────────────
def _update_status(source: str, success: bool, error_msg: str = None, count: int = 0):
    """Обновляет статус источника в БД (синхронно через SQLAlchemy)."""
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
        now = datetime.utcnow()
        with engine.begin() as conn:
            if success:
                conn.execute(text("""
                    UPDATE data_source_status
                    SET last_success = :now,
                        last_attempt = :now,
                        last_error = NULL,
                        records_count = :count
                    WHERE source = :source
                """), {"now": now, "count": float(count), "source": source})
            else:
                conn.execute(text("""
                    UPDATE data_source_status
                    SET last_attempt = :now,
                        last_error = :err
                    WHERE source = :source
                """), {"now": now, "err": error_msg, "source": source})
    except Exception as e:
        logger.error("Не удалось обновить data_source_status для %s: %s", source, e)


# ── Задача: World Bank ────────────────────────────────────────────────
@celery_app.task(name="tasks.fetch_data.task_fetch_world_bank", bind=True, max_retries=3)
def task_fetch_world_bank(self):
    """Обновляет данные World Bank для тепловой карты."""
    logger.info("▶ World Bank: начало обновления")
    try:
        from services.world_bank import INDICATORS, fetch_indicator

        total = 0
        for indicator_code in INDICATORS:
            result = asyncio.run(fetch_indicator(indicator_code))
            total += len(result.get("data", []))
            logger.info("  WB %s: %d стран", indicator_code, len(result.get("data", [])))

        _update_status("world_bank", success=True, count=total)
        logger.info("✓ World Bank обновлён: %d точек", total)
        return {"status": "ok", "records": total}

    except Exception as exc:
        logger.error("✗ World Bank ошибка: %s", exc)
        _update_status("world_bank", success=False, error_msg=str(exc))
        raise self.retry(exc=exc, countdown=300)  # retry через 5 мин


# ── Задача: FRED ──────────────────────────────────────────────────────
@celery_app.task(name="tasks.fetch_data.task_fetch_fred", bind=True, max_retries=3)
def task_fetch_fred(self):
    """Обновляет данные FRED (процентные ставки, M2, CPI)."""
    from core.config import settings as cfg
    if not cfg.FRED_API_KEY:
        logger.info("⏭ FRED: нет API ключа, пропускаем")
        return {"status": "skipped", "reason": "no_api_key"}

    logger.info("▶ FRED: начало обновления")
    try:
        from services.fred import SERIES, fetch_series

        total = 0
        for series_id in SERIES:
            result = asyncio.run(fetch_series(series_id, period="1y"))
            total += len(result.get("series", []))

        _update_status("fred", success=True, count=total)
        logger.info("✓ FRED обновлён: %d точек", total)
        return {"status": "ok", "records": total}

    except Exception as exc:
        logger.error("✗ FRED ошибка: %s", exc)
        _update_status("fred", success=False, error_msg=str(exc))
        raise self.retry(exc=exc, countdown=300)


# ── Задача: GDELT ─────────────────────────────────────────────────────
@celery_app.task(name="tasks.fetch_data.task_fetch_gdelt", bind=True, max_retries=3)
def task_fetch_gdelt(self):
    """Обновляет тональность новостей из GDELT для всех стран."""
    logger.info("▶ GDELT: начало обновления тональности")
    try:
        from services.gdelt import fetch_all_countries_sentiment

        results = asyncio.run(fetch_all_countries_sentiment(timespan="LAST7D"))
        count = len(results)

        _update_status("gdelt", success=True, count=count)
        logger.info("✓ GDELT обновлён: %d стран", count)
        return {"status": "ok", "records": count}

    except Exception as exc:
        logger.error("✗ GDELT ошибка: %s", exc)
        _update_status("gdelt", success=False, error_msg=str(exc))
        raise self.retry(exc=exc, countdown=600)


# ── Задача: Alpha Vantage ─────────────────────────────────────────────
@celery_app.task(name="tasks.fetch_data.task_fetch_alpha_vantage", bind=True, max_retries=2)
def task_fetch_alpha_vantage(self):
    """Обновляет форекс и котировки из Alpha Vantage."""
    from core.config import settings as cfg
    if not cfg.ALPHA_VANTAGE_API_KEY:
        logger.info("⏭ Alpha Vantage: нет API ключа, пропускаем")
        return {"status": "skipped", "reason": "no_api_key"}

    logger.info("▶ Alpha Vantage: начало обновления")
    try:
        from services.alpha_vantage import DEFAULT_FOREX_PAIRS, fetch_forex_timeseries

        total = 0
        # Обновляем только основные форекс-пары (экономим лимит 25 req/day)
        for from_sym, to_sym in DEFAULT_FOREX_PAIRS[:3]:
            result = asyncio.run(fetch_forex_timeseries(from_sym, to_sym, period="1y"))
            total += len(result.get("series", []))

        _update_status("alpha_vantage", success=True, count=total)
        logger.info("✓ Alpha Vantage обновлён: %d точек", total)
        return {"status": "ok", "records": total}

    except Exception as exc:
        logger.error("✗ Alpha Vantage ошибка: %s", exc)
        _update_status("alpha_vantage", success=False, error_msg=str(exc))
        raise self.retry(exc=exc, countdown=120)
