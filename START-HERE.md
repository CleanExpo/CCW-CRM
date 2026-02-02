# 🚀 Quick Start Guide - CCW-Online ERP

## Start Everything (One Command)

```powershell
.\start-all.ps1
```

This will start:
- ✅ PostgreSQL Database (port 5433)
- ✅ Redis Cache (port 6381)
- ✅ Backend API (port 8001)
- ✅ Frontend Web App (port 3000)

## Access the System

Once started, open your browser:

🌐 **Frontend**: http://localhost:3000

**Login Credentials:**
- Email: `admin@demo.com`
- Password: `demo123`

## API Documentation

📚 **Backend API Docs**: http://localhost:8001/docs

## Monitoring

📊 **Prometheus**: http://localhost:9090

---

## Manual Startup (If Script Doesn't Work)

### Terminal 1: Database
```bash
docker-compose up -d postgres redis
```

### Terminal 2: Backend
```bash
cd apps/backend
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --reload
```

### Terminal 3: Frontend
```bash
cd apps/web
pnpm dev
```

---

## Stopping the System

Press `Ctrl+C` in the script window and choose `Y` to stop all services.

Or manually:
```bash
docker-compose stop
```

---

## System Requirements

- ✅ Docker Desktop (running)
- ✅ Python 3.12+
- ✅ Node.js 18+
- ✅ pnpm

## Troubleshooting

### Backend won't start
```bash
cd apps/backend
pip install -r requirements.txt
# or
uv sync
```

### Frontend won't start
```bash
cd apps/web
pnpm install
```

### Port conflicts
If ports are already in use, edit `docker-compose.yml` and change:
- PostgreSQL: `5433:5432`
- Redis: `6381:6379`
- Backend: Change port in uvicorn command
- Frontend: Create `.env.local` with `PORT=3001`

---

## What's Next?

After the system starts:

1. **View Dashboard**: http://localhost:3000/dashboard
2. **Explore API**: http://localhost:8001/docs
3. **Run Load Tests**: See `ISSUES-1-5-SUMMARY.md`
4. **Check Monitoring**: http://localhost:9090

---

## Need Help?

- **Documentation**: See `docs/` folder
- **API Reference**: http://localhost:8001/docs
- **Database**: Check `apps/backend/migrations/`
- **Frontend Components**: `apps/web/components/`

---

*Last Updated: February 2, 2026*
