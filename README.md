# GlobalAnalytics — MVP

Платформа глобальной аналитики: тепловые карты, финансовые данные, новостной мониторинг.

## Быстрый старт (локально)

### 1. Клонировать и настроить окружение

```bash
git clone https://github.com/your-username/global-analytics.git
cd global-analytics

# Настроить переменные окружения бэкенда
cp backend/.env.example backend/.env
# → открыть backend/.env и вписать ключи API
```

### 2. Запуск через Docker

```bash
docker-compose up
```

- Фронтенд: http://localhost:3000
- Бэкенд API: http://localhost:8000
- Документация API: http://localhost:8000/docs

### 3. Запуск без Docker

**Бэкенд:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Фронтенд:**
```bash
cd frontend
npm install
npm run dev
```

## Деплой на Railway

1. Создать проект на [railway.app](https://railway.app)
2. Добавить сервис из GitHub → выбрать папку `backend/`
3. Добавить PostgreSQL и Redis через Railway Plugins
4. Добавить второй сервис → папка `frontend/`
5. Прописать переменные окружения из `.env.example`

## Структура

```
├── frontend/          # React + Vite + TypeScript
│   └── src/
│       ├── pages/     # Страницы (HeatMap, Dashboard, Compare, News)
│       ├── components/# Переиспользуемые компоненты
│       ├── api/       # Клиент для запросов к бэкенду
│       ├── hooks/     # React-хуки
│       └── types/     # TypeScript-типы
├── backend/           # FastAPI (Python)
│   ├── routers/       # Эндпоинты: geo, finance, news, health
│   ├── services/      # Бизнес-логика и обращения к внешним API
│   ├── models/        # SQLAlchemy-модели
│   └── core/          # Конфиг, зависимости
└── docker-compose.yml # Локальное окружение
```

## Ключи API (все бесплатные)

| Сервис | Для чего | Получить |
|---|---|---|
| Alpha Vantage | Котировки, форекс | https://www.alphavantage.co/support/#api-key |
| FRED | Процентные ставки, макро | https://fred.stlouisfed.org/docs/api/api_key.html |
| NewsAPI | Новостная лента | https://newsapi.org/register |
| World Bank | ВВП, демография, инфляция | Без ключа (открытый API) |
| GDELT | Новостной тональный индекс | Без ключа (открытый API) |
