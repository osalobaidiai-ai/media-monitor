# منظومة رصد الإعلام الذكية - Saudi Media Monitor

## نظرة عامة
منظومة رصد إعلامي ذكية للجهات الحكومية السعودية، تعمل على تحليل الأخبار العربية وكشف الأزمات آلياً.

## هيكل المشروع
```
media-monitor/
├── backend/          # Python FastAPI - الخادم الخلفي
│   ├── app/
│   │   ├── api/      # نقاط الوصول (Endpoints)
│   │   ├── models/   # نماذج البيانات
│   │   ├── services/ # الخدمات (RSS, NLP, Crisis Detection)
│   │   └── utils/    # الأدوات المساعدة
│   └── tests/        # اختبارات الوحدة
├── frontend/         # React TypeScript - الواجهة الأمامية
│   └── src/
│       ├── components/ # المكونات
│       ├── pages/      # الصفحات
│       ├── hooks/      # React Hooks
│       ├── store/      # Zustand State Management
│       └── types/      # TypeScript Types
├── ai_models/        # نماذج NLP العربية
├── nginx/            # إعدادات Nginx
└── docker-compose.yml

## التقنيات المستخدمة
- Backend: Python 3.11, FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL 15, Redis 7
- NLP: CAMeL Tools, AraBERT, Transformers
- Frontend: React 18, TypeScript, Tailwind CSS, Recharts
- Infra: Docker, Nginx, WebSockets

## الأوامر المهمة
```bash
# تشغيل المشروع
docker-compose up -d

# تطوير Backend
cd backend && uvicorn app.main:app --reload

# تطوير Frontend
cd frontend && npm run dev

# تشغيل الاختبارات
cd backend && pytest tests/ -v
```

## متغيرات البيئة (.env)
انظر ملف `.env.example` للإعدادات المطلوبة.

## نقاط الوصول الرئيسية
- API: http://localhost:8000
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
