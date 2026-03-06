"""
خدمة جمع الأخبار من مصادر RSS العربية
Arabic RSS News Collector Service
نطاق الرصد: منتدى الإعلام السعودي — 20 يناير 2026 حتى 20 فبراير 2026
"""
import asyncio
import feedparser
import aiohttp
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.article import Article
from app.models.source import NewsSource
from app.config import settings
from app.services.nlp_analyzer import MONITOR_START, MONITOR_END, is_within_monitor_period

logger = logging.getLogger(__name__)

# مصادر الأخبار العربية الرئيسية
ARABIC_RSS_SOURCES = [
    # ── سعودية ──────────────────────────────────────────────────
    # ── نشطة / تعمل ──────────────────────────────────────────────
    {
        "name": "Sabq",
        "name_ar": "سبق",
        "url": "https://sabq.org",
        "rss_url": "https://sabq.org/rss",
        "category": "general",
        "country": "Saudi Arabia",
    },
    {
        "name": "Okaz",
        "name_ar": "عكاظ",
        "url": "https://www.okaz.com.sa",
        "rss_url": "https://www.okaz.com.sa/rss",
        "category": "general",
        "country": "Saudi Arabia",
    },
    {
        "name": "Al Watan",
        "name_ar": "الوطن",
        "url": "https://www.alwatan.com.sa",
        "rss_url": "https://www.alwatan.com.sa/rssFeed/1",  # 50 مقالة ✓ (أخبار محلية)
        "category": "general",
        "country": "Saudi Arabia",
    },
    {
        "name": "SPA - Saudi Press Agency",
        "name_ar": "وكالة الأنباء السعودية",
        "url": "https://www.spa.gov.sa",
        "rss_url": "https://www.spa.gov.sa/rss/latest-news.rss",
        "category": "official",
        "country": "Saudi Arabia",
    },
    {
        "name": "Arab News",
        "name_ar": "Arab News",
        "url": "https://www.arabnews.com",
        "rss_url": "https://www.arabnews.com/rss.xml",
        "category": "general",
        "country": "Saudi Arabia",
    },
    # ── إقليمية ─────────────────────────────────────────────────
    {
        "name": "Al Jazeera",
        "name_ar": "الجزيرة",
        "url": "https://www.aljazeera.net",
        "rss_url": "https://www.aljazeera.net/rss",          # /xml/rss/all.xml → 404
        "category": "general",
        "country": "Qatar",
    },
    {
        "name": "Sky News Arabia",
        "name_ar": "سكاي نيوز عربية",
        "url": "https://www.skynewsarabia.com",
        "rss_url": "https://www.skynewsarabia.com/rss",
        "category": "general",
        "country": "UAE",
    },
    # ── دولية بالعربية ───────────────────────────────────────────
    {
        "name": "BBC Arabic",
        "name_ar": "بي بي سي عربي",
        "url": "https://www.bbc.com/arabic",
        "rss_url": "https://feeds.bbci.co.uk/arabic/rss.xml",
        "category": "international",
        "country": "UK",
    },
    {
        "name": "RT Arabic",
        "name_ar": "روسيا اليوم عربي",
        "url": "https://arabic.rt.com",
        "rss_url": "https://arabic.rt.com/rss/",
        "category": "international",
        "country": "Russia",
    },
    # ── مصادر جديدة مؤكدة (مارس 2026) ──────────────────────────
    {
        "name": "Asharq Al-Awsat",
        "name_ar": "الشرق الأوسط",
        "url": "https://aawsat.com",
        "rss_url": "https://aawsat.com/feed/press",   # 20 مقالة ✓
        "category": "general",
        "country": "Saudi Arabia",
    },
    {
        "name": "Makkah News",
        "name_ar": "مكة",
        "url": "https://www.makkahnews.sa",
        "rss_url": "https://www.makkahnews.sa/rss",   # 16 مقالة ✓
        "category": "general",
        "country": "Saudi Arabia",
    },
    # ── محجوبة RSS ────────────────────────────────────────────
    # العربية:   alarabiya.net → HTTP 403
    # فرانس 24:  france24.com/ar/rss → HTTP 403
    # الرياض:    alriyadh.com/rss → HTTP 404
    # الأناضول:  aa.com.tr/ar/rss → Connection error
    # SPA:       spa.gov.sa/rss.xml → موجود لكن فارغ
]


class RSSCollector:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; SaudiMediaMonitor/1.0)"
            }
        )
        return self

    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()

    async def fetch_rss(self, rss_url: str) -> Optional[feedparser.FeedParserDict]:
        """جلب بيانات RSS من URL"""
        try:
            async with self.session.get(rss_url, ssl=False) as response:
                if response.status == 200:
                    content = await response.text()
                    return feedparser.parse(content)
                else:
                    logger.warning(f"RSS fetch failed for {rss_url}: HTTP {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Error fetching RSS {rss_url}: {e}")
            return None

    def clean_html(self, text: str) -> str:
        """تنظيف HTML من النص"""
        if not text:
            return ""
        # تجنب تحذير BeautifulSoup إن لم يكن النص HTML
        if "<" not in text:
            return text.strip()
        soup = BeautifulSoup(text, "html.parser")
        return soup.get_text(separator=" ", strip=True)

    def parse_date(self, date_str: str) -> Optional[datetime]:
        """تحويل تاريخ RSS إلى datetime"""
        if not date_str:
            return None
        try:
            import email.utils
            parsed = email.utils.parsedate_to_datetime(date_str)
            return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
        except Exception:
            try:
                from dateutil import parser as date_parser
                return date_parser.parse(date_str)
            except Exception:
                return datetime.now(timezone.utc)

    async def article_exists(self, url: str) -> bool:
        """التحقق من وجود المقالة مسبقاً"""
        result = await self.db.execute(
            select(Article).where(Article.url == url).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def save_article(self, article_data: Dict, source: NewsSource) -> Optional[Article]:
        """حفظ مقالة جديدة في قاعدة البيانات"""
        url = article_data.get("url", "")
        if not url or await self.article_exists(url):
            return None

        article = Article(
            title=article_data.get("title", "")[:500],
            content=article_data.get("content", ""),
            summary=article_data.get("summary", ""),
            url=url[:1000],
            image_url=article_data.get("image_url", "")[:1000] if article_data.get("image_url") else None,
            author=article_data.get("author", "")[:200] if article_data.get("author") else None,
            published_at=article_data.get("published_at"),
            source_id=source.id,
            source_name=source.name_ar or source.name,
            language="ar",
            is_analyzed=False,
        )

        self.db.add(article)
        await self.db.commit()
        await self.db.refresh(article)
        return article

    async def process_source(self, source_config: Dict) -> List[Article]:
        """معالجة مصدر RSS واحد"""
        # البحث عن المصدر أو إنشاؤه
        result = await self.db.execute(
            select(NewsSource).where(NewsSource.rss_url == source_config["rss_url"])
        )
        source = result.scalar_one_or_none()

        if not source:
            source = NewsSource(**source_config)
            self.db.add(source)
            await self.db.commit()
            await self.db.refresh(source)

        if not source.is_active:
            return []

        feed = await self.fetch_rss(source.rss_url)
        if not feed or not feed.entries:
            logger.warning(f"No entries found for {source.name}")
            return []

        new_articles = []
        for entry in feed.entries[:settings.MAX_ARTICLES_PER_SOURCE]:
            try:
                # استخراج الصورة
                image_url = None
                if hasattr(entry, "media_content") and entry.media_content:
                    image_url = entry.media_content[0].get("url")
                elif hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
                    image_url = entry.media_thumbnail[0].get("url")
                elif hasattr(entry, "enclosures") and entry.enclosures:
                    for enc in entry.enclosures:
                        if enc.get("type", "").startswith("image"):
                            image_url = enc.get("href")
                            break

                # استخراج المحتوى
                content = ""
                if hasattr(entry, "content") and entry.content:
                    content = self.clean_html(entry.content[0].value)
                elif hasattr(entry, "summary"):
                    content = self.clean_html(entry.summary)

                published_at = self.parse_date(entry.get("published", ""))

                # ── فلتر التاريخ: 20 يناير – 20 فبراير 2026 ──────────
                # إذا كان تاريخ النشر معروفاً وخارج النطاق → تجاهل
                if published_at and not is_within_monitor_period(published_at):
                    logger.debug(
                        f"Skipped (out of range {published_at.date()}): "
                        f"{entry.get('title','')[:60]}"
                    )
                    continue
                # إذا لم يُعرف تاريخ النشر → تجاهل أيضاً (حماية من الضجيج)
                if published_at is None:
                    logger.debug(f"Skipped (no date): {entry.get('title','')[:60]}")
                    continue
                # ─────────────────────────────────────────────────────

                article_data = {
                    "title":        self.clean_html(entry.get("title", "")).strip(),
                    "content":      content[:5000],
                    "summary":      self.clean_html(entry.get("summary", ""))[:1000],
                    "url":          entry.get("link", "").strip(),
                    "image_url":    image_url,
                    "author":       entry.get("author", ""),
                    "published_at": published_at,
                }

                if article_data["title"] and article_data["url"]:
                    article = await self.save_article(article_data, source)
                    if article:
                        new_articles.append(article)

            except Exception as e:
                logger.error(f"Error processing entry from {source.name}: {e}")
                continue

        # تحديث وقت آخر جلب
        source.last_fetched = datetime.now(timezone.utc)
        source.articles_count += len(new_articles)
        await self.db.commit()

        logger.info(f"Collected {len(new_articles)} new articles from {source.name}")
        return new_articles

    async def collect_all(self) -> Dict:
        """جمع الأخبار من جميع المصادر — كل مصدر بجلسة DB مستقلة"""
        from app.database import AsyncSessionLocal

        total_new = 0
        results = {}

        async def process_one(src_config: Dict) -> tuple:
            """معالجة مصدر واحد بجلسة DB مستقلة"""
            async with AsyncSessionLocal() as session:
                async with RSSCollector(session) as col:
                    articles = await col.process_source(src_config)
                    return src_config["name"], len(articles)

        # جلب RSS بشكل متوازٍ (network I/O)، ثم حفظ كل مصدر مستقل في DB
        source_tasks = [process_one(src) for src in ARABIC_RSS_SOURCES]
        source_results = await asyncio.gather(*source_tasks, return_exceptions=True)

        for result in source_results:
            if isinstance(result, Exception):
                logger.error(f"Source error: {result}")
            else:
                name, count = result
                total_new += count
                results[name] = {"status": "success", "count": count}

        # المصادر التي فشلت
        processed = set(results.keys())
        for src in ARABIC_RSS_SOURCES:
            if src["name"] not in processed:
                results[src["name"]] = {"status": "error", "count": 0}

        return {
            "total_new_articles": total_new,
            "sources": results,
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }
