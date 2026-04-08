"""create timeseries tables

Revision ID: 0001
Revises:
Create Date: 2026-04-08

Создаёт:
  - time_series_points (гипертаблица TimescaleDB)
  - data_source_status
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── time_series_points ────────────────────────────────────────────
    op.create_table(
        "time_series_points",
        sa.Column("series_id",    sa.String(128), primary_key=True, nullable=False),
        sa.Column("timestamp",    sa.DateTime(),  primary_key=True, nullable=False),
        sa.Column("source",       sa.String(32),  nullable=False),
        sa.Column("country_code", sa.String(3),   nullable=True),
        sa.Column("value",        sa.Float(),     nullable=False),
        sa.Column("unit",         sa.String(16),  nullable=True),
        sa.Column("meta",         sa.Text(),      nullable=True),
        sa.Column("created_at",   sa.DateTime(),  nullable=False,
                  server_default=sa.text("NOW()")),
    )

    op.create_index("ix_ts_source_country", "time_series_points",
                    ["source", "country_code"])
    op.create_index("ix_ts_timestamp", "time_series_points", ["timestamp"])

    # Включаем TimescaleDB гипертаблицу (игнорируем ошибку если расширение не установлено)
    try:
        op.execute("SELECT create_hypertable('time_series_points', 'timestamp', if_not_exists => TRUE);")
    except Exception:
        pass  # на обычном PostgreSQL без TimescaleDB просто пропускаем

    # ── data_source_status ────────────────────────────────────────────
    op.create_table(
        "data_source_status",
        sa.Column("source",        sa.String(32), primary_key=True, nullable=False),
        sa.Column("last_success",  sa.DateTime(), nullable=True),
        sa.Column("last_attempt",  sa.DateTime(), nullable=True),
        sa.Column("last_error",    sa.Text(),     nullable=True),
        sa.Column("records_count", sa.Float(),    nullable=True, server_default="0"),
        sa.Column("is_configured", sa.String(3),  nullable=True, server_default="no"),
    )

    # Seed начальных статусов источников
    op.execute("""
        INSERT INTO data_source_status (source, is_configured) VALUES
          ('world_bank',    'yes'),
          ('alpha_vantage', 'no'),
          ('fred',          'no'),
          ('gdelt',         'yes')
        ON CONFLICT (source) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table("data_source_status")
    op.drop_index("ix_ts_timestamp",        table_name="time_series_points")
    op.drop_index("ix_ts_source_country",   table_name="time_series_points")
    op.drop_table("time_series_points")
