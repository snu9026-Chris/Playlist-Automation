@echo off
REM Loopify 통합 런처 — dev 서버(3002) + 로컬 렌더 서버(4100)를 한 번에 띄움.
REM 영상 렌더링은 ffmpeg가 Vercel에서 안 돌아서 로컬 서버 필수.
cd /d "%~dp0"
echo Starting Loopify
echo   Dev:    http://localhost:3002
echo   Render: http://localhost:4100
echo Press Ctrl+C in either window to stop.
echo.
start "Loopify Render Server" cmd /k "node local-server/render-server.mjs"
timeout /t 1 >nul
npm run dev
