@echo off
echo ========================================
echo  Starting Chat Application
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

REM Check if Prisma client is generated
if not exist "node_modules\.prisma\" (
    echo [INFO] Generating Prisma client...
    call npm run prisma:generate
    if errorlevel 1 (
        echo [ERROR] Failed to generate Prisma client
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting backend server...
start "Backend Server" cmd /k "npm start"

REM Wait a moment for the server to initialize
timeout /t 2 /nobreak >nul

echo [INFO] Starting Cloudflare tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel run mon-tunnel"

echo.
echo ========================================
echo  Application started successfully!
echo  - Backend: Running in separate window
echo  - Tunnel: Running in separate window
echo ========================================
echo.
echo Press any key to exit this window...
pause >nul