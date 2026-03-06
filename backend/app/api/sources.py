"""
API endpoints لمصادر الأخبار
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.source import NewsSource

router = APIRouter(prefix="/sources", tags=["sources"])


class SourceResponse(BaseModel):
    id: int
    name: str
    name_ar: Optional[str]
    url: str
    rss_url: str
    category: Optional[str]
    country: Optional[str]
    is_active: bool
    reliability_score: float
    last_fetched: Optional[datetime]
    articles_count: int
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[SourceResponse])
async def list_sources(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """قائمة مصادر الأخبار"""
    query = select(NewsSource)
    if active_only:
        query = query.where(NewsSource.is_active == True)
    query = query.order_by(desc(NewsSource.articles_count))

    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/{source_id}/toggle")
async def toggle_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """تفعيل/تعطيل مصدر"""
    result = await db.execute(select(NewsSource).where(NewsSource.id == source_id))
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    source.is_active = not source.is_active
    await db.commit()

    return {"status": "updated", "is_active": source.is_active}
