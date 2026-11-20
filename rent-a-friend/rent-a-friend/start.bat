@echo off
rem Windows: double-click to install (first time) and start the server.
rem Optional: set ADMIN_EMAIL and ADMIN_PASSWORD below BEFORE the first run to choose your admin login.
rem set ADMIN_EMAIL=you@example.com
rem set ADMIN_PASSWORD=ChooseAStrongPassword1
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org then run this again. & pause & exit /b 1)
if not exist node_modules (call npm install)
echo.
echo Open http://localhost:3000 in your browser. Press Ctrl+C to stop.
node server\index.js
pause
