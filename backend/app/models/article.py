from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    url = Column(String(1000), nullable=False, unique=True)
    image_url = Column(String(1000), nullable=True)
    author = Column(String(200), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

    # Source
    source_id = Column(Integer, ForeignKey("news_sources.id"), nullable=True)
    source_name = Column(String(200), nullable=True)

    # NLP Analysis
    sentiment = Column(String(20), nullable=True)  # positive, negative, neutral
    sentiment_score = Column(Float, nullable=True)  # -1 to 1
    is_crisis = Column(Boolean, default=False)
    crisis_score = Column(Float, default=0.0)
    crisis_type = Column(String(100), nullable=True)  # political, economic, security, health
    keywords = Column(Text, nullable=True)  # JSON array as text
    entities = Column(Text, nullable=True)  # JSON: persons, organizations, locations
    topics = Column(Text, nullable=True)  # JSON array

    # Metadata
    language = Column(String(10), default="ar")
    category = Column(String(100), nullable=True)
    views_count = Column(Integer, default=0)
    is_analyzed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source = relationship("NewsSource", back_populates="articles")
