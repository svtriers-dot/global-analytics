# GlobalAnalytics — контекст проекта

## Что это

Платформа глобальной аналитики для бизнеса. Агрегирует открытые данные (госстатистика, финансовые рынки, геоданные, новости) и визуализирует их в виде интерактивных тепловых карт, дашбордов и сравнительных отчётов.

Разрабатывается методом вайбкодинга — один разработчик + AI.

## Ключевые документы

- `../ТЗ_GlobalAnalytics_MVP.md` — полное техническое задание MVP
- `../ПЛАН_разработки_MVP.md` — план по этапам с вехами

## Текущий статус

**Этап 3 завершён.** Следующий — Этап 4 (Сравнение стран).

| Этап | Статус | Коммит |
|---|---|---|
| 0 — Фундамент | ✅ Завершён | Railway, GitHub CI/CD |
| 1 — Тепловая карта | ✅ Завершён | `3ecad6b` |
| 2 — Расширение данных | ✅ Завершён | `f8fdf48` |
| 3 — Дашборд | ✅ Завершён | `6bb87c0` |
| 4 — Сравнение стран | ⬜ Не начат | — |
| 5 — Новостной мониторинг | ⬜ Не начат | — |
| 6 — Бета-запуск | ⬜ Не начат | — |

### Живые URL

- **Frontend**: https://responsible-joy-production-ceb3.up.railway.app
- **Backend API**: https://global-analytics-production.up.railway.app
- **Health check**: https://global-analytics-production.up.railway.app/health

---

## Детали реализации

### Этап 1 — Тепловая карта ✅

- Leaflet + тёмная подложка CartoDB (фон + метки двумя слоями)
- GeoJSON из `datasets/geo-countries`: свойства `ISO3166-1-Alpha-3` / `ISO3166-1-Alpha-2` / `name`
- 4 слоя: ВВП на душу (`NY.GDP.PCAP.CD`), Инфляция, Безработица, Население
- Градиент: тёмно-синий → голубой → зелёный → жёлтый → красный (5 стопов, интерполяция)
- **`scale: "log"`** для ВВП и населения — равномерное распределение цветов при log-нормальных данных
- **P5/P95** вместо min/max — выбросы (Монако $288k) не сжимают шкалу
- **Фильтрация 49 агрегатов WB** в `_WB_AGGREGATE_ISO3` (`services/world_bank.py`) — только 192 страны
- Клик → `CountrySidebar` с историческими Recharts-графиками
- `GET /api/geo/map/{indicator}` и `GET /api/geo/country/{iso2}/history/{indicator}`

### Этап 2 — Расширение данных ✅

- **`services/fred.py`** — FRED API (`FRED_API_KEY`): FEDFUNDS, DGS10, ECBDFR, T10YIE
- **`services/alpha_vantage.py`** — Alpha Vantage (`ALPHA_VANTAGE_KEY`): форекс, акции
- **`services/gdelt.py`** — GDELT v2 (без ключа): тональность новостей; TTL-кеш 1 ч (защита от 429)
- **`models/timeseries.py`** — `time_series_points` + `data_source_status` (TimescaleDB)
- **`alembic/versions/0001_...`** — миграция + seed 4 источников
- **`tasks/fetch_data.py`** — Celery beat_schedule для фоновой загрузки
- **`routers/finance.py`** — `/api/finance/timeseries`, `/rates`, `/series/{id}`
- **`routers/news.py`** — `/api/news/sentiment/{country}`, `/api/news/sentiment`
- **`routers/status.py`** + **`pages/StatusPage.tsx`** — страница `/status`

> ⚠️ В проде нужно: `alembic upgrade head` + отдельный Railway-сервис для Celery worker

### Этап 3 — Дашборд ✅

- **`pages/DashboardPage.tsx`** — CSS grid `repeat(auto-fill, minmax(280px, 1fr))`; сохранение в `localStorage` (`ga_dashboard_v1`)
- **`components/AddWidgetModal.tsx`** — 2 шага: тип виджета → параметры (источник, страна, индикатор, период)
- **`components/widgets/KPICard.tsx`** — KPI-карточка, экспортирует `WidgetHeader`, `cardStyle`, `formatValue()`
- **`components/widgets/LineChartWidget.tsx`** — линейный график; источник FRED или World Bank
- **`components/widgets/BarChartWidget.tsx`** — горизонтальный бар, топ-15 стран
- **`types/dashboard.ts`** — `WidgetConfig`, `DEFAULT_WIDGETS` (6 шт.), `loadDashboard/saveDashboard`
- **`api/finance.ts`** — запросы к FRED, Alpha Vantage, World Bank

---

## Решённые проблемы

| Проблема | Решение |
|---|---|
| TypeScript `import.meta.env` | `frontend/src/vite-env.d.ts` с `/// <reference types="vite/client" />` |
| Backend 502 Bad Gateway | Railway proxy → порт 8080 (uvicorn), не 8000 |
| GeoJSON свойства `undefined` | Правильные ключи: `name` / `ISO3166-1-Alpha-3` / `ISO3166-1-Alpha-2` |
| `settings.ENV` = `/etc/profile` | Railway захватывал shell `ENV` → переименовано в `APP_ENV`, pydantic-settings v2 |
| Тепловая карта вся синяя | Фильтрация агрегатов WB + P5/P95 + log-шкала для ВВП/населения |
| GDELT 429 rate limit | In-memory TTL-кеш 1 ч в `services/gdelt.py` |

## Принятые решения

| Тема | Решение |
|---|---|
| Старт разработки | С тепловой карты — сразу wow-эффект для демо |
| Аккаунты и авторизация | V2, в MVP нет |
| API для интеграций | V2 |
| 152-ФЗ / хранение в РФ | V2 |
| Парсинг данных | V2, MVP — только официальные API |
| Монетизация | V2 |
| Деплой | Railway (frontend + backend + PostgreSQL + Redis) |

## Стек

| Уровень | Технология |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Карты | Leaflet.js + react-leaflet |
| Графики | Recharts |
| Backend | Python / FastAPI |
| Очереди | Celery + Redis |
| БД | TimescaleDB (PostgreSQL) |
| Деплой | Railway |
| Мониторинг | Sentry (Этап 6) |

## Структура проекта

```
code/
├── frontend/
│   └── src/
│       ├── pages/       # HeatMapPage, DashboardPage, ComparePage, NewsPage
│       ├── components/  # переиспользуемые компоненты
│       ├── api/         # клиент к бэкенду
│       ├── hooks/       # React-хуки
│       └── types/       # TypeScript-типы
└── backend/
    ├── routers/         # geo, finance, news, health
    ├── services/        # логика + обращения к внешним API
    ├── models/          # SQLAlchemy-модели
    └── core/            # config.py (настройки из .env)
```

## Источники данных MVP

| Источник | Данные | Ключ |
|---|---|---|
| World Bank API | ВВП, инфляция, демография | Без ключа |
| GDELT | Новостной тональный индекс по странам | Без ключа |
| Alpha Vantage | Котировки, форекс, крипто | Нужен (бесплатный) |
| FRED | Процентные ставки, монетарные данные | Нужен (бесплатный) |
| NewsAPI | Новостная лента | Нужен (бесплатный) |
| OpenStreetMap | Геоданные | Без ключа |

## Модули MVP (по этапам)

1. **Тепловая карта** — интерактивная карта мира, слои данных, клик по стране
2. **Расширение данных** — подключить все 4 категории источников
3. **Дашборд** — настраиваемые виджеты (графики, KPI)
4. **Сравнение стран** — side-by-side, экспорт CSV/PNG
5. **Новостной мониторинг** — лента, тональность, связка с графиками

## Что НЕ входит в MVP

- Авторизация, аккаунты, тарифные планы
- API для внешних интеграций
- Парсинг данных (только официальные API)
- Мобильное приложение
- 152-ФЗ / хранение данных в РФ
- ИИ-ассистент для интерпретации данных
