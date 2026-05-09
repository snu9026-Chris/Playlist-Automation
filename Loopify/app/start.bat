@echo off
cd /d "%~dp0"
echo Starting dev server on http://localhost:3002
echo Press Ctrl+C to stop.
echo.
npm run dev
pause
