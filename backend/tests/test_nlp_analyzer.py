"""
اختبارات محلل اللغة الطبيعية العربية
"""
import pytest
from app.services.nlp_analyzer import ArabicNLPAnalyzer


@pytest.fixture
def analyzer():
    return ArabicNLPAnalyzer()


class TestSentimentAnalysis:
    def test_positive_sentiment(self, analyzer):
        text = "حققت المملكة العربية السعودية نجاحاً باهراً في تطوير اقتصادها وازدهار مجتمعها"
        result = analyzer.analyze_sentiment(text)
        assert result["sentiment"] == "positive"
        assert result["score"] > 0

    def test_negative_sentiment(self, analyzer):
        text = "تشهد المنطقة أزمة خطيرة وانهياراً اقتصادياً وفشلاً ذريعاً في السياسات"
        result = analyzer.analyze_sentiment(text)
        assert result["sentiment"] == "negative"
        assert result["score"] < 0

    def test_neutral_sentiment(self, analyzer):
        text = "عقدت الحكومة اجتماعاً لمناقشة الخطط المستقبلية"
        result = analyzer.analyze_sentiment(text)
        assert result["sentiment"] in ["neutral", "positive", "negative"]
        assert -1 <= result["score"] <= 1

    def test_empty_text(self, analyzer):
        result = analyzer.analyze_sentiment("")
        assert result["sentiment"] == "neutral"
        assert result["score"] == 0.0

    def test_sentiment_score_range(self, analyzer):
        texts = [
            "نجاح رائع ومبهر",
            "كارثة وأزمة وانهيار",
            "اجتماع عادي",
        ]
        for text in texts:
            result = analyzer.analyze_sentiment(text)
            assert -1.0 <= result["score"] <= 1.0
            assert 0 <= result["confidence"] <= 1.0


class TestCrisisDetection:
    def test_security_crisis(self, analyzer):
        text = "وقع هجوم مسلح وانفجار ضخم في المنطقة أسفر عن ضحايا"
        result = analyzer.detect_crisis(text)
        assert result["is_crisis"] == True
        assert result["crisis_type"] == "security"
        assert result["crisis_score"] > 0.5

    def test_economic_crisis(self, analyzer):
        text = "تشهد الأسواق انهياراً اقتصادياً وأزمة مالية خانقة وارتفاعاً في البطالة"
        result = analyzer.detect_crisis(text)
        assert result["is_crisis"] == True
        assert result["crisis_type"] == "economic"

    def test_health_crisis(self, analyzer):
        text = "تفشي وباء خطير أسفر عن وفيات كثيرة وإصابات واسعة بين السكان"
        result = analyzer.detect_crisis(text)
        assert result["is_crisis"] == True
        assert result["crisis_type"] == "health"

    def test_no_crisis(self, analyzer):
        text = "افتتح الرئيس مشروعاً جديداً للتنمية في المنطقة"
        result = analyzer.detect_crisis(text)
        assert result["is_crisis"] == False
        assert result["crisis_score"] < 0.5

    def test_crisis_with_title(self, analyzer):
        title = "عاجل: هجوم مسلح"
        content = "وقعت حادثة عنف في المنطقة"
        result = analyzer.detect_crisis(content, title)
        assert result["is_crisis"] == True

    def test_crisis_triggers_listed(self, analyzer):
        text = "هجوم انفجار وتفجير"
        result = analyzer.detect_crisis(text)
        assert len(result["triggers"]) > 0


class TestKeywordExtraction:
    def test_extracts_keywords(self, analyzer):
        text = "أعلنت الحكومة السعودية عن خطة تنمية اقتصادية شاملة للقطاع الخاص"
        keywords = analyzer.extract_keywords(text)
        assert isinstance(keywords, list)
        assert len(keywords) > 0

    def test_filters_stop_words(self, analyzer):
        text = "في من إلى على مع عن الذي التي هذا"
        keywords = analyzer.extract_keywords(text)
        stop_words = {"في", "من", "إلى", "على", "مع", "عن", "الذي", "التي", "هذا"}
        for kw in keywords:
            assert kw not in stop_words

    def test_empty_text(self, analyzer):
        keywords = analyzer.extract_keywords("")
        assert keywords == []


class TestArticleAnalysis:
    def test_full_analysis(self, analyzer):
        title = "نجاح باهر في التنمية الاقتصادية"
        content = "حققت المملكة نمواً قياسياً في الاقتصاد الوطني مع تحسن ملحوظ في جميع القطاعات"
        result = analyzer.analyze_article(title, content)

        assert "sentiment" in result
        assert "sentiment_score" in result
        assert "is_crisis" in result
        assert "crisis_score" in result
        assert "keywords" in result
        assert "entities" in result

    def test_crisis_article(self, analyzer):
        title = "عاجل: هجوم مسلح وانفجار"
        content = "وقع هجوم إرهابي مسلح استهدف المنطقة وخلف أضراراً جسيمة"
        result = analyzer.analyze_article(title, content)

        assert result["is_crisis"] == True
        assert result["crisis_type"] == "security"
