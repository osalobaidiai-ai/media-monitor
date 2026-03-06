"""
التطبيق الرئيسي - Saudi Media Monitor
Main FastAPI Application
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.config import settings
from app.database import init_db
from app.services.cache_service import cache
from app.utils.scheduler import setup_scheduler, stop_scheduler
from app.api import articles, alerts, sources, websocket, reports, twitter

# إعداد السجلات
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """إدارة دورة حياة التطبيق"""
    logger.info("Starting Saudi Media Monitor...")

    # تهيئة قاعدة البيانات
    await init_db()
    logger.info("Database initialized")

    # الاتصال بـ Redis
    await cache.connect()

    # بدء جدولة المهام
    setup_scheduler()

    yield

    # إيقاف المجدول
    stop_scheduler()

    # قطع الاتصال بـ Redis
    await cache.disconnect()

    logger.info("Saudi Media Monitor stopped")


app = FastAPI(
    title="Saudi Media Monitor API",
    description="منظومة رصد الإعلام الذكية للجهات الحكومية السعودية",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# تسجيل Routes
app.include_router(articles.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(sources.router, prefix="/api/v1")
app.include_router(websocket.router)
app.include_router(reports.router, prefix="/api/v1")
app.include_router(twitter.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "message": "منظومة رصد الإعلام الذكية - جاهزة للعمل",
    }


@app.get("/health")
async def health_check():
    """فحص صحة الخدمة"""
    redis_status = "connected" if cache.redis else "disconnected"
    return {
        "status": "healthy",
        "redis": redis_status,
        "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }


@app.post("/api/v1/collect")
async def trigger_collection():
    """تشغيل جمع RSS يدوياً"""
    from app.utils.scheduler import collect_rss_task
    import asyncio
    asyncio.create_task(collect_rss_task())
    return {"status": "collection started", "message": "بدأت عملية جمع الأخبار"}


@app.post("/api/v1/analyze")
async def trigger_analysis():
    """تشغيل تحليل المقالات يدوياً"""
    from app.utils.scheduler import analyze_articles_task
    import asyncio
    asyncio.create_task(analyze_articles_task())
    return {"status": "analysis started", "message": "بدأت عملية التحليل"}


@app.post("/api/v1/import-archive")
async def import_archive_articles():
    """استيراد مقالات أرشيف منتدى الإعلام السعودي (يناير-فبراير 2026)"""
    from app.services.url_importer import ArchiveImporter
    importer = ArchiveImporter()
    result = await importer.import_all()
    return {
        "status": "completed",
        "message": f"تم استيراد {result['imported']} مقالة جديدة",
        **result,
    }
