from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.sql import func
from app.database import Base


class Keyword(Base):
    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True, index=True)
    term = Column(String(200), nullable=False, unique=True)
    term_ar = Column(String(200), nullable=True)
    category = Column(String(100), nullable=True)
    is_crisis_trigger = Column(Boolean, default=False)
    crisis_weight = Column(Float, default=0.5)
    is_active = Column(Boolean, default=True)
    occurrences = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
