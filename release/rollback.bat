@echo off
setlocal enabledelayedexpansion
color 0F
title AGENT 1 - Release Rollback

echo.
echo  ========================================
echo   AGENT 1 - Release Rollback
echo  ========================================
echo.
echo  This script moves the "latest" flag
echo  to a previous GitHub release.
echo  No releases are deleted.
echo.
echo  ========================================
echo.

REM ================================================================
REM  STEP 0 — Prerequisiti
REM ================================================================

where gh >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] GitHub CLI not found. Install from https://cli.github.com
    pause & exit /b 1
)

gh auth status >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] GitHub CLI not authenticated. Run: gh auth login
    pause & exit /b 1
)

set "REPO=valsecchi75/agent1-platform"

gh repo view %REPO% >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Unable to access repo %REPO%.
    echo  Verify you have correct permissions.
    pause & exit /b 1
)

echo  Repository: %REPO% [OK]
echo.

REM ================================================================
REM  STEP 1 — List available releases
REM ================================================================

echo  ----------------------------------------
echo   Available releases
echo  ----------------------------------------
echo.

REM Get releases as tab-separated: tag, status, date
set "RELEASE_COUNT=0"
set "CURRENT_LATEST="

for /f "tokens=1,2,3 delims=	" %%a in ('gh release list --repo %REPO% --limit 10 2^>nul') do (
    set /a "RELEASE_COUNT+=1"
    set "REL_TAG_!RELEASE_COUNT!=%%a"
    set "REL_STATUS_!RELEASE_COUNT!=%%b"
    set "REL_DATE_!RELEASE_COUNT!=%%c"

    if "%%b"=="Latest" (
        set "CURRENT_LATEST=%%a"
        echo    !RELEASE_COUNT!. %%a  ^(%%c^)  [LATEST]
    ) else (
        echo    !RELEASE_COUNT!. %%a  ^(%%c^)
    )
)

if %RELEASE_COUNT% EQU 0 (
    echo  No releases found.
    pause & exit /b 0
)

if %RELEASE_COUNT% LEQ 1 (
    echo.
    echo  There is only one release. Nothing to roll back to.
    pause & exit /b 0
)

echo.
echo  ----------------------------------------
echo.

REM ================================================================
REM  STEP 2 — Select target version
REM ================================================================

set /p "CHOICE=  Choose the release number to promote to latest: "

REM Validate choice
if "!REL_TAG_%CHOICE%!"=="" (
    echo  [ERROR] Invalid choice.
    pause & exit /b 1
)

set "TARGET_TAG=!REL_TAG_%CHOICE%!"

if "%TARGET_TAG%"=="%CURRENT_LATEST%" (
    echo  [INFO] %TARGET_TAG% is already the latest release.
    pause & exit /b 0
)

echo.
echo  You selected: %TARGET_TAG%
echo.

REM Show release details
echo  Release details:
echo  ----------------------------------------
gh release view "%TARGET_TAG%" --repo %REPO% --json body --jq ".body" 2>nul | findstr /n "." | findstr /b "^[1-5]:" 2>nul
echo  ----------------------------------------
echo.

REM ================================================================
REM  STEP 3 — Confirm
REM ================================================================

echo  ========================================
echo   WARNING
echo  ========================================
echo.
echo  You are about to make %TARGET_TAG% the "latest" release.
echo  The current release %CURRENT_LATEST% will NOT be deleted.
echo  Clients will receive %TARGET_TAG% at the next update check.
echo.
echo  NOTE: This does NOT modify local files. To align your
echo  environment, use the auto-update system from UI after rollback.
echo.
echo  ========================================
echo.

set /p "CONFIRM=  Confirm? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo  Cancelled.
    pause & exit /b 0
)

REM ================================================================
REM  STEP 4 — Execute
REM ================================================================

echo.
echo  Removing latest flag from %CURRENT_LATEST%...
gh release edit "%CURRENT_LATEST%" --latest=false --repo %REPO%
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Unable to modify %CURRENT_LATEST%.
    echo  No changes made.
    pause & exit /b 1
)

echo  Setting %TARGET_TAG% as latest...
gh release edit "%TARGET_TAG%" --latest=true --repo %REPO%
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [WARNING] Latest flag may be in an undefined state.
    echo  Check with: gh release list --repo %REPO%
    pause & exit /b 1
)

REM ================================================================
REM  STEP 5 — Verify
REM ================================================================

echo.
echo  Verifying...
set "VERIFIED_TAG="
for /f "delims=" %%t in ('gh release view --repo %REPO% --json tagName --jq ".tagName" 2^>nul') do set "VERIFIED_TAG=%%t"

if "%VERIFIED_TAG%"=="" (
    echo  [WARNING] Unable to verify latest release (network or auth error).
    echo  Check manually: gh release list --repo %REPO%
) else if "%VERIFIED_TAG%"=="%TARGET_TAG%" (
    echo  [OK] Rollback completed!
    echo.
    echo  Latest release is now: %TARGET_TAG%
) else (
    echo  [WARNING] Verification shows: %VERIFIED_TAG% (expected: %TARGET_TAG%)
    echo  Check manually: gh release list --repo %REPO%
)

echo.
pause
