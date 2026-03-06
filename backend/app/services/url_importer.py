"""
مستورد مقالات الأرشيف — يجلب مقالات بروابط مباشرة
Archive Article Importer — fetches specific article URLs
يُستخدم لاستيراد مقالات من فترة منتدى الإعلام السعودي (يناير-فبراير 2026)
"""
import asyncio
import aiohttp
import ssl
import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Optional
from urllib.parse import urlparse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from bs4 import BeautifulSoup
from app.models.article import Article
from app.models.source import NewsSource
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

# ── روابط مقالات أرشيف منتدى الإعلام السعودي (يناير-فبراير 2026) ──────────
FORUM_ARCHIVE_URLS: List[Dict] = [

    # ── وكالة الأنباء السعودية (SPA) ────────────────────────────────────
    {"url": "https://www.spa.gov.sa/N2404216", "source": "وكالة الأنباء السعودية", "source_en": "SPA"},
    {"url": "https://www.spa.gov.sa/N2402875", "source": "وكالة الأنباء السعودية", "source_en": "SPA"},
    {"url": "https://www.spa.gov.sa/N2368515", "source": "وكالة الأنباء السعودية", "source_en": "SPA"},
    {"url": "https://www.spa.gov.sa/N2386121", "source": "وكالة الأنباء السعودية", "source_en": "SPA"},
    {"url": "https://www.spa.gov.sa/N2500915", "source": "وكالة الأنباء السعودية", "source_en": "SPA"},

    # ── صحيفة عكاظ (Okaz) ────────────────────────────────────────────────
    {"url": "https://www.okaz.com.sa/news/local/2214358", "source": "عكاظ", "source_en": "Okaz"},
    {"url": "https://www.okaz.com.sa/local/na/2233592",   "source": "عكاظ", "source_en": "Okaz"},
    {"url": "https://www.okaz.com.sa/local/na/2233846",   "source": "عكاظ", "source_en": "Okaz"},
    {"url": "https://www.okaz.com.sa/local/saudi-arabia/2234314", "source": "عكاظ", "source_en": "Okaz"},
    {"url": "https://www.okaz.com.sa/local/saudi-arabia/2233945", "source": "عكاظ", "source_en": "Okaz"},
    {"url": "https://www.okaz.com.sa/economy/na/2231722",         "source": "عكاظ", "source_en": "Okaz"},
    {"url": "https://www.okaz.com.sa/articles/authors/2234703",   "source": "عكاظ", "source_en": "Okaz"},

    # ── صحيفة الشرق الأوسط (Asharq Al-Awsat) ────────────────────────────
    {"url": "https://aawsat.com/يوميات-الشرق/5236486", "source": "الشرق الأوسط", "source_en": "Asharq Al-Awsat"},
    {"url": "https://aawsat.com/يوميات-الشرق/5236353", "source": "الشرق الأوسط", "source_en": "Asharq Al-Awsat"},
    {"url": "https://aawsat.com/يوميات-الشرق/5237389", "source": "الشرق الأوسط", "source_en": "Asharq Al-Awsat"},
    {"url": "https://aawsat.com/يوميات-الشرق/5237301", "source": "الشرق الأوسط", "source_en": "Asharq Al-Awsat"},
    {"url": "https://aawsat.com/يوميات-الشرق/5235777", "source": "الشرق الأوسط", "source_en": "Asharq Al-Awsat"},

    # ── جريدة الرياض (Al Riyadh) ─────────────────────────────────────────
    {"url": "https://www.alriyadh.com/2173749", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2174256", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2173410", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2173869", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2173018", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2172909", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2173375", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2168498", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2165317", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2170883", "source": "الرياض", "source_en": "Al Riyadh"},
    {"url": "https://www.alriyadh.com/2174150", "source": "الرياض", "source_en": "Al Riyadh"},

    # ── جريدة الوطن (Al Watan) ──────────────────────────────────────────
    {"url": "https://www.alwatan.com.sa/article/1176652", "source": "الوطن", "source_en": "Al Watan"},
    {"url": "https://www.alwatan.com.sa/article/1176739", "source": "الوطن", "source_en": "Al Watan"},
    {"url": "https://www.alwatan.com.sa/article/1176526", "source": "الوطن", "source_en": "Al Watan"},
    {"url": "https://www.alwatan.com.sa/article/1142498", "source": "الوطن", "source_en": "Al Watan"},

    # ── وكالة الأناضول عربي (Anadolu) ───────────────────────────────────
    {"url": "https://www.aa.com.tr/ar/الدول-العربية/بمشاركة-مئات-الخبراء-انطلاق-المنتدى-السعودي-للإعلام-2026/3817682",
     "source": "وكالة الأناضول", "source_en": "Anadolu Agency"},

    # ── صحيفة مكة الإلكترونية ────────────────────────────────────────────
    {"url": "https://www.makkahnews.sa/5491033.html", "source": "مكة", "source_en": "Makkah News"},
]

# ── خريطة Domain → اسم المصدر ──────────────────────────────────────────
DOMAIN_SOURCE_MAP = {
    "spa.gov.sa":      ("وكالة الأنباء السعودية", "SPA"),
    "okaz.com.sa":     ("عكاظ",                  "Okaz"),
    "aawsat.com":      ("الشرق الأوسط",           "Asharq Al-Awsat"),
    "alriyadh.com":    ("الرياض",                 "Al Riyadh"),
    "alwatan.com.sa":  ("الوطن",                  "Al Watan"),
    "aa.com.tr":       ("وكالة الأناضول",          "Anadolu Agency"),
    "makkahnews.sa":   ("مكة",                    "Makkah News"),
    "aljazeera.net":   ("الجزيرة",                "Al Jazeera"),
    "skynewsarabia.com": ("سكاي نيوز عربية",      "Sky News Arabia"),
    "bbc.com":         ("بي بي سي عربي",           "BBC Arabic"),
}


def get_source_from_url(url: str) -> tuple:
    """استخراج اسم المصدر من URL"""
    try:
        domain = urlparse(url).netloc.lstrip("www.")
        for key, val in DOMAIN_SOURCE_MAP.items():
            if key in domain:
                return val
    except Exception:
        pass
    return ("مصدر إخباري", "Unknown")


def extract_date_from_html(soup: BeautifulSoup) -> Optional[datetime]:
    """استخراج تاريخ النشر من meta tags أو JSON-LD"""
    # JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string or "")
            for key in ("datePublished", "dateCreated", "dateModified"):
                val = data.get(key) if isinstance(data, dict) else None
                if not val and isinstance(data, list):
                    for item in data:
                        val = item.get(key) if isinstance(item, dict) else None
                        if val:
                            break
                if val:
                    from dateutil import parser as dp
                    return dp.parse(val).replace(tzinfo=timezone.utc)
        except Exception:
            pass

    # Open Graph / meta tags
    for attr in [
        ("property", "article:published_time"),
        ("property", "og:article:published_time"),
        ("name",     "publish-date"),
        ("name",     "date"),
        ("itemprop", "datePublished"),
    ]:
        tag = soup.find("meta", {attr[0]: attr[1]})
        if tag and tag.get("content"):
            try:
                from dateutil import parser as dp
                return dp.parse(tag["content"]).replace(tzinfo=timezone.utc)
            except Exception:
                pass
    return None


def extract_content_trafilatura(html: str) -> str:
    """استخراج محتوى المقالة بـ trafilatura"""
    try:
        import trafilatura
        text = trafilatura.extract(html, include_comments=False, include_tables=False)
        return (text or "").strip()[:5000]
    except Exception:
        return ""


class ArchiveImporter:
    """يستورد مقالات أرشيفية بجلب صفحاتها مباشرة"""

    SSL_CTX = ssl.create_default_context()

    def __init__(self):
        self.SSL_CTX.check_hostname = False
        self.SSL_CTX.verify_mode = ssl.CERT_NONE

    def _make_session(self) -> aiohttp.ClientSession:
        connector = aiohttp.TCPConnector(ssl=self.SSL_CTX)
        return aiohttp.ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=20),
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "ar,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,*/*",
            },
        )

    async def article_exists(self, db: AsyncSession, url: str) -> bool:
        result = await db.execute(select(Article.id).where(Article.url == url).limit(1))
        return result.scalar_one_or_none() is not None

    async def get_or_create_source(
        self, db: AsyncSession, name_ar: str, name_en: str, url: str
    ) -> NewsSource:
        domain = urlparse(url).netloc
        result = await db.execute(
            select(NewsSource).where(NewsSource.name == name_en).limit(1)
        )
        source = result.scalar_one_or_none()
        if not source:
            source = NewsSource(
                name=name_en,
                name_ar=name_ar,
                url=f"https://{domain}",
                rss_url=f"https://{domain}/rss",
                category="general",
                country="Saudi Arabia",
                is_active=True,
            )
            db.add(source)
            await db.flush()
        return source

    async def fetch_article(
        self, session: aiohttp.ClientSession, url: str, source_name_ar: str
    ) -> Optional[Dict]:
        """جلب وتحليل مقالة واحدة"""
        try:
            async with session.get(url) as resp:
                if resp.status != 200:
                    logger.warning(f"HTTP {resp.status} — {url}")
                    return None
                html = await resp.text(errors="replace")
        except Exception as e:
            logger.error(f"Fetch error {url}: {e}")
            return None

        soup = BeautifulSoup(html, "html.parser")

        # العنوان
        title = ""
        og_title = soup.find("meta", property="og:title")
        if og_title:
            title = og_title.get("content", "").strip()
        if not title:
            h1 = soup.find("h1")
            title = h1.get_text(strip=True) if h1 else ""
        if not title:
            title_tag = soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else ""

        # المحتوى
        content = extract_content_trafilatura(html)
        if not content:
            # fallback: BeautifulSoup
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            content = soup.get_text(separator=" ", strip=True)[:3000]

        # الملخص
        og_desc = soup.find("meta", property="og:description")
        summary = og_desc.get("content", "").strip() if og_desc else ""
        if not summary:
            summary = content[:300]

        # الصورة
        og_img = soup.find("meta", property="og:image")
        image_url = og_img.get("content", "") if og_img else None

        # التاريخ
        published_at = extract_date_from_html(soup)

        if not title or not content:
            logger.warning(f"Skipped (no title/content): {url}")
            return None

        return {
            "title":        title[:500],
            "content":      content,
            "summary":      summary[:1000],
            "url":          url,
            "image_url":    image_url,
            "published_at": published_at,
        }

    async def import_url(self, url_entry: Dict) -> Dict:
        """استيراد رابط واحد — جلسة DB مستقلة"""
        url        = url_entry["url"]
        source_ar  = url_entry.get("source", "")
        source_en  = url_entry.get("source_en", "Unknown")

        if not source_ar or not source_en:
            source_ar, source_en = get_source_from_url(url)

        async with AsyncSessionLocal() as db:
            if await self.article_exists(db, url):
                return {"url": url, "status": "exists"}

            async with self._make_session() as session:
                article_data = await self.fetch_article(session, url, source_ar)

            if not article_data:
                return {"url": url, "status": "failed"}

            source = await self.get_or_create_source(db, source_ar, source_en, url)

            article = Article(
                title       = article_data["title"],
                content     = article_data["content"],
                summary     = article_data["summary"],
                url         = article_data["url"][:1000],
                image_url   = (article_data.get("image_url") or "")[:1000] or None,
                published_at= article_data["published_at"],
                source_id   = source.id,
                source_name = source_ar,
                language    = "ar",
                is_analyzed = False,
            )
            db.add(article)
            await db.commit()
            logger.info(f"Imported: [{source_ar}] {article_data['title'][:60]}")
            return {"url": url, "status": "imported", "title": article_data["title"]}

    async def import_all(self, urls: Optional[List[Dict]] = None, concurrency: int = 5) -> Dict:
        """استيراد جميع روابط الأرشيف"""
        targets = urls or FORUM_ARCHIVE_URLS
        semaphore = asyncio.Semaphore(concurrency)

        async def bounded(entry):
            async with semaphore:
                return await self.import_url(entry)

        results = await asyncio.gather(*[bounded(e) for e in targets], return_exceptions=True)

        imported = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "imported")
        existed  = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "exists")
        failed   = sum(1 for r in results if isinstance(r, Exception) or
                       (isinstance(r, dict) and r.get("status") == "failed"))

        return {
            "total":    len(targets),
            "imported": imported,
            "existed":  existed,
            "failed":   failed,
            "details":  [r for r in results if isinstance(r, dict)],
        }
