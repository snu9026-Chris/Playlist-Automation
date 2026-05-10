@echo off
REM Loopify 통합 런처
REM   - dev 서버: http://localhost:3002
REM   - 렌더 서버 + Cloudflare Tunnel (start-with-tunnel.mjs가 둘 다 실행 + Supabase URL 동기화)
cd /d "%~dp0"
echo Starting Loopify
echo   Dev:    http://localhost:3002
echo   Render: http://localhost:4100 (Cloudflare Tunnel auto-published)
echo Close this window or Ctrl+C to stop.
echo.
start "Loopify Render + Tunnel" cmd /k "node local-server/start-with-tunnel.mjs"
timeout /t 2 >nul
npm run dev
