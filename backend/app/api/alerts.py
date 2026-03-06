"""
API endpoints للتنبيهات والأزمات
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from app.database import get_db
from app.models.alert import CrisisAlert
from app.services.cache_service import cache

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    crisis_type: str
    severity: str
    severity_score: float
    articles_count: int
    is_active: bool
    is_acknowledged: bool
    trigger_keywords: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AcknowledgeRequest(BaseModel):
    acknowledged_by: str


@router.get("/", response_model=List[AlertResponse])
async def list_alerts(
    active_only: bool = True,
    crisis_type: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """قائمة التنبيهات"""
    query = select(CrisisAlert)

    if active_only:
        query = query.where(CrisisAlert.is_active == True)
    if crisis_type:
        query = query.where(CrisisAlert.crisis_type == crisis_type)
    if severity:
        query = query.where(CrisisAlert.severity == severity)

    query = query.order_by(desc(CrisisAlert.created_at)).limit(limit)

    result = await db.execute(query)
    alerts = result.scalars().all()
    return alerts


@router.get("/summary")
async def get_alerts_summary(db: AsyncSession = Depends(get_db)):
    """ملخص التنبيهات النشطة"""
    cache_key = "alerts:summary"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(CrisisAlert).where(CrisisAlert.is_active == True)
    )
    active_alerts = result.scalars().all()

    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    type_counts = {}

    for alert in active_alerts:
        if alert.severity in severity_counts:
            severity_counts[alert.severity] += 1
        if alert.crisis_type not in type_counts:
            type_counts[alert.crisis_type] = 0
        type_counts[alert.crisis_type] += 1

    response = {
        "total_active": len(active_alerts),
        "by_severity": severity_counts,
        "by_type": type_counts,
        "has_critical": severity_counts["critical"] > 0,
        "latest_alert": AlertResponse.model_validate(active_alerts[0]).model_dump()
        if active_alerts else None,
    }

    await cache.set(cache_key, response, ttl=30)
    return response


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    request: AcknowledgeRequest,
    db: AsyncSession = Depends(get_db),
):
    """الإقرار بتنبيه الأزمة"""
    result = await db.execute(select(CrisisAlert).where(CrisisAlert.id == alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_acknowledged = True
    alert.acknowledged_by = request.acknowledged_by
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()

    await cache.delete("alerts:summary")
    return {"status": "acknowledged", "alert_id": alert_id}


@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """إغلاق تنبيه الأزمة"""
    result = await db.execute(select(CrisisAlert).where(CrisisAlert.id == alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_active = False
    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()

    await cache.delete("alerts:summary")
    return {"status": "resolved", "alert_id": alert_id}
