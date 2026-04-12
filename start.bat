@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
color 0F

echo.
echo     _____  _____ _____ _   _ _____  __
echo    /  _  \/  ___/  ___/ \ / /__   \/ /
echo   / /_\  / /__ / /___/   V /  / /\/ /
echo  / /   _/ /__ / /___/ /V \ \ / / / /
echo /_/   /______/______/_/ \_\ \/  /_/
echo.
echo  From Vision to Form              v0.9.21-alpha
echo.
echo  +--------------------------------------+
echo  :                                      :
echo  :  LOGIN .... admin / admin            :
echo  :  SERVER ... http://localhost:3000    :
echo  :                                      :
echo  +--------------------------------------+
echo.

REM ── Check Node.js ──────────────────────────────────────────
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js is required but was not found.
    echo  Install from https://nodejs.org ^(v18 or later^)
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% LSS 18 (
    echo  [ERROR] Node.js 18+ required. Current: v%NODE_MAJOR%
    echo  Install from https://nodejs.org
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] npm is required but was not found.
    echo.
    pause
    exit /b 1
)

REM ── Check port 3000 ────────────────────────────────────────
netstat -ano 2>nul | findstr ":3000 " | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo  [!] WARNING: Port 3000 is already in use.
    echo      Close the other process or change PORT in .env
    echo.
)

REM ── Clean corrupted node_modules if next is broken ─────────
if exist "node_modules" (
    node -e "require('next/package.json')" >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [*] Detected corrupted dependencies, cleaning...
        rmdir /s /q node_modules 2>nul
        del /f /q package-lock.json 2>nul
        echo  [OK] Cleaned
        echo.
    )
)

REM ── Install dependencies ───────────────────────────────────
if not exist "node_modules" (
    echo  [*] First launch - installing dependencies...
    echo      This may take a few minutes, please wait...
    echo.
    call npm install --no-audit --no-fund
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [ERROR] npm install failed. Check your internet connection.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Dependencies installed
    echo.
) else (
    echo  [*] Checking dependencies...
    call npm install --prefer-offline --no-audit --no-fund >nul 2>nul
)

REM ── Verify critical packages ───────────────────────────────
node -e "require('next/package.json')" >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [*] Next.js not found, reinstalling...
    rmdir /s /q node_modules 2>nul
    call npm install --no-audit --no-fund
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [ERROR] Failed to install Next.js. Check your internet.
        echo.
        pause
        exit /b 1
    )
    REM Final check
    node -e "require('next/package.json')" >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [ERROR] Next.js still not found after reinstall.
        echo  Try deleting node_modules and running: npm install
        echo.
        pause
        exit /b 1
    )
)

REM ── Rebuild better-sqlite3 if needed ───────────────────────
node -e "require('better-sqlite3')" >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [*] Rebuilding native database module...
    call npm rebuild better-sqlite3 >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [!] WARNING: Database module failed to build.
        echo      The app will use .env auth as fallback.
        echo.
    ) else (
        echo  [OK] Database module ready
        echo.
    )
)

REM ── Create .env if missing ─────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        echo  [*] Creating config from template...
        copy .env.example .env >nul
        echo  [OK] Config created
        echo.
    ) else (
        echo  [!] WARNING: No .env file found
        echo.
    )
)

REM ── Auto-generate JWT_SECRET if missing ────────────────────
if exist ".env" (
    findstr /B "JWT_SECRET=" .env >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [*] Generating JWT secret...
        for /f "delims=" %%s in ('node -e "process.stdout.write(require("""crypto""").randomBytes(32).toString("""hex"""))"') do set JWT_VAL=%%s
        if defined JWT_VAL (
            echo JWT_SECRET=!JWT_VAL!>> .env
            echo  [OK] JWT secret generated
            echo.
        )
    )
)

REM ── Create storage directories ─────────────────────────────
if not exist "data" mkdir data
if not exist "data\generations" mkdir data\generations
if not exist "storage" mkdir storage
if not exist "storage\input" mkdir storage\input
if not exist "storage\output" mkdir storage\output
if not exist "storage\output\images" mkdir storage\output\images
if not exist "storage\output\videos" mkdir storage\output\videos
if not exist "storage\output\audio" mkdir storage\output\audio
if not exist "storage\workflows" mkdir storage\workflows

REM ── Build application ──────────────────────────────────────
echo  [*] Building application...
call npm run build >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [!] Build failed, trying clean build...
    if exist ".next" rmdir /s /q ".next" 2>nul
    call npm run build
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [ERROR] Build failed. Check for errors above.
        echo.
        pause
        exit /b 1
    )
)
echo  [OK] Build complete
echo.

REM ── Launch server ──────────────────────────────────────────
echo  [OK] All systems ready
echo.
echo  ----------------------------------------
echo  Starting server on http://localhost:3000
echo  Press Ctrl+C to stop.
echo  ----------------------------------------
echo.
set NODE_ENV=production
node server.js
echo.
pause
exit /b 0