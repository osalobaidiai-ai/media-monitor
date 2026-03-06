"""
تحليل حسابات X (تويتر) — عبر Twitter Syndication API المجاني
"""
import json
import logging
import re
from collections import Counter
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/twitter", tags=["twitter"])

SYNDICATION_URL = "https://syndication.twitter.com/srv/timeline-profile/screen-name/{username}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
    "Referer": "https://twitter.com/",
    "Cache-Control": "no-cache",
}

DATA_SOURCE = "syndication.twitter.com"


# ── Pydantic models ────────────────────────────────────────────────────────────

class TweetItem(BaseModel):
    id: str
    text: str
    date: str
    hour: int
    hashtags: list[str]
    mentions: list[str]
    is_retweet: bool
    is_reply: bool
    likes: int
    retweets: int


class TwitterProfile(BaseModel):
    username: str
    display_name: str
    bio: str
    followers: str
    following: str
    tweets_count: str
    verified: bool


class TwitterAnalysisResponse(BaseModel):
    username: str
    profile: TwitterProfile | None
    tweets: list[TweetItem]
    tweet_count: int
    top_hashtags: list[dict]
    hour_distribution: list[dict]
    content_breakdown: dict
    analysis: str
    model_used: str
    generated_at: str
    nitter_instance: str  # محقل للتوافق مع الواجهة — يحمل اسم مصدر البيانات


# ── Syndication fetch ──────────────────────────────────────────────────────────

async def _fetch_syndication(username: str) -> tuple[list[dict], dict | None]:
    """جلب التغريدات والملف الشخصي من Twitter Syndication API."""
    url = SYNDICATION_URL.format(username=username)
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(url, headers=HEADERS)
    except Exception as exc:
        logger.error("Syndication fetch error: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="تعذّر الاتصال بـ Twitter Syndication API. تحقق من الاتصال بالإنترنت.",
        )

    if r.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="تجاوزت حدود الطلبات المسموح بها من Twitter. انتظر بضع دقائق ثم أعد المحاولة.",
        )
    if r.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail=f"أعاد Twitter خطأ {r.status_code}. تحقق من صحة اسم الحساب.",
        )

    # استخراج __NEXT_DATA__ JSON
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', r.text, re.DOTALL)
    if not m:
        raise HTTPException(
            status_code=503,
            detail="تعذّر استخراج بيانات التغريدات من الصفحة. قد يكون الحساب خاصاً أو غير موجود.",
        )

    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=503, detail=f"بيانات JSON غير صالحة: {exc}")

    page_props = data.get("props", {}).get("pageProps", {})
    tweets  = _parse_entries(page_props)
    profile = _parse_profile(username, page_props)

    logger.info("Syndication: fetched %d tweets for @%s", len(tweets), username)
    return tweets, profile


# ── Tweet parsing ──────────────────────────────────────────────────────────────

def _parse_entries(page_props: dict) -> list[dict]:
    """استخراج التغريدات من pageProps — يتعامل مع عدة صيغ للبيانات."""
    # الصيغة الأولى: timeline.entries
    entries = page_props.get("timeline", {}).get("entries", [])
    # الصيغة الثانية: قائمة tweets مباشرة
    if not entries:
        entries = page_props.get("tweets", [])

    tweets = []
    for entry in entries:
        raw = _extract_tweet_obj(entry)
        if raw:
            tweets.append(_normalise_tweet(raw))
    return tweets


def _extract_tweet_obj(entry: dict) -> dict | None:
    """إيجاد كائن التغريدة الخام بغض النظر عن عمق التداخل."""
    # الصيغة الأولى: entry.entry.content.tweet
    t = (entry.get("entry") or {}).get("content", {}).get("tweet")
    if t:
        return t
    # الصيغة الثانية: entry.content.tweet
    t = entry.get("content", {}).get("tweet")
    if t:
        return t
    # الصيغة الثالثة: entry هو التغريدة مباشرة
    if "id_str" in entry or "full_text" in entry:
        return entry
    return None


def _normalise_tweet(t: dict) -> dict:
    """تحويل التغريدة الخام إلى الصيغة الداخلية الموحّدة."""
    raw_text = t.get("full_text") or t.get("text") or ""
    # حذف روابط t.co المختصرة
    text = re.sub(r"https://t\.co/\S+", "", raw_text).strip()
    text = re.sub(r"\s+", " ", text).strip()

    # تحليل التاريخ
    created_at = t.get("created_at", "")
    try:
        dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S +0000 %Y").replace(
            tzinfo=timezone.utc
        )
    except Exception:
        dt = datetime.now(timezone.utc)

    entities  = t.get("entities", {})
    hashtags  = [h.get("text", "") for h in entities.get("hashtags", [])]
    mentions  = [m.get("screen_name", "") for m in entities.get("user_mentions", [])]

    is_retweet = bool(t.get("retweeted_status"))
    is_reply   = bool(t.get("in_reply_to_screen_name"))

    return {
        "id":         str(t.get("id_str") or t.get("id") or ""),
        "text":       text[:500],
        "date":       dt.strftime("%Y-%m-%dT%H:%M:%S"),
        "hour":       dt.hour,
        "hashtags":   hashtags,
        "mentions":   mentions,
        "is_retweet": is_retweet,
        "is_reply":   is_reply,
        "likes":      int(t.get("favorite_count") or 0),
        "retweets":   int(t.get("retweet_count") or 0),
    }


def _parse_profile(username: str, page_props: dict) -> dict | None:
    """استخراج بيانات الملف الشخصي من pageProps."""
    user = page_props.get("user") or page_props.get("profile") or {}
    if not user:
        return None
    return {
        "username":     username,
        "display_name": user.get("name") or username,
        "bio":          user.get("description") or "",
        "followers":    _fmt_num(user.get("followers_count")),
        "following":    _fmt_num(user.get("friends_count")),
        "tweets_count": _fmt_num(user.get("statuses_count")),
        "verified":     bool(user.get("verified") or user.get("is_blue_verified")),
    }


def _fmt_num(n) -> str:
    if n is None:
        return "—"
    n = int(n)
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


# ── Analysis helpers ───────────────────────────────────────────────────────────

def _compute_stats(tweets: list[dict]) -> dict:
    total          = len(tweets)
    rt_count       = sum(1 for t in tweets if t["is_retweet"])
    reply_count    = sum(1 for t in tweets if t["is_reply"])
    original_count = total - rt_count - reply_count

    all_tags = []
    for t in tweets:
        all_tags.extend(t["hashtags"])

    top_hashtags = [
        {"tag": tag, "count": cnt}
        for tag, cnt in Counter(all_tags).most_common(10)
    ]

    hour_counter = Counter(t["hour"] for t in tweets)
    hour_distribution = [
        {"hour": h, "count": hour_counter.get(h, 0)}
        for h in range(24)
    ]

    return {
        "top_hashtags": top_hashtags,
        "hour_distribution": hour_distribution,
        "content_breakdown": {
            "original": original_count,
            "retweets": rt_count,
            "replies":  reply_count,
            "total":    total,
        },
    }


def _build_prompt(username: str, tweets: list[dict], profile: dict | None, stats: dict) -> str:
    sample_tweets = "\n".join(
        f"[{t['date'][:10]} {t['hour']:02d}:00]"
        f" {'RT' if t['is_retweet'] else '↩' if t['is_reply'] else '●'}"
        f" ♥{t['likes']} 🔁{t['retweets']}"
        f" {t['text'][:250]}"
        for t in tweets[:60]
    )

    tag_text = ", ".join(
        f"#{d['tag']} ({d['count']})" for d in stats["top_hashtags"][:10]
    ) or "لا يوجد"

    peak_hours = sorted(
        stats["hour_distribution"], key=lambda x: x["count"], reverse=True
    )[:5]
    hours_text = ", ".join(f"{h['hour']:02d}:00 ({h['count']} تغريدة)" for h in peak_hours)

    cb  = stats["content_breakdown"]
    pct = lambda n: f"{round(n / cb['total'] * 100)}%" if cb["total"] else "0%"

    # أعلى التغريدات تفاعلاً
    top_engaging = sorted(tweets, key=lambda t: t["likes"] + t["retweets"] * 2, reverse=True)[:5]
    top_tweets_text = "\n".join(
        f"  • ♥{t['likes']} 🔁{t['retweets']} | {t['text'][:180]}"
        for t in top_engaging
    ) or "  • لا توجد بيانات تفاعل"

    # معدل التفاعل الإجمالي
    total_likes    = sum(t["likes"]    for t in tweets)
    total_retweets = sum(t["retweets"] for t in tweets)
    avg_likes      = round(total_likes    / len(tweets), 1) if tweets else 0
    avg_retweets   = round(total_retweets / len(tweets), 1) if tweets else 0

    profile_block = ""
    if profile:
        profile_block = (
            f"الاسم الرسمي : {profile['display_name']} (@{username})\n"
            f"النبذة التعريفية: {profile['bio'] or 'غير محدد'}\n"
            f"المتابِعون : {profile['followers']}  |  يتابع : {profile['following']}  |  إجمالي التغريدات : {profile['tweets_count']}\n"
            f"التحقق الرسمي : {'✓ موثَّق' if profile.get('verified') else 'غير موثَّق'}\n"
        )

    # نسبة التفاعل الصناعية المرجعية حسب حجم الحساب
    followers_raw = profile.get("followers", "—") if profile else "—"
    industry_benchmark = (
        "3-6% (حساب صغير <10K)" if "K" not in followers_raw and followers_raw.replace("—","").isdigit() and int(followers_raw.replace("—","0") or 0) < 10000
        else "1-3% (حساب متوسط 10K-100K)" if "K" in followers_raw and float(followers_raw.replace("K","").replace("—","0") or 0) < 100
        else "0.5-1.5% (حساب كبير 100K-1M)"
        if not ("M" in followers_raw)
        else "0.1-0.5% (حساب ضخم +1M)"
    )
    engagement_rate = round((avg_likes + avg_retweets) / max(1, 1) * 100, 2)  # تقديري

    return f"""أنت كبير محللي حسابات X (تويتر) على مستوى العالم، ومستشار استراتيجي متخصص في الإعلام الرقمي العربي. خبرتك تمتد لأكثر من عشر سنوات في تحليل الحسابات الإعلامية والحكومية والشخصية.

مهمتك: إعداد تقرير استشاري احترافي شامل لحساب X التالي، يُقدَّم إلى جهة حكومية سعودية رفيعة المستوى.
قاعدة البيانات: عينة من {len(tweets)} تغريدة (أحدث 100 تغريدة متاحة للحساب).
التعليمات الإلزامية: اكتب جميع الأقسام الخمسة كاملةً دون حذف أو اختصار. كل قسم يجب أن يتضمن تحليلاً حقيقياً مستنداً إلى الأرقام أدناه، لا عبارات عامة. استخدم # للعناوين الرئيسية و## للفرعية.

══════════════════════════════════════
بيانات الحساب المُحلَّل
══════════════════════════════════════
{profile_block}
══════════════════════════════════════
الأرقام التفصيلية (عينة {cb['total']} تغريدة — أحدث 100 تغريدة متاحة)
══════════════════════════════════════
توزيع المحتوى:
  • تغريدات أصلية : {cb['original']} ({pct(cb['original'])})
  • إعادة تغريد   : {cb['retweets']} ({pct(cb['retweets'])})
  • ردود وتعليقات  : {cb['replies']} ({pct(cb['replies'])})

مؤشرات التفاعل الفعلية:
  • إجمالي الإعجابات          : {total_likes:,}
  • إجمالي إعادة التغريد      : {total_retweets:,}
  • متوسط إعجابات / تغريدة    : {avg_likes}
  • متوسط إعادة تغريد / تغريدة : {avg_retweets}
  • معيار الصناعة المقارن     : {industry_benchmark}

الهاشتاقات:
  {tag_text}

أوقات الذروة:
  {hours_text}

أعلى 5 تغريدات تفاعلاً:
{top_tweets_text}

══════════════════════════════════════
عينة التغريدات (أحدث {len(tweets)} تغريدة — ● أصلية | RT إعادة | ↩ رد)
══════════════════════════════════════
{sample_tweets}

══════════════════════════════════════
التقرير المطلوب — خمسة أقسام كاملة
══════════════════════════════════════

# تقرير تحليل الحضور الرقمي — @{username}

## القسم الأول: البيانات والأرقام الدقيقة

### 1.1 إحصاءات الحساب الأساسية
(اذكر جميع الأرقام المتاحة: عدد المتابعين، عدد التغريدات الكلي، معدل النشر اليومي المقدّر، توزيع المحتوى بالنسب المئوية الدقيقة من البيانات أعلاه)

### 1.2 مؤشرات التفاعل الكمية
(احسب: معدل التفاعل = (إعجابات + إعادة تغريد) ÷ عدد التغريدات. قارنه بمعيار الصناعة {industry_benchmark}. هل الحساب أعلى أم أدنى من المعيار وبكم؟)

### 1.3 الديموغرافيا المتوقعة للمتابعين
(استنتج بناءً على نوع المحتوى والهاشتاقات واللغة والمواضيع:
  - الفئات العمرية الأكثر احتمالاً (مع نسب تقديرية)
  - المناطق الجغرافية المرجّحة (السعودية / الخليج / العالم العربي / عالمي)
  - الاهتمامات والمهن المتوقعة
  - التوجهات الثقافية والسياسية المحتملة)

### 1.4 تحليل أداء الهاشتاقات والمحتوى
(قيّم كل هاشتاق رئيسي: هل هو ترندينغ؟ هل يستهدف جمهوراً محدداً؟ ما قيمته التسويقية؟)

## القسم الثاني: التشخيص التفصيلي

### 2.1 تشخيص الهوية الرقمية والصوت التحريري
(ما الشخصية الرقمية التي يُجسّدها الحساب؟ هل الصوت التحريري متسق؟ ما نبرة الخطاب؟)

### 2.2 تشخيص استراتيجية المحتوى
(هل توجد استراتيجية واضحة؟ ما أنماط المحتوى المتكررة؟ ما الثغرات في التنوع؟)

### 2.3 تشخيص التفاعل والانتشار
(ما التغريدات التي نجحت ولماذا؟ ما التغريدات التي فشلت؟ ما العلاقة بين التوقيت والتفاعل؟)

### 2.4 رصد نقاط القوة والضعف الحرجة
(قائمة مرقّمة بنقاط القوة مع الدليل من البيانات، ثم قائمة مرقّمة بنقاط الضعف مع الدليل)

### 2.5 الفرص الضائعة
(ما الفرص المحددة التي يفوّتها الحساب يومياً؟ مع أمثلة عملية)

## القسم الثالث: خطة العلاج خطوة بخطوة

(لكل مشكلة مرصودة في القسم الثاني، اكتب وفق هذا الهيكل الثابت:
**المشكلة [رقم]:** وصف دقيق للمشكلة
**الخطوات العلاجية:**
1. الخطوة الأولى (ماذا تفعل بالضبط)
2. الخطوة الثانية
3. الخطوة الثالثة
**الجدول الزمني:** كم يوم/أسبوع للتنفيذ
**مؤشر النجاح:** كيف تقيس أن المشكلة حُلّت

غطِّ على الأقل 5-7 مشكلات بخطط علاجية مفصلة)

## القسم الرابع: التوصيات الاستراتيجية

### الأولوية القصوى — الأسبوع الأول
(توصيات فورية قابلة للتنفيذ فوراً، مع تفاصيل تشغيلية دقيقة)

### الأولوية المتوسطة — الشهر الأول
(توصيات تحتاج تخطيطاً وموارد، مع جداول زمنية)

### الأولوية الاستراتيجية — الربع الأول
(توصيات بناء طويل المدى لتحقيق أهداف النمو)

### توصيات الديموغرافيا والجمهور
(كيف يُوسّع الحساب قاعدة متابعيه؟ ما الشرائح الجديدة التي يمكن استهدافها؟)

## القسم الخامس: التقييم النهائي من 100

### التقييم الكمي (100 نقطة موزعة)
(أعطِ درجة حقيقية مبررة بالبيانات لكل محور:
  - جودة المحتوى وأصالته      : __ / 20
  - معدلات التفاعل والانتشار   : __ / 20
  - الاتساق والاستراتيجية      : __ / 20
  - الهوية الرقمية والتميز     : __ / 20
  - توقيت النشر والتوزيع       : __ / 20
  **المجموع الإجمالي           : __ / 100**)

### الحكم الاستشاري
(فقرة واحدة: هل الحساب في حالة جيدة أم يحتاج تدخلاً عاجلاً؟ ما أولوية التدخل؟)

### الخلاصة التنفيذية
(ثلاثة أسطر فقط: الواقع الحالي + المشكلة الجوهرية + الحل الأهم)

---
*تقرير صادر عن منظومة رصد الإعلام الذكي — للاستخدام الرسمي الداخلي*

تذكير: اكتب جميع الأقسام الخمسة كاملةً. لا تختصر ولا تحذف. استند إلى الأرقام الفعلية المذكورة أعلاه في كل موضع ممكن."""


def _fallback_analysis(username: str, tweets: list[dict], profile: dict | None, stats: dict) -> str:
    cb       = stats["content_breakdown"]
    tag      = ", ".join(f"#{d['tag']} ({d['count']})" for d in stats["top_hashtags"][:5]) or "—"
    peak     = sorted(stats["hour_distribution"], key=lambda x: x["count"], reverse=True)[:3]
    peak_text = ", ".join(f"{h['hour']:02d}:00" for h in peak)
    total    = cb["total"]
    pct      = lambda n: f"{round(n / total * 100)}%" if total else "0%"

    # أفضل تغريدات حسب التفاعل
    top_tweets = sorted(tweets, key=lambda t: t["likes"] + t["retweets"], reverse=True)[:3]

    lines = [f"# تحليل حساب: @{username}", ""]
    if profile:
        lines += [
            "## معلومات الحساب",
            f"- **الاسم:** {profile['display_name']}",
            f"- **البيو:** {profile['bio'] or 'غير محدد'}",
            f"- **المتابِعون:** {profile['followers']}",
            "",
        ]
    lines += [
        "## إحصائيات المحتوى",
        f"- إجمالي التغريدات المحللة: **{total}**",
        f"- تغريدات أصلية: {cb['original']} ({pct(cb['original'])})",
        f"- إعادة تغريد: {cb['retweets']} ({pct(cb['retweets'])})",
        f"- ردود: {cb['replies']} ({pct(cb['replies'])})",
        "",
        "## أبرز الهاشتاقات",
        f"- {tag}",
        "",
        "## أوقات النشر الأكثر نشاطاً",
        f"- الساعات: {peak_text}",
    ]
    if top_tweets:
        lines += ["", "## أبرز التغريدات تفاعلاً"]
        for t in top_tweets:
            lines.append(f"- ♥{t['likes']} 🔁{t['retweets']} — {t['text'][:120]}")
    lines += [
        "",
        "---",
        "*ملاحظة: لتفعيل التحليل الذكي بـ Claude AI يُرجى تعيين ANTHROPIC_API_KEY في ملف .env*",
    ]
    return "\n".join(lines)


# ── API endpoint ───────────────────────────────────────────────────────────────

@router.get("/analyze", response_model=TwitterAnalysisResponse)
async def analyze_twitter_account(
    username: str = Query(..., description="اسم الحساب مثل SaudiMediaForum"),
    max_tweets: int = Query(100, ge=10, le=100),
):
    """تحليل حساب X (تويتر) عبر Twitter Syndication API بدون مفتاح رسمي"""
    clean = username.lstrip("@").strip()
    if not clean:
        raise HTTPException(status_code=400, detail="يرجى إدخال اسم الحساب")

    # 1) جلب التغريدات والملف الشخصي
    raw_tweets, profile_data = await _fetch_syndication(clean)
    raw_tweets = raw_tweets[:max_tweets]

    if not raw_tweets:
        raise HTTPException(
            status_code=404,
            detail=f"لم يُعثر على تغريدات للحساب @{clean}. قد يكون الحساب خاصاً أو غير موجود.",
        )

    # 2) حساب الإحصاءات
    stats = _compute_stats(raw_tweets)

    # 3) توليد التحليل — نفس آلية reports.py بالضبط
    model_used = "rule-based"
    analysis   = ""

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if api_key:
        try:
            import httpx
            prompt = _build_prompt(clean, raw_tweets, profile_data, stats)
            logger.info("api_key found, calling Claude")
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-6",
                        "max_tokens": 10000,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                response.raise_for_status()
                result = response.json()
            logger.info("Claude response received")
            analysis   = result["content"][0]["text"]
            model_used = "claude-sonnet-4-6"
        except Exception as e:
            logger.error(f"Claude error: {e}", exc_info=True)
            analysis = _fallback_analysis(clean, raw_tweets, profile_data, stats)
    else:
        logger.info("No ANTHROPIC_API_KEY, using rule-based analysis")
        analysis = _fallback_analysis(clean, raw_tweets, profile_data, stats)

    return TwitterAnalysisResponse(
        username=clean,
        profile=TwitterProfile(**profile_data) if profile_data else None,
        tweets=[TweetItem(**t) for t in raw_tweets],
        tweet_count=len(raw_tweets),
        top_hashtags=stats["top_hashtags"],
        hour_distribution=stats["hour_distribution"],
        content_breakdown=stats["content_breakdown"],
        analysis=analysis,
        model_used=model_used,
        generated_at=datetime.now(timezone.utc).isoformat(),
        nitter_instance=DATA_SOURCE,
    )
