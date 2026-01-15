@echo off
REM
REM Start Celery Beat scheduler for CCW ERP (Windows)
REM
REM Usage: start-celery-beat.bat [environment]
REM

setlocal

set ENV=%1
if "%ENV%"=="" set ENV=development

echo Starting Celery Beat (%ENV%)
cd /d "%~dp0\.."

set ENVIRONMENT=%ENV%

uv run celery -A src.scheduler.celery_app beat --loglevel=info
