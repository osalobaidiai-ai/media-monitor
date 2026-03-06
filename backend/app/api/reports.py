"""
تقارير AI - استخدام Claude API لتوليد تقارير ذكية
"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models.article import Article
from app.models.alert import CrisisAlert
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_TYPES = {
    "overview": "تقرير شامل عن المشهد الإعلامي",
    "crisis": "تحليل الأزمات والتهديدات",
    "sentiment": "تحليل توزيع المشاعر الإعلامية",
    "sources": "تقرير نشاط المصادر الإخبارية",
}


class ReportRequest(BaseModel):
    report_type: str = "overview"
    hours: int = 24
    language: str = "ar"


class ReportResponse(BaseModel):
    report_type: str
    title: str
    content: str
    generated_at: str
    data_period_hours: int
    total_articles: int
    model_used: str


async def _gather_report_data(db: AsyncSession, hours: int) -> dict:
    """جمع بيانات التقرير من قاعدة البيانات"""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # إجمالي المقالات
    total_q = await db.execute(
        select(func.count(Article.id)).where(Article.fetched_at >= since)
    )
    total = total_q.scalar() or 0

    # توزيع المشاعر
    sentiment_q = await db.execute(
        select(Article.sentiment, func.count(Article.id))
        .where(Article.fetched_at >= since)
        .group_by(Article.sentiment)
    )
    sentiment_dist = {row[0] or "unknown": row[1] for row in sentiment_q.fetchall()}

    # مقالات الأزمات
    crisis_q = await db.execute(
        select(func.count(Article.id)).where(
            Article.fetched_at >= since,
            Article.is_crisis.is_(True)
        )
    )
    crisis_count = crisis_q.scalar() or 0

    # أنواع الأزمات
    crisis_types_q = await db.execute(
        select(Article.crisis_type, func.count(Article.id))
        .where(Article.fetched_at >= since, Article.is_crisis.is_(True))
        .group_by(Article.crisis_type)
    )
    crisis_types = {row[0]: row[1] for row in crisis_types_q.fetchall() if row[0]}

    # أكثر المصادر نشاطاً
    sources_q = await db.execute(
        select(Article.source_name, func.count(Article.id))
        .where(Article.fetched_at >= since)
        .group_by(Article.source_name)
        .order_by(func.count(Article.id).desc())
        .limit(5)
    )
    top_sources = [(row[0] or "غير محدد", row[1]) for row in sources_q.fetchall()]

    # التنبيهات النشطة
    alerts_q = await db.execute(
        select(CrisisAlert).where(CrisisAlert.is_active.is_(True))
    )
    active_alerts = alerts_q.scalars().all()

    # آخر 5 مقالات أزمات
    latest_crisis_q = await db.execute(
        select(Article.title, Article.source_name, Article.crisis_type)
        .where(Article.fetched_at >= since, Article.is_crisis.is_(True))
        .order_by(Article.fetched_at.desc())
        .limit(5)
    )
    latest_crisis = latest_crisis_q.fetchall()

    return {
        "total": total,
        "sentiment_dist": sentiment_dist,
        "crisis_count": crisis_count,
        "crisis_rate": round((crisis_count / total * 100) if total > 0 else 0, 1),
        "crisis_types": crisis_types,
        "top_sources": top_sources,
        "active_alerts": [
            {"title": a.title, "severity": a.severity, "type": a.crisis_type}
            for a in active_alerts
        ],
        "latest_crisis_articles": [
            {"title": row[0], "source": row[1], "type": row[2]}
            for row in latest_crisis
        ],
    }


def _build_prompt(report_type: str, hours: int, data: dict) -> str:
    """بناء prompt عربي لـ Claude"""
    pos = data['sentiment_dist'].get('positive', 0)
    neg = data['sentiment_dist'].get('negative', 0)
    neu = data['sentiment_dist'].get('neutral', 0)
    sources_text = "\n".join([f"  - {s[0]}: {s[1]} مقالة" for s in data['top_sources']])
    crisis_types_text = "\n".join([
        f"  - {t}: {c} مقالة" for t, c in data['crisis_types'].items()
    ]) or "  لا توجد أزمات"
    alerts_text = "\n".join([
        f"  - [{a['severity']}] {a['title']}" for a in data['active_alerts']
    ]) or "  لا توجد تنبيهات نشطة"
    latest_crisis_text = "\n".join([
        f"  - {a['title']} ({a['source'] or 'غير محدد'})"
        for a in data['latest_crisis_articles']
    ]) or "  لا توجد مقالات أزمات"

    base_context = f"""
بيانات رصد الإعلام السعودي - آخر {hours} ساعة:
- إجمالي المقالات: {data['total']}
- المقالات الإيجابية: {pos} | السلبية: {neg} | المحايدة: {neu}
- مقالات الأزمات: {data['crisis_count']} ({data['crisis_rate']}%)

أكثر المصادر نشاطاً:
{sources_text}

أنواع الأزمات المرصودة:
{crisis_types_text}

التنبيهات النشطة:
{alerts_text}

آخر مقالات الأزمات:
{latest_crisis_text}
"""

    prompts = {
        "overview": f"""أنت محلل إعلامي متخصص في رصد الإعلام السعودي.
استناداً إلى البيانات التالية، أعد تقريراً شاملاً ومختصراً باللغة العربية الفصحى يتضمن:
1. ملخص تنفيذي للمشهد الإعلامي
2. أبرز الملاحظات والمؤشرات
3. تقييم مستوى المخاطر
4. التوصيات

{base_context}

اكتب التقرير بأسلوب احترافي رسمي مناسب للجهات الحكومية.""",

        "crisis": f"""أنت محلل مخاطر متخصص في رصد الأزمات الإعلامية.
استناداً إلى البيانات التالية، أعد تقرير تحليل أزمات شاملاً يتضمن:
1. تقييم مستوى التهديد الحالي
2. تحليل أنواع الأزمات وتوزيعها
3. الأزمات ذات الأولوية
4. التوصيات العاجلة

{base_context}

ركّز على التحليل الأمني والمخاطر وقدم توصيات عملية.""",

        "sentiment": f"""أنت محلل إعلامي متخصص في تحليل المشاعر والتوجهات.
استناداً إلى البيانات التالية، أعد تقريراً عن توزيع المشاعر في الإعلام يتضمن:
1. تحليل التوزيع العام للمشاعر
2. المصادر الأكثر إيجابية أو سلبية
3. العلاقة بين المشاعر والأزمات
4. التوقعات والمؤشرات

{base_context}

قدم تحليلاً دقيقاً لمؤشرات المشاعر الإعلامية.""",

        "sources": f"""أنت محلل بيانات متخصص في تحليل المصادر الإخبارية.
استناداً إلى البيانات التالية، أعد تقريراً عن نشاط المصادر يتضمن:
1. ترتيب وتقييم أكثر المصادر نشاطاً
2. جودة وتوجه كل مصدر
3. التوازن الإعلامي بين المصادر
4. مقترحات لتحسين رصد المصادر

{base_context}

قدم تحليلاً شاملاً لخريطة المصادر الإخبارية.""",
    }

    return prompts.get(report_type, prompts["overview"])


def _generate_fallback_report(report_type: str, hours: int, data: dict) -> str:
    """تقرير بديل بدون Claude API"""
    pos = data['sentiment_dist'].get('positive', 0)
    neg = data['sentiment_dist'].get('negative', 0)
    neu = data['sentiment_dist'].get('neutral', 0)
    total = data['total']

    titles = {
        "overview": "التقرير الشامل للمشهد الإعلامي",
        "crisis": "تقرير تحليل الأزمات",
        "sentiment": "تقرير تحليل المشاعر الإعلامية",
        "sources": "تقرير نشاط المصادر الإخبارية",
    }

    lines = [
        f"# {titles.get(report_type, 'التقرير الإعلامي')}",
        f"**الفترة الزمنية:** آخر {hours} ساعة",
        "",
        "## الملخص التنفيذي",
        f"رُصد خلال الفترة المحددة **{total}** مقالة إخبارية من {len(data['top_sources'])} مصادر.",
        "",
        "## توزيع المشاعر",
        f"- الإيجابي: {pos} مقالة ({round(pos/total*100) if total else 0}%)",
        f"- السلبي: {neg} مقالة ({round(neg/total*100) if total else 0}%)",
        f"- المحايد: {neu} مقالة ({round(neu/total*100) if total else 0}%)",
        "",
        "## الأزمات المرصودة",
        f"رُصد **{data['crisis_count']}** مقالة تتعلق بالأزمات ({data['crisis_rate']}% من الإجمالي).",
    ]

    if data['crisis_types']:
        lines.append("")
        lines.append("### أنواع الأزمات:")
        for t, c in data['crisis_types'].items():
            lines.append(f"- {t}: {c} مقالة")

    if data['active_alerts']:
        lines.append("")
        lines.append("## التنبيهات النشطة")
        for a in data['active_alerts']:
            lines.append(f"- [{a['severity']}] {a['title']}")

    if data['top_sources']:
        lines.append("")
        lines.append("## أكثر المصادر نشاطاً")
        for name, count in data['top_sources']:
            lines.append(f"- {name}: {count} مقالة")

    lines.extend([
        "",
        "---",
        "*ملاحظة: هذا تقرير آلي. لتفعيل التقارير الذكية بـ Claude AI، يُرجى تعيين ANTHROPIC_API_KEY في ملف .env*",
    ])

    return "\n".join(lines)


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    request: ReportRequest,
    db: AsyncSession = Depends(get_db),
):
    """توليد تقرير ذكي باستخدام Claude API"""
    if request.report_type not in REPORT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"نوع التقرير غير صالح. الأنواع المتاحة: {list(REPORT_TYPES.keys())}"
        )

    data = await _gather_report_data(db, request.hours)
    model_used = "rule-based"
    content = ""

    # محاولة استخدام Claude API إذا كان المفتاح موجوداً
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if api_key:
        try:
            import httpx
            prompt = _build_prompt(request.report_type, request.hours, data)
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-6",
                        "max_tokens": 4000,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                response.raise_for_status()
                result = response.json()
            content = result["content"][0]["text"]
            model_used = "claude-sonnet-4-6"
            logger.info("Report generated with Claude API via httpx")
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            content = _generate_fallback_report(request.report_type, request.hours, data)
    else:
        logger.info("No ANTHROPIC_API_KEY, using rule-based report")
        content = _generate_fallback_report(request.report_type, request.hours, data)

    return ReportResponse(
        report_type=request.report_type,
        title=REPORT_TYPES[request.report_type],
        content=content,
        generated_at=datetime.now(timezone.utc).isoformat(),
        data_period_hours=request.hours,
        total_articles=data["total"],
        model_used=model_used,
    )


@router.get("/types")
async def get_report_types():
    """الحصول على أنواع التقارير المتاحة"""
    return [
        {"id": k, "label": v} for k, v in REPORT_TYPES.items()
    ]
