from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from routers import health, geo, finance, news


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 GlobalAnalytics API запущен: {settings.ENV}")
    yield
    print("🛑 Завершение работы")


app = FastAPI(
    title="GlobalAnalytics API",
    version="0.1.0",
    description="API для сервиса глобальной аналитики",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутеры
app.include_router(health.router, tags=["health"])
app.include_router(geo.router,     prefix="/api/geo",     tags=["geo"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(news.router,    prefix="/api/news",    tags=["news"])
