"""
Модели для хранения временных рядов в TimescaleDB.

Единый формат для всех источников данных:
  World Bank, Alpha Vantage, FRED, GDELT.

Таблица time_series_points — гипертаблица TimescaleDB,
партиционированная по timestamp (по умолчанию chunk interval = 7 дней).
"""

from sqlalchemy import (
    Column, String, Float, DateTime, Text,
    UniqueConstraint, Index, text,
)
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime


class Base(DeclarativeBase):
    pass


class TimeSeriesPoint(Base):
    """
    Единая точка временного ряда.

    source      — источник данных: 'world_bank' | 'alpha_vantage' | 'fred' | 'gdelt'
    series_id   — уникальный идентификатор ряда:
                    World Bank : 'wb:NY.GDP.PCAP.CD:USA'
                    Alpha Vantage: 'av:forex:USD/EUR'
                    FRED:          'fred:FEDFUNDS'
                    GDELT:         'gdelt:tone:USA'
    country_code — ISO3 код страны (или None для глобальных рядов)
    timestamp   — дата/время точки (partitioning key)
    value       — числовое значение
    unit        — единица измерения ($, %, index, ...)
    meta        — JSON-строка с доп. метаданными (опционально)
    """
    __tablename__ = "time_series_points"

    # Составной первичный ключ: (series_id, timestamp)
    series_id    = Column(String(128), primary_key=True, nullable=False)
    timestamp    = Column(DateTime,    primary_key=True, nullable=False)

    source       = Column(String(32),  nullable=False, index=True)
    country_code = Column(String(3),   nullable=True,  index=True)
    value        = Column(Float,       nullable=False)
    unit         = Column(String(16),  nullable=True)
    meta         = Column(Text,        nullable=True)   # JSON

    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_ts_source_country", "source", "country_code"),
        Index("ix_ts_timestamp", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"<TSPoint {self.series_id} @ {self.timestamp}: {self.value}>"


class DataSourceStatus(Base):
    """
    Состояние каждого источника данных.
    Используется в эндпоинте /api/status.
    """
    __tablename__ = "data_source_status"

    source        = Column(String(32),  primary_key=True, nullable=False)
    last_success  = Column(DateTime,    nullable=True)
    last_attempt  = Column(DateTime,    nullable=True)
    last_error    = Column(Text,        nullable=True)
    records_count = Column(Float,       default=0)   # Float для совместимости BigInt
    is_configured = Column(String(3),   default="no")  # 'yes' | 'no'

    def __repr__(self) -> str:
        return f"<DataSourceStatus {self.source}: last_success={self.last_success}>"
