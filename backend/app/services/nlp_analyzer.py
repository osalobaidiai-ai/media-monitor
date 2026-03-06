"""
محلل اللغة الطبيعية - رصد منتدى الإعلام السعودي
Saudi Media Forum Monitor — NLP Analyzer
نطاق الرصد: 20 يناير 2026 — 20 فبراير 2026
"""
import re
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════
#  نطاق التاريخ المحدد للرصد
# ══════════════════════════════════════════════════════════════════
MONITOR_START = datetime(2026, 1, 20, 0, 0, 0, tzinfo=timezone.utc)
MONITOR_END   = datetime(2026, 2, 20, 23, 59, 59, tzinfo=timezone.utc)


def is_within_monitor_period(dt: Optional[datetime]) -> bool:
    """التحقق من أن التاريخ ضمن نطاق الرصد"""
    if dt is None:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return MONITOR_START <= dt <= MONITOR_END


# ══════════════════════════════════════════════════════════════════
#  الكلمات المفتاحية — منتدى الإعلام السعودي
#  البنية: كل مجموعة تُطبَّق بمنطق OR داخلياً بين عباراتها
#  المجموعات المركّبة (compound_and) تتطلب توافر كل العبارات (AND)
# ══════════════════════════════════════════════════════════════════

FORUM_KEYWORDS: Dict[str, Dict] = {

    # ── المحور 1: إشارات مباشرة (وزن 1.0) ──────────────────────
    # كلمة واحدة منها كافية للتصنيف — أعلى دقة وأقل ضجيج
    "direct_mention": {
        "label": "ذكر مباشر للمنتدى",
        "icon": "◈",
        "phrases": [
            # عربي
            "منتدى الإعلام السعودي",
            "جائزة المنتدى السعودي للإعلام",
            "هيئة الصحفيين السعوديين",
            # إنجليزي
            "Saudi Media Forum",
            "SMF 2026",
            "Saudi Media Exhibition",
            "FOMEX",
        ],
        "weight": 1.0,
    },

    # ── المحور 2: شخصيات المنتدى (وزن 0.9) ─────────────────────
    "participants": {
        "label": "شخصيات وضيوف",
        "icon": "◉",
        "phrases": [
            "محمد بن فهد الحارثي",
        ],
        "weight": 0.9,
    },

    # ── المحور 3: جلسات ومحاور (وزن 0.75) ──────────────────────
    # تحتاج سياقاً إضافياً — وزن متوسط
    "topics_sessions": {
        "label": "جلسات ومحاور",
        "icon": "◎",
        "phrases": [
            # عربي
            "مستقبل الإعلام",
            "تحليل جلسات منتدى الإعلام",
            "توصيات منتدى الإعلام السعودي",
            "الذكاء الاصطناعي في الإعلام",
            "صناعة المحتوى الرقمي",
            # إنجليزي
            "Media industry in Saudi Arabia",
        ],
        "weight": 0.75,
    },
}

# ── المجموعات المركّبة: يجب توافر كل العبارات معاً (AND) ────────
# تُقلِّل الضجيج: "مستقبل الإعلام" وحدها غامضة،
# لكن "وزير الإعلام" + "منتدى الإعلام" = صلة مؤكدة
FORUM_COMPOUND_AND: List[Dict] = [
    {
        "phrases": ["النسخة الثالثة", "منتدى الإعلام"],
        "weight": 0.95,
        "category": "direct_mention",
        "label": "النسخة الثالثة من المنتدى",
    },
    {
        "phrases": ["وزير الإعلام", "منتدى الإعلام"],
        "weight": 0.9,
        "category": "direct_mention",
        "label": "وزير الإعلام في المنتدى",
    },
    {
        "phrases": ["Vision 2030", "Media transformation"],
        "weight": 0.8,
        "category": "topics_sessions",
        "label": "رؤية 2030 وتحول الإعلام",
    },
]

# عتبة الصلة (أقل من قيمة الأزمات السابقة — المنتدى يُذكر بشكل موضوعي)
FORUM_RELEVANCE_THRESHOLD = 0.4


# ══════════════════════════════════════════════════════════════════
#  مفردات المشاعر (تبقى كما هي لتحليل نبرة التغطية)
# ══════════════════════════════════════════════════════════════════
POSITIVE_WORDS = [
    "نجاح", "تقدم", "إنجاز", "ازدهار", "سلام", "أمل", "فرح", "سعادة",
    "تطور", "نمو", "تحسن", "اتفاق", "إيجابي", "مبارك", "تهنئة",
    "إصلاح", "تعاون", "شراكة", "ابتكار", "إبداع", "رائع", "ممتاز",
    "تاريخي", "إنجازات", "مكاسب", "ارتفاع", "ازدهار", "انتصار",
    "إطلاق", "تدشين", "افتتاح", "احتفال", "تكريم", "جائزة",
]

NEGATIVE_WORDS = [
    "فشل", "كارثة", "أزمة", "خطر", "تهديد", "مشكلة", "سلبي",
    "خسارة", "تراجع", "انخفاض", "انهيار", "خوف", "قلق", "غضب",
    "رفض", "معارضة", "تصعيد", "احتجاج", "إدانة", "مقلق",
    "هجوم", "ضعف", "عجز", "فساد", "ظلم",
]

INTENSIFIERS = {
    "جداً": 1.5, "للغاية": 1.5, "تماماً": 1.3,
    "بشدة": 1.4, "كثيراً": 1.3, "هائل": 1.5,
    "ضخم": 1.3, "كبير": 1.2,
}

NEGATORS = ["لا", "لم", "لن", "ليس", "غير", "ليست", "لما", "لو لا"]


# ══════════════════════════════════════════════════════════════════
#  المحلل الرئيسي
# ══════════════════════════════════════════════════════════════════
class ArabicNLPAnalyzer:

    def __init__(self):
        logger.info("NLP Analyzer — Saudi Media Forum mode (20 Jan–20 Feb 2026)")

    def preprocess_text(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'[\u064B-\u065F]', '', text)           # إزالة التشكيل
        text = re.sub(r'[^\u0600-\u06FF\s\w]', ' ', text)     # الاحتفاظ بالعربية والإنجليزية
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    # ── استخراج الكلمات المفتاحية ──────────────────────────────
    def extract_keywords(self, text: str) -> List[str]:
        if not text:
            return []
        processed = self.preprocess_text(text)
        words = processed.split()
        stop_words = {
            "في", "من", "إلى", "على", "مع", "عن", "التي", "الذي",
            "هذا", "هذه", "ذلك", "تلك", "كان", "كانت", "هو", "هي",
            "أن", "إن", "لا", "ما", "لم", "قد", "قال", "أيضاً",
            "وفي", "وقد", "وأن", "حيث", "كما", "بعد", "قبل",
        }
        keywords = [w for w in words if len(w) >= 3 and w not in stop_words]
        from collections import Counter
        return [w for w, _ in Counter(keywords).most_common(20)]

    # ── تحليل المشاعر ──────────────────────────────────────────
    def analyze_sentiment(self, text: str) -> Dict:
        if not text:
            return {"sentiment": "neutral", "score": 0.0, "confidence": 0.5}

        processed = self.preprocess_text(text)
        total_words = len(processed.split()) or 1
        pos_score = 0.0
        neg_score = 0.0

        for word in POSITIVE_WORDS:
            if word in processed:
                count = processed.count(word)
                idx   = processed.find(word)
                negated = any(n in processed[max(0, idx - 15):idx] for n in NEGATORS)
                score = float(count)
                after = processed[idx + len(word): idx + len(word) + 15]
                for intens, mult in INTENSIFIERS.items():
                    if intens in after:
                        score *= mult
                        break
                if negated:
                    neg_score += score * 0.7
                else:
                    pos_score += score

        for word in NEGATIVE_WORDS:
            if word in processed:
                count = processed.count(word)
                idx   = processed.find(word)
                negated = any(n in processed[max(0, idx - 15):idx] for n in NEGATORS)
                score = float(count)
                after = processed[idx + len(word): idx + len(word) + 15]
                for intens, mult in INTENSIFIERS.items():
                    if intens in after:
                        score *= mult
                        break
                if negated:
                    pos_score += score * 0.5
                else:
                    neg_score += score

        total = pos_score + neg_score
        if total == 0:
            return {"sentiment": "neutral", "score": 0.0, "confidence": 0.4}

        net = (pos_score - neg_score) / max(total_words * 0.3, 1.0)
        net = max(-1.0, min(1.0, net))

        sentiment = "positive" if net > 0.05 else "negative" if net < -0.05 else "neutral"
        confidence = min(0.9, total / max(total_words * 0.2, 1.0))

        return {"sentiment": sentiment, "score": round(net, 3), "confidence": round(confidence, 3)}

    # ── كشف صلة المقالة بالمنتدى ──────────────────────────────
    def detect_forum_relevance(self, text: str, title: str = "") -> Dict:
        """
        يطبّق منطق OR بين العبارات داخل كل مجموعة،
        ومنطق AND لكل مجموعة مركّبة في FORUM_COMPOUND_AND.
        النتيجة: درجة صلة + المحور المسيطر + الكلمات المُشغِّلة.
        """
        combined = f"{title} {text}"
        combined_lower = combined.lower()

        if not combined.strip():
            return {
                "is_relevant": False, "relevance_score": 0.0,
                "topic_category": None, "triggers": [],
            }

        category_scores: Dict[str, float] = {}
        triggers: List[str] = []

        # ── OR: فحص كل مجموعة عادية ──
        for cat_key, config in FORUM_KEYWORDS.items():
            cat_score = 0.0
            for phrase in config["phrases"]:
                if phrase.lower() in combined_lower:
                    cat_score += config["weight"]
                    triggers.append(phrase)
            if cat_score > 0:
                # جمع الدرجات — مقالة تذكر عبارتين أكثر صلةً
                category_scores[cat_key] = category_scores.get(cat_key, 0.0) + cat_score

        # ── AND: فحص المجموعات المركّبة ──
        for compound in FORUM_COMPOUND_AND:
            all_present = all(p.lower() in combined_lower for p in compound["phrases"])
            if all_present:
                cat = compound["category"]
                category_scores[cat] = category_scores.get(cat, 0.0) + compound["weight"]
                triggers.extend(compound["phrases"])
                logger.debug(f"AND-match: {compound['label']}")

        if not category_scores:
            return {
                "is_relevant": False, "relevance_score": 0.0,
                "topic_category": None, "triggers": [],
            }

        dominant_cat   = max(category_scores, key=category_scores.get)
        raw_score      = category_scores[dominant_cat]
        # تطبيع: درجة فوق 1.0 ممكنة إذا تكررت عبارات — نُثبّت عند 1.0
        relevance_score = min(1.0, raw_score)
        is_relevant     = relevance_score >= FORUM_RELEVANCE_THRESHOLD

        return {
            "is_relevant": is_relevant,
            "relevance_score": round(relevance_score, 3),
            "topic_category": dominant_cat if is_relevant else None,
            "all_categories": {k: round(v, 3) for k, v in category_scores.items()},
            "triggers": list(set(triggers)),
        }

    # ── استخراج الكيانات ───────────────────────────────────────
    def extract_entities(self, text: str) -> Dict:
        entities: Dict[str, List[str]] = {
            "persons": [], "organizations": [], "locations": [],
        }

        saudi_locations = [
            "الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر",
            "المنطقة الشرقية", "عسير", "تبوك", "القصيم", "حائل",
            "نجران", "جازان", "الباحة", "الجوف", "المدينة المنورة",
        ]
        media_orgs = [
            "هيئة الصحفيين السعوديين", "وزارة الإعلام",
            "مجموعة MBC", "قناة العربية", "الجزيرة",
            "صحيفة عكاظ", "صحيفة سبق", "وكالة الأنباء السعودية",
            "هيئة الإعلام المرئي والمسموع",
        ]
        forum_persons = [
            "محمد بن فهد الحارثي",
        ]

        for loc in saudi_locations:
            if loc in text:
                entities["locations"].append(loc)
        for org in media_orgs:
            if org in text:
                entities["organizations"].append(org)
        for person in forum_persons:
            if person in text:
                entities["persons"].append(person)

        return entities

    # ── تحليل شامل للمقالة ─────────────────────────────────────
    def analyze_article(self, title: str, content: str) -> Dict:
        text = f"{title} {content}"

        sentiment_result = self.analyze_sentiment(text)
        forum_result     = self.detect_forum_relevance(content, title)
        keywords         = self.extract_keywords(text)
        entities         = self.extract_entities(text)

        return {
            "sentiment":       sentiment_result["sentiment"],
            "sentiment_score": sentiment_result["score"],
            # حقول DB تحتفظ بأسمائها للتوافق
            "is_crisis":    forum_result["is_relevant"],
            "crisis_score": forum_result["relevance_score"],
            "crisis_type":  forum_result.get("topic_category"),
            "keywords":     json.dumps(keywords, ensure_ascii=False),
            "entities":     json.dumps(entities, ensure_ascii=False),
            "trigger_keywords": forum_result.get("triggers", []),
        }


# Singleton
_analyzer: Optional[ArabicNLPAnalyzer] = None

def get_analyzer() -> ArabicNLPAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = ArabicNLPAnalyzer()
    return _analyzer
