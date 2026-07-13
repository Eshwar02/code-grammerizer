#!/bin/bash
set -e

echo "=== Backend Setup ==="
cd backend
pip3 install fastapi uvicorn sqlalchemy alembic "python-jose[cryptography]" "passlib[bcrypt]" \
  python-multipart anthropic pylint bandit radon reportlab python-dotenv aiofiles \
  httpx pydantic-settings email-validator --user -q

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — add your ANTHROPIC_API_KEY!"
fi

echo ""
echo "=== Frontend Setup ==="
cd ../frontend
npm install

echo ""
echo "=== Done! ==="
echo ""
echo "1. Edit backend/.env → set ANTHROPIC_API_KEY"
echo "2. Terminal 1: cd backend && uvicorn app:app --reload"
echo "3. Terminal 2: cd frontend && npm run dev"
echo "4. Open: http://localhost:5173"
