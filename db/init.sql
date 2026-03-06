-- تهيئة قاعدة بيانات منظومة رصد الإعلام
-- Media Monitor Database Initialization

-- إنشاء الامتدادات المطلوبة
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- إعداد الترميز لدعم العربية
SET client_encoding = 'UTF8';

-- ملاحظة: الجداول تُنشأ تلقائياً بواسطة SQLAlchemy عند بدء التطبيق
