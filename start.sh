#!/bin/bash
# سكريبت تشغيل منظومة رصد الإعلام

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PY="/usr/local/opt/python@3.11/bin/python3.11"
VENV="$SCRIPT_DIR/backend/venv"

echo "======================================"
echo "  منظومة رصد الإعلام - Saudi Media Monitor"
echo "======================================"

# 1. تشغيل PostgreSQL
echo ""
echo "📦 تشغيل PostgreSQL..."
brew services start postgresql@15 2>/dev/null || true
sleep 2

# إنشاء قاعدة البيانات إن لم تكن موجودة
/usr/local/opt/postgresql@15/bin/createdb media_monitor 2>/dev/null || true
/usr/local/opt/postgresql@15/bin/psql media_monitor -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'password';" 2>/dev/null || true

# 2. تشغيل Redis
echo "📦 تشغيل Redis..."
brew services start redis 2>/dev/null || true
sleep 1

# 3. تشغيل Backend
echo ""
echo "🚀 تشغيل Backend (FastAPI)..."
cd "$SCRIPT_DIR/backend"
source "$VENV/bin/activate"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# 4. تشغيل Frontend
echo ""
echo "🎨 تشغيل Frontend (React)..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "======================================"
echo "  ✅ المنظومة تعمل!"
echo "======================================"
echo "  🌐 Frontend:  http://localhost:3000"
echo "  🔧 Backend:   http://localhost:8000"
echo "  📚 API Docs:  http://localhost:8000/docs"
echo "======================================"
echo ""
echo "اضغط Ctrl+C لإيقاف جميع الخدمات"

# انتظار الإيقاف
trap "echo 'إيقاف الخدمات...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
