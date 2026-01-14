@echo off
REM
REM Start Flower monitoring UI for Celery (Windows)
REM
REM Usage: start-flower.bat [port]
REM Default port: 5555
REM Access at: http://localhost:5555
REM

setlocal

set PORT=%1
if "%PORT%"=="" set PORT=5555

echo Starting Flower Monitoring UI
echo Access at: http://localhost:%PORT%
cd /d "%~dp0\.."

uv run celery -A src.scheduler.celery_app flower --port=%PORT% --broker=redis://localhost:6379/0 --loglevel=info --max_tasks=10000
