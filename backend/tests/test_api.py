"""
اختبارات نقاط الوصول API
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models.article import Article
from app.models.alert import CrisisAlert
from datetime import datetime, timezone

# قاعدة بيانات اختبار في الذاكرة
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def test_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(test_db):
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def sample_article(test_db):
    article = Article(
        title="خبر اختبار",
        content="محتوى الخبر للاختبار",
        url="https://example.com/article/1",
        source_name="مصدر تجريبي",
        sentiment="positive",
        sentiment_score=0.7,
        is_crisis=False,
        crisis_score=0.1,
        is_analyzed=True,
        published_at=datetime.now(timezone.utc),
    )
    test_db.add(article)
    await test_db.commit()
    await test_db.refresh(article)
    return article


@pytest_asyncio.fixture
async def sample_alert(test_db):
    alert = CrisisAlert(
        title="تنبيه اختبار",
        description="وصف التنبيه",
        crisis_type="security",
        severity="high",
        severity_score=0.8,
        articles_count=5,
        is_active=True,
    )
    test_db.add(alert)
    await test_db.commit()
    await test_db.refresh(alert)
    return alert


class TestRoot:
    @pytest.mark.asyncio
    async def test_root(self, client):
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert data["status"] == "running"

    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestArticlesAPI:
    @pytest.mark.asyncio
    async def test_list_articles_empty(self, client):
        response = await client.get("/api/v1/articles/")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        assert "total" in data
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_articles_with_data(self, client, sample_article):
        response = await client.get("/api/v1/articles/")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_get_article_by_id(self, client, sample_article):
        response = await client.get(f"/api/v1/articles/{sample_article.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "خبر اختبار"

    @pytest.mark.asyncio
    async def test_get_article_not_found(self, client):
        response = await client.get("/api/v1/articles/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_filter_by_sentiment(self, client, sample_article):
        response = await client.get("/api/v1/articles/?sentiment=positive")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_stats_endpoint(self, client, sample_article):
        response = await client.get("/api/v1/articles/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_articles" in data
        assert "sentiment_distribution" in data


class TestAlertsAPI:
    @pytest.mark.asyncio
    async def test_list_alerts_empty(self, client):
        response = await client.get("/api/v1/alerts/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_list_alerts_with_data(self, client, sample_alert):
        response = await client.get("/api/v1/alerts/")
        assert response.status_code == 200
        alerts = response.json()
        assert len(alerts) >= 1
        assert alerts[0]["crisis_type"] == "security"

    @pytest.mark.asyncio
    async def test_alerts_summary(self, client, sample_alert):
        response = await client.get("/api/v1/alerts/summary")
        assert response.status_code == 200
        data = response.json()
        assert "total_active" in data
        assert "by_severity" in data

    @pytest.mark.asyncio
    async def test_acknowledge_alert(self, client, sample_alert):
        response = await client.post(
            f"/api/v1/alerts/{sample_alert.id}/acknowledge",
            json={"acknowledged_by": "مسؤول الاختبار"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "acknowledged"

    @pytest.mark.asyncio
    async def test_resolve_alert(self, client, sample_alert):
        response = await client.post(f"/api/v1/alerts/{sample_alert.id}/resolve")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "resolved"
