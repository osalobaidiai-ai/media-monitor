# HANDOVER — منظومة رصد الإعلام الذكية
## Saudi Media Monitor — توثيق التسليم الكامل

**تاريخ التوثيق:** 6 مارس 2026
**نطاق الرصد:** منتدى الإعلام السعودي — النسخة الثالثة (20 يناير – 20 فبراير 2026)

---

## 1. حالة المشروع الحالية

### ما يعمل بشكل كامل
- جمع الأخبار من 11 مصدر RSS عربي (تلقائي كل 5 دقائق + يدوي)
- تحليل المشاعر بالعربية (قاعدة كلمات، بدون نموذج ML ثقيل)
- كشف صلة المقالات بمنتدى الإعلام السعودي (3 محاور + منطق AND/OR)
- كشف الأزمات الآلي وإنشاء التنبيهات عند تجاوز عتبة 3 مقالات/ساعة
- تقارير ذكية (rule-based بدون API، أو بـ Claude AI عند توفر المفتاح)
- تحليل حسابات X (تويتر) عبر Syndication API بدون مفتاح رسمي
- استيراد مقالات الأرشيف من روابط مباشرة (URL Importer)
- واجهة React كاملة (7 صفحات) مع WebSocket للتحديث الفوري
- 29 اختبار وحدة تعمل بنجاح (13 API + 16 NLP)

### ما لا يعمل حالياً
- RSS مصادر محجوبة (تفاصيل في قسم المشاكل)
- تقارير Claude AI تحتاج `ANTHROPIC_API_KEY` في `.env`
- النشر الإنتاجي عبر Docker غير مختبر محلياً (البيئة المحلية بدون Docker)

---

## 2. هيكل الملفات الرئيسية

```
media-monitor/
├── CLAUDE.md                          # تعليمات للذكاء الاصطناعي
├── HANDOVER.md                        # هذا الملف
├── docker-compose.yml                 # نشر Docker الإنتاجي (PostgreSQL + Redis)
├── .env.example                       # قالب متغيرات البيئة (للإنتاج)
├── db/init.sql                        # SQL لتهيئة PostgreSQL
│
├── backend/
│   ├── .env.example                   # متغيرات بيئة الـ backend
│   ├── pytest.ini                     # إعدادات الاختبارات
│   ├── Dockerfile                     # Docker image للـ backend
│   ├── venv/                          # بيئة Python الافتراضية (محلياً)
│   │
│   └── app/
│       ├── main.py                    # نقطة دخول FastAPI + Lifespan + Routes
│       ├── config.py                  # إعدادات التطبيق (Pydantic Settings)
│       ├── database.py                # إعداد SQLAlchemy (async) + SQLite/PostgreSQL
│       │
│       ├── models/
│       │   ├── article.py             # جدول المقالات (Article)
│       │   ├── alert.py               # جدول التنبيهات (CrisisAlert)
│       │   ├── source.py              # جدول المصادر (NewsSource)
│       │   └── keyword.py             # جدول الكلمات المفتاحية (غير مستخدم بعد)
│       │
│       ├── api/
│       │   ├── articles.py            # GET /api/v1/articles/ + /stats
│       │   ├── alerts.py              # GET /api/v1/alerts/ + acknowledge/resolve
│       │   ├── sources.py             # GET /api/v1/sources/
│       │   ├── reports.py             # POST /api/v1/reports/generate (AI reports)
│       │   ├── twitter.py             # GET /api/v1/twitter/analyze
│       │   └── websocket.py           # WS /ws (إشعارات فورية)
│       │
│       ├── services/
│       │   ├── nlp_analyzer.py        # تحليل المشاعر + كشف صلة المنتدى
│       │   ├── crisis_detector.py     # كشف تجمعات الأزمات + إنشاء التنبيهات
│       │   ├── rss_collector.py       # جمع الأخبار من 11 مصدر RSS
│       │   ├── url_importer.py        # استيراد مقالات أرشيف بروابط مباشرة
│       │   └── cache_service.py       # Redis caching layer
│       │
│       └── utils/
│           └── scheduler.py           # APScheduler: RSS كل 5 دق + تحليل كل 10 دق
│
├── frontend/
│   ├── vite.config.ts                 # Vite config (proxy /api → localhost:8000)
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── nginx.conf                     # Nginx للإنتاج
│   │
│   └── src/
│       ├── main.tsx                   # نقطة دخول React + QueryClient + Router
│       ├── index.css                  # متغيرات CSS + dark theme
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx          # لوحة التحكم الرئيسية (KPIs + مخططات + أخبار)
│       │   ├── Articles.tsx           # قائمة المقالات مع فلترة وبحث
│       │   ├── Alerts.tsx             # إدارة التنبيهات
│       │   ├── Analytics.tsx          # تحليلات متقدمة + مخططات
│       │   ├── Sources.tsx            # إدارة مصادر الأخبار
│       │   ├── AIReports.tsx          # توليد تقارير ذكية (4 أنواع + تصدير PDF)
│       │   └── XAnalysis.tsx          # تحليل حسابات X (تويتر)
│       │
│       ├── components/
│       │   ├── Header.tsx             # رأس الصفحة + أزرار جمع/تحليل
│       │   ├── Sidebar.tsx            # القائمة الجانبية
│       │   ├── KPICard.tsx            # بطاقة مؤشر الأداء
│       │   ├── ArticleCard.tsx        # بطاقة المقالة
│       │   ├── SentimentChart.tsx     # مخطط المشاعر (Recharts)
│       │   └── CrisisAlertBanner.tsx  # شريط التنبيه العلوي
│       │
│       ├── store/
│       │   └── index.ts               # Zustand store (selectedHours, refresh triggers)
│       │
│       ├── types/
│       │   └── index.ts               # TypeScript interfaces (Article, Alert, Stats...)
│       │
│       └── utils/
│           ├── api.ts                 # دوال استدعاء API (axios/fetch)
│           ├── generateReportPDF.ts   # تصدير تقارير AI إلى PDF
│           ├── generateXReportPDF.ts  # تصدير تقارير X إلى PDF
│           └── helpers.ts             # دوال مساعدة
│
└── nginx/                             # إعدادات Nginx للإنتاج
```

---

## 3. نقاط الوصول (API Endpoints)

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/` | حالة الخدمة |
| GET | `/health` | فحص Redis والـ backend |
| GET | `/docs` | Swagger UI |
| GET | `/api/v1/articles/` | قائمة المقالات (فلاتر: sentiment, crisis_only, search, hours) |
| GET | `/api/v1/articles/stats` | إحصاءات KPI |
| GET | `/api/v1/alerts/` | قائمة التنبيهات |
| GET | `/api/v1/alerts/summary` | ملخص التنبيهات النشطة |
| POST | `/api/v1/alerts/{id}/acknowledge` | إقرار تنبيه |
| POST | `/api/v1/alerts/{id}/resolve` | إغلاق تنبيه |
| GET | `/api/v1/sources/` | قائمة المصادر |
| POST | `/api/v1/collect` | تشغيل جمع RSS يدوياً |
| POST | `/api/v1/analyze` | تشغيل تحليل NLP يدوياً |
| POST | `/api/v1/import-archive` | استيراد مقالات الأرشيف |
| POST | `/api/v1/reports/generate` | توليد تقرير ذكي |
| GET | `/api/v1/reports/types` | أنواع التقارير المتاحة |
| GET | `/api/v1/twitter/analyze?username=X` | تحليل حساب X |
| WS | `/ws` | WebSocket للتحديثات الفورية |

---

## 4. منطق NLP ومحاور الرصد

### محاور منتدى الإعلام السعودي
النظام لا يكشف "أزمات" بالمعنى التقليدي، بل يرصد **صلة المقالة بالمنتدى** عبر 3 محاور:

| المحور | المفتاح | الوزن | أمثلة الكلمات |
|--------|---------|-------|---------------|
| ذكر مباشر | `direct_mention` | 1.0 | "منتدى الإعلام السعودي"، "SMF 2026"، "FOMEX" |
| شخصيات وضيوف | `participants` | 0.9 | "محمد بن فهد الحارثي" |
| جلسات ومحاور | `topics_sessions` | 0.75 | "مستقبل الإعلام"، "الذكاء الاصطناعي في الإعلام" |

**منطق AND المركّب:** "النسخة الثالثة" + "منتدى الإعلام" = وزن 0.95

**عتبة الصلة:** 0.40 (مقالة تُعدّ ذات صلة عند وصول الدرجة لـ 0.4 أو أكثر)

### فلتر التاريخ
- المقالات خارج نطاق **20 يناير – 20 فبراير 2026** تُتجاهل تلقائياً
- المقالات بدون تاريخ نشر تُتجاهل أيضاً

---

## 5. المشاكل العالقة وأسبابها

### المشكلة 1: مصادر RSS محجوبة
**الأعراض:** HTTP 403 أو 404 عند جلب RSS
**المصادر المتأثرة:**
- العربية (`alarabiya.net`) → HTTP 403
- فرانس 24 (`france24.com/ar`) → HTTP 403
- الرياض (`alriyadh.com/rss`) → HTTP 404
- وكالة الأناضول (`aa.com.tr/ar`) → Connection error
- SPA الملف الرئيسي (`spa.gov.sa/rss.xml`) → يُرجع بيانات فارغة

**السبب:** هذه المصادر تحجب طلبات الـ crawlers أو تغيّرت عناوين RSS.
**الحل المقترح:** استخدام Proxy/VPN لـ 403، أو البحث عن عناوين RSS بديلة، أو استخدام URL Importer لمقالات محددة.

---

### المشكلة 2: قاعدة بيانات SQLite في التطوير مقابل PostgreSQL في الإنتاج
**الأعراض:** بعض استعلامات PostgreSQL تفشل على SQLite.
**المواضع المُعالجة مسبقاً:**
- `strftime('%Y-%m-%d %H:00:00', col)` بدلاً من `date_trunc('hour', col)`
- استعلامان منفصلان بدلاً من `array_agg()`
- محرك SQLite بدون `pool_size`/`max_overflow`

**تحذير للإنتاج:** عند الانتقال لـ PostgreSQL، تحقق من جميع استعلامات `strftime` في:
- `backend/app/api/articles.py` (إحصاءات hourly)
- `backend/app/services/crisis_detector.py`

---

### المشكلة 3: فلتر التاريخ يمنع جمع أخبار جديدة بعد 20 فبراير 2026
**الأعراض:** RSS يعمل لكن لا مقالات جديدة تُضاف.
**السبب:** `MONITOR_END = datetime(2026, 2, 20, ...)` في `nlp_analyzer.py` + فلتر في `rss_collector.py`.
**الحل:** إذا أُريد توسيع النطاق، عدّل `MONITOR_END` في `backend/app/services/nlp_analyzer.py:19` وأضف كلمات مفتاحية للمحاور الجديدة.

---

### المشكلة 4: تقارير Claude AI تتطلب مفتاح API
**الأعراض:** التقارير تعمل بـ "rule-based" لكن بجودة محدودة.
**السبب:** `ANTHROPIC_API_KEY` فارغ في `.env`.
**الحل:** أضف المفتاح في ملف `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

### المشكلة 5: Twitter Syndication API قد يتغير
**الأعراض:** تحليل X يفشل أو يُرجع بيانات فارغة.
**السبب:** `syndication.twitter.com` API غير رسمية وهيكل JSON `__NEXT_DATA__` قابل للتغيير.
**الموقع:** `backend/app/api/twitter.py:124` — دالة `_parse_entries`
**الحل:** مراجعة الكود عند فشل الـ parsing وتحديث مسارات JSON.

---

## 6. الخطوات التالية المقترحة

### أولوية عالية
- [ ] توسيع نطاق الرصد لما بعد فبراير 2026 (تعديل `MONITOR_END`)
- [ ] إضافة مصادر RSS جديدة للمصادر المحجوبة (البحث عن روابط بديلة)
- [ ] اختبار النشر الإنتاجي عبر Docker (`docker-compose up -d`)
- [ ] تعيين `ANTHROPIC_API_KEY` لتفعيل التقارير والتحليلات الذكية

### أولوية متوسطة
- [ ] إضافة نظام مصادقة (JWT) لحماية الـ API
- [ ] إضافة صفحة إعدادات لتعديل محاور الرصد والكلمات المفتاحية من الواجهة
- [ ] توسيع قاموس المشاعر العربي (إضافة مزيد من الكلمات السياقية)
- [ ] إضافة نظام Alembic لإدارة migrations قاعدة البيانات

### أولوية منخفضة
- [ ] تفعيل `keyword.py` model لإدارة الكلمات المفتاحية ديناميكياً من الـ API
- [ ] إضافة تصدير البيانات بصيغ Excel/CSV
- [ ] إضافة تنبيهات بريد إلكتروني عند الأزمات الحرجة

---

## 7. تشغيل المشروع من الصفر

### المتطلبات
- Python 3.11 (`/usr/local/opt/python@3.11/bin/python3.11`)
- Node.js v20+ (`/usr/local/bin/node`)
- Redis (`/usr/local/opt/redis/`)

### الخطوة 1: إعداد Redis
```bash
/usr/local/opt/redis/bin/redis-server --daemonize yes
```

### الخطوة 2: إعداد الـ Backend
```bash
cd /Users/mac/media-monitor/backend

# إنشاء بيئة افتراضية (إذا لم تكن موجودة)
/usr/local/opt/python@3.11/bin/python3.11 -m venv venv

# تفعيل البيئة
source venv/bin/activate

# تثبيت الحزم
pip install -r requirements.txt

# تشغيل الخادم
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### الخطوة 3: إعداد الـ Frontend
```bash
cd /Users/mac/media-monitor/frontend

# تثبيت الحزم (مرة واحدة)
npm install

# تشغيل الواجهة
npm run dev
```

### الخطوة 4: جمع البيانات الأولى
```bash
# من المتصفح أو curl:
curl -X POST http://localhost:8000/api/v1/collect
# ثم انتظر 30 ثانية وشغّل التحليل:
curl -X POST http://localhost:8000/api/v1/analyze

# أو استورد مقالات الأرشيف مباشرة:
curl -X POST http://localhost:8000/api/v1/import-archive
```

### الروابط بعد التشغيل
| الخدمة | الرابط |
|--------|--------|
| الواجهة الأمامية | http://localhost:3000 |
| API | http://localhost:8000 |
| توثيق API (Swagger) | http://localhost:8000/docs |

---

## 8. تشغيل الاختبارات

```bash
source /Users/mac/media-monitor/backend/venv/bin/activate
cd /Users/mac/media-monitor/backend
python -m pytest tests/ -v
# النتيجة المتوقعة: 29 passed
```

---

## 9. النشر الإنتاجي (Docker)

```bash
cd /Users/mac/media-monitor

# نسخ ملف البيئة
cp .env.example .env
# عدّل .env وأضف SECRET_KEY وبيانات PostgreSQL و ANTHROPIC_API_KEY

# تشغيل الكل
docker-compose up -d

# متابعة السجلات
docker-compose logs -f backend
```

### ملاحظة مهمة للإنتاج
عند الانتقال من SQLite إلى PostgreSQL، قد تحتاج لمراجعة:
- `backend/app/database.py` (إزالة `connect_args` الخاص بـ SQLite)
- أي استعلام يستخدم `strftime` (استبداله بـ `date_trunc`)

---

## 10. المصادر الإخبارية النشطة

| المصدر | النوع | الدولة | حالة RSS |
|--------|-------|--------|----------|
| سبق (Sabq) | عام | السعودية | نشط |
| عكاظ (Okaz) | عام | السعودية | نشط |
| الوطن (Al Watan) | عام | السعودية | نشط |
| وكالة الأنباء السعودية (SPA) | رسمي | السعودية | نشط (latest-news) |
| Arab News | عام | السعودية | نشط |
| الجزيرة | عام | قطر | نشط |
| سكاي نيوز عربية | عام | الإمارات | نشط |
| بي بي سي عربي | دولي | بريطانيا | نشط |
| روسيا اليوم عربي (RT) | دولي | روسيا | نشط |
| الشرق الأوسط (Asharq Al-Awsat) | عام | السعودية | نشط |
| مكة (Makkah News) | عام | السعودية | نشط |
| العربية | عام | السعودية | **محجوب 403** |
| الرياض (Al Riyadh) | عام | السعودية | **404** |
| الأناضول | دولي | تركيا | **خطأ اتصال** |

---

## 11. معلومات تقنية إضافية

### متغيرات البيئة الحرجة (`.env`)
```bash
DATABASE_URL=sqlite+aiosqlite:///./media_monitor.db   # للتطوير
DATABASE_URL=postgresql+asyncpg://...                  # للإنتاج
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...                           # اختياري للـ AI
CRISIS_THRESHOLD=0.40                                   # عتبة الصلة بالمنتدى
RSS_FETCH_INTERVAL=300                                  # كل 5 دقائق
```

### الجدول الزمني للمهام الآلية (Scheduler)
| المهمة | التكرار | الوظيفة |
|--------|---------|---------|
| `collect_rss_task` | كل 5 دقائق | جمع RSS من جميع المصادر |
| `analyze_articles_task` | كل 10 دقائق | تحليل NLP للمقالات الجديدة |

### قاعدة البيانات
- **التطوير:** SQLite في `backend/media_monitor.db`
- **الإنتاج:** PostgreSQL 15 (عبر Docker Compose)
- لا يوجد Alembic حالياً — الجداول تُنشأ تلقائياً عبر `SQLAlchemy create_all`
