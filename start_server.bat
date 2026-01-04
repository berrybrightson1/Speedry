@echo off
echo Starting Speedry Local Server...
echo Access the game at: http://localhost:4040
cd /d "%~dp0"
call npm run dev
pause
