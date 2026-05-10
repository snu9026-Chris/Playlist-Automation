@echo off
REM Playlist Automation 루트 런처
REM Loopify/app/start.bat 호출 — dev 서버(3002) + 렌더 서버(4100) 동시 실행
cd /d "%~dp0\Loopify\app"
call start.bat
