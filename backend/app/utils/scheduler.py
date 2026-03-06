"""
جدولة المهام التلقائية
Automated Task Scheduler
"""
import asyncio
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.config import settings
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def collect_rss_task():
    """مهمة جمع RSS الدورية"""
    from app.services.rss_collector import RSSCollector
    from app.api.websocket import manager

    logger.info(f"Starting RSS collection at {datetime.now(timezone.utc)}")
    async with AsyncSessionLocal() as db:
        async with RSSCollector(db) as collector:
            result = await collector.collect_all()

    logger.info(f"RSS collection done: {result['total_new_articles']} new articles")

    # إعلام WebSocket clients
    if result["total_new_articles"] > 0:
        await manager.broadcast_stats_update({
            "new_articles": result["total_new_articles"],
            "sources": result["sources"],
        })


async def analyze_articles_task():
    """مهمة تحليل المقالات الدورية"""
    from app.services.crisis_detector import CrisisDetector
    from app.api.websocket import manager

    logger.info("Starting article analysis...")
    async with AsyncSessionLocal() as db:
        detector = CrisisDetector(db)
        result = await detector.run_detection_cycle()

    logger.info(f"Analysis done: {result}")

    if result.get("crisis_clusters_found", 0) > 0:
        await manager.broadcast({
            "type": "crisis_detected",
            "data": result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })


def setup_scheduler():
    """إعداد وتشغيل المجدول"""
    # جمع RSS كل 5 دقائق
    scheduler.add_job(
        collect_rss_task,
        trigger=IntervalTrigger(seconds=settings.RSS_FETCH_INTERVAL),
        id="rss_collector",
        name="RSS Collector",
        replace_existing=True,
        max_instances=1,
    )

    # تحليل المقالات كل دقيقة
    scheduler.add_job(
        analyze_articles_task,
        trigger=IntervalTrigger(seconds=60),
        id="article_analyzer",
        name="Article Analyzer",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.start()
    logger.info("Scheduler started successfully")


def stop_scheduler():
    """إيقاف المجدول"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
