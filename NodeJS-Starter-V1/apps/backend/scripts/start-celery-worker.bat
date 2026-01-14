@echo off
REM
REM Start Celery worker for CCW ERP (Windows)
REM
REM Usage: start-celery-worker.bat [environment]
REM Environment: development (default), staging, production
REM

setlocal

set ENV=%1
if "%ENV%"=="" set ENV=development

echo Starting Celery Worker (%ENV%)
cd /d "%~dp0\.."

set ENVIRONMENT=%ENV%

if "%ENV%"=="development" (
    echo Development mode - auto-reload enabled
    uv run celery -A src.scheduler.celery_app worker --loglevel=info --concurrency=4 --max-tasks-per-child=100 --pool=solo --autoreload
) else (
    echo Production mode
    uv run celery -A src.scheduler.celery_app worker --loglevel=info --concurrency=4 --max-tasks-per-child=1000 --pool=solo --time-limit=300 --soft-time-limit=270
)
