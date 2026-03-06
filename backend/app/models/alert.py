from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class CrisisAlert(Base):
    __tablename__ = "crisis_alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    crisis_type = Column(String(100), nullable=False)  # political, economic, security, health, natural
    severity = Column(String(20), nullable=False)  # low, medium, high, critical
    severity_score = Column(Float, default=0.0)

    # Related articles
    article_ids = Column(Text, nullable=True)  # JSON array of article IDs
    articles_count = Column(Integer, default=0)

    # Geographic info
    location = Column(String(200), nullable=True)
    region = Column(String(100), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(200), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    # Keywords that triggered alert
    trigger_keywords = Column(Text, nullable=True)  # JSON array

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
