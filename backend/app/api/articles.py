"""
API endpoints للمقالات
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.article import Article
from app.services.cache_service import cache
from app.config import settings

router = APIRouter(prefix="/articles", tags=["articles"])


class ArticleResponse(BaseModel):
    id: int
    title: str
    summary: Optional[str]
    url: str
    image_url: Optional[str]
    source_name: Optional[str]
    published_at: Optional[datetime]
    sentiment: Optional[str]
    sentiment_score: Optional[float]
    is_crisis: bool
    crisis_score: float
    crisis_type: Optional[str]
    keywords: Optional[str]
    fetched_at: datetime

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    articles: List[ArticleResponse]
    total: int
    page: int
    page_size: int


@router.get("/", response_model=ArticleListResponse)
async def list_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sentiment: Optional[str] = None,
    crisis_only: bool = False,
    source_name: Optional[str] = None,
    search: Optional[str] = None,
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """قائمة المقالات مع فلترة وبحث"""
    cache_key = f"articles:{page}:{page_size}:{sentiment}:{crisis_only}:{source_name}:{search}:{hours}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    time_filter = datetime.now(timezone.utc) - timedelta(hours=hours)
    query = select(Article).where(Article.fetched_at >= time_filter)

    if sentiment:
        query = query.where(Article.sentiment == sentiment)
    if crisis_only:
        query = query.where(Article.is_crisis == True)
    if source_name:
        query = query.where(Article.source_name.ilike(f"%{source_name}%"))
    if search:
        query = query.where(
            or_(
                Article.title.ilike(f"%{search}%"),
                Article.content.ilike(f"%{search}%"),
            )
        )

    # العدد الكلي
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # الصفحات
    query = query.order_by(desc(Article.fetched_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    articles = result.scalars().all()

    response = {
        "articles": [ArticleResponse.model_validate(a).model_dump() for a in articles],
        "total": total,
        "page": page,
        "page_size": page_size,
    }

    await cache.set(cache_key, response, ttl=60)
    return response


@router.get("/stats")
async def get_stats(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """إحصائيات المقالات"""
    cache_key = f"stats:{hours}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    time_filter = datetime.now(timezone.utc) - timedelta(hours=hours)

    # إجمالي المقالات
    total_result = await db.execute(
        select(func.count(Article.id)).where(Article.fetched_at >= time_filter)
    )
    total = total_result.scalar() or 0

    # توزيع المشاعر
    sentiment_result = await db.execute(
        select(Article.sentiment, func.count(Article.id))
        .where(Article.fetched_at >= time_filter, Article.is_analyzed == True)
        .group_by(Article.sentiment)
    )
    sentiment_dist = {}
    for row in sentiment_result:
        if row[0]:
            sentiment_dist[row[0]] = row[1]

    # أزمات نشطة
    crisis_result = await db.execute(
        select(func.count(Article.id)).where(
            Article.fetched_at >= time_filter,
            Article.is_crisis == True,
        )
    )
    crisis_count = crisis_result.scalar() or 0

    # أكثر المصادر نشاطاً
    sources_result = await db.execute(
        select(Article.source_name, func.count(Article.id).label("count"))
        .where(Article.fetched_at >= time_filter)
        .group_by(Article.source_name)
        .order_by(desc("count"))
        .limit(10)
    )
    top_sources = [
        {"name": row[0], "count": row[1]}
        for row in sources_result
        if row[0]
    ]

    # توزيع أنواع الأزمات
    crisis_types_result = await db.execute(
        select(Article.crisis_type, func.count(Article.id).label("count"))
        .where(
            Article.fetched_at >= time_filter,
            Article.is_crisis == True,
            Article.crisis_type.isnot(None),
        )
        .group_by(Article.crisis_type)
    )
    crisis_types = {row[0]: row[1] for row in crisis_types_result}

    # مقالات حسب الساعة - متوافق مع PostgreSQL و SQLite
    is_sqlite = "sqlite" in settings.DATABASE_URL

    if is_sqlite:
        hour_expr = func.strftime("%Y-%m-%d %H:00:00", Article.fetched_at).label("hour")
    else:
        hour_expr = func.date_trunc("hour", Article.fetched_at).label("hour")

    hourly_result = await db.execute(
        select(hour_expr, func.count(Article.id).label("count"))
        .where(Article.fetched_at >= time_filter)
        .group_by("hour")
        .order_by("hour")
    )
    hourly_data = []
    for row in hourly_result:
        hour_val = row[0]
        if hour_val:
            hour_str = hour_val if isinstance(hour_val, str) else hour_val.isoformat()
            hourly_data.append({"hour": hour_str, "count": row[1]})

    response = {
        "total_articles": total,
        "crisis_articles": crisis_count,
        "crisis_rate": round(crisis_count / total * 100, 1) if total > 0 else 0,
        "sentiment_distribution": sentiment_dist,
        "top_sources": top_sources,
        "crisis_types": crisis_types,
        "hourly_data": hourly_data,
        "period_hours": hours,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    await cache.set(cache_key, response, ttl=120)
    return response


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(article_id: int, db: AsyncSession = Depends(get_db)):
    """تفاصيل مقالة واحدة"""
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.views_count += 1
    await db.commit()
    return article
