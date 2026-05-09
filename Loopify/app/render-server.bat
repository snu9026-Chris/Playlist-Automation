@echo off
cd /d "%~dp0"
echo Starting Loopify Render Server on http://localhost:4100
echo Press Ctrl+C to stop.
echo.
node local-server/render-server.mjs
pause
