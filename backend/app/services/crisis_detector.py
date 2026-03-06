"""
محرك كشف الأزمات الآلي
Automated Crisis Detection Engine
"""
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.article import Article
from app.models.alert import CrisisAlert
from app.services.nlp_analyzer import get_analyzer

logger = logging.getLogger(__name__)

SEVERITY_THRESHOLDS = {
    "critical": 0.85,
    "high": 0.70,
    "medium": 0.50,
    "low": 0.30,
}

CRISIS_CLUSTER_THRESHOLD = 3  # عدد المقالات الحرج لإنشاء تنبيه


class CrisisDetector:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.analyzer = get_analyzer()

    def determine_severity(self, crisis_score: float, articles_count: int) -> str:
        """تحديد مستوى خطورة الأزمة"""
        # رفع المستوى بناءً على عدد المقالات
        adjusted_score = crisis_score + (min(articles_count, 10) * 0.02)
        adjusted_score = min(1.0, adjusted_score)

        for severity, threshold in SEVERITY_THRESHOLDS.items():
            if adjusted_score >= threshold:
                return severity
        return "low"

    async def analyze_pending_articles(self) -> int:
        """تحليل المقالات غير المحللة"""
        result = await self.db.execute(
            select(Article).where(Article.is_analyzed == False).limit(100)
        )
        articles = result.scalars().all()

        analyzed_count = 0
        for article in articles:
            try:
                analysis = self.analyzer.analyze_article(
                    article.title or "",
                    article.content or article.summary or ""
                )

                article.sentiment = analysis["sentiment"]
                article.sentiment_score = analysis["sentiment_score"]
                article.is_crisis = analysis["is_crisis"]
                article.crisis_score = analysis["crisis_score"]
                article.crisis_type = analysis["crisis_type"]
                article.keywords = analysis["keywords"]
                article.entities = analysis["entities"]
                article.is_analyzed = True

                analyzed_count += 1

            except Exception as e:
                logger.error(f"Error analyzing article {article.id}: {e}")
                article.is_analyzed = True  # تجنب إعادة المعالجة

        await self.db.commit()
        logger.info(f"Analyzed {analyzed_count} articles")
        return analyzed_count

    async def detect_crisis_clusters(self) -> List[Dict]:
        """اكتشاف تجمعات الأزمات - متوافق مع PostgreSQL و SQLite"""
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

        # استعلام التجمعات بدون array_agg (متوافق مع كلا قاعدتي البيانات)
        result = await self.db.execute(
            select(
                Article.crisis_type,
                func.count(Article.id).label("count"),
                func.avg(Article.crisis_score).label("avg_score"),
            )
            .where(
                Article.is_crisis == True,
                Article.is_analyzed == True,
                Article.fetched_at >= one_hour_ago,
            )
            .group_by(Article.crisis_type)
            .having(func.count(Article.id) >= CRISIS_CLUSTER_THRESHOLD)
        )

        clusters = []
        for row in result:
            # جلب معرّفات المقالات في استعلام منفصل
            ids_result = await self.db.execute(
                select(Article.id)
                .where(
                    Article.is_crisis == True,
                    Article.crisis_type == row.crisis_type,
                    Article.fetched_at >= one_hour_ago,
                )
                .limit(50)
            )
            article_ids = [r[0] for r in ids_result]

            clusters.append({
                "crisis_type": row.crisis_type,
                "count": row.count,
                "avg_score": float(row.avg_score or 0),
                "article_ids": article_ids,
            })

        return clusters

    async def create_or_update_alert(self, cluster: Dict) -> Optional[CrisisAlert]:
        """إنشاء أو تحديث تنبيه أزمة"""
        crisis_type = cluster["crisis_type"]
        avg_score = cluster["avg_score"]
        article_ids = cluster["article_ids"]

        # التحقق من وجود تنبيه حالي لنفس النوع
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        result = await self.db.execute(
            select(CrisisAlert)
            .where(
                CrisisAlert.crisis_type == crisis_type,
                CrisisAlert.is_active == True,
                CrisisAlert.created_at >= one_hour_ago,
            )
            .limit(1)
        )
        existing_alert = result.scalar_one_or_none()

        severity = self.determine_severity(avg_score, cluster["count"])

        # خرائط محاور منتدى الإعلام السعودي
        crisis_names = {
            "direct_mention":  "منتدى الإعلام السعودي",
            "participants":    "شخصيات وضيوف المنتدى",
            "topics_sessions": "جلسات ومحاور المنتدى",
            # احتفاظ بالقديمة للتوافق مع DB القديم
            "security":  "أمني",
            "political": "سياسي",
            "economic":  "اقتصادي",
            "health":    "صحي",
            "natural":   "طبيعي",
        }

        crisis_name = crisis_names.get(crisis_type, "منتدى الإعلام")

        if existing_alert:
            # تحديث التنبيه الموجود
            existing_alert.articles_count = cluster["count"]
            existing_alert.severity_score = avg_score
            existing_alert.severity = severity
            existing_alert.article_ids = json.dumps(article_ids)
            existing_alert.updated_at = datetime.now(timezone.utc)
            await self.db.commit()
            logger.info(f"Updated crisis alert: {crisis_name} (severity: {severity})")
            return existing_alert
        else:
            # إنشاء تنبيه جديد
            alert = CrisisAlert(
                title=f"رصد: {crisis_name} — {cluster['count']} مقالة",
                description=f"رُصدت {cluster['count']} مقالة ذات صلة بـ{crisis_name} خلال منتدى الإعلام السعودي (درجة الصلة: {avg_score:.2f})",
                crisis_type=crisis_type,
                severity=severity,
                severity_score=avg_score,
                article_ids=json.dumps(article_ids),
                articles_count=cluster["count"],
                is_active=True,
            )
            self.db.add(alert)
            await self.db.commit()
            await self.db.refresh(alert)
            logger.warning(f"NEW CRISIS ALERT: {crisis_name} (severity: {severity})")
            return alert

    async def run_detection_cycle(self) -> Dict:
        """تشغيل دورة كشف أزمة كاملة"""
        # 1. تحليل المقالات الجديدة
        analyzed = await self.analyze_pending_articles()

        # 2. كشف تجمعات الأزمات
        clusters = await self.detect_crisis_clusters()

        # 3. إنشاء/تحديث التنبيهات
        alerts_created = 0
        alerts_updated = 0

        for cluster in clusters:
            alert = await self.create_or_update_alert(cluster)
            if alert:
                alerts_created += 1

        return {
            "articles_analyzed": analyzed,
            "crisis_clusters_found": len(clusters),
            "alerts_processed": alerts_created,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
