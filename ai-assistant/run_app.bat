@echo off
echo ==========================================
echo      Starting AI Assistant System...
echo ==========================================

REM Start Flask Backend in a new window
echo Starting Backend Server (Port 5001)...
start "AI Assistant Backend" cmd /k "cd flask_backend && "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" app.py"

REM Give backend a moment to initialize
timeout /t 2 /nobreak >nul

REM Start Frontend Server (Port 8000)
echo Starting Frontend Server (Port 8000)...
echo This will open your default browser automatically.
"%LOCALAPPDATA%\Programs\Python\Python311\python.exe" server.py

pause
