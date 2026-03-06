from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class NewsSource(Base):
    __tablename__ = "news_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    name_ar = Column(String(200), nullable=True)
    url = Column(String(500), nullable=False, unique=True)
    rss_url = Column(String(500), nullable=False)
    category = Column(String(100), nullable=True)  # political, economic, social, sports
    country = Column(String(100), default="Saudi Arabia")
    language = Column(String(10), default="ar")
    is_active = Column(Boolean, default=True)
    reliability_score = Column(Float, default=0.8)
    last_fetched = Column(DateTime(timezone=True), nullable=True)
    articles_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    articles = relationship("Article", back_populates="source", lazy="select")
