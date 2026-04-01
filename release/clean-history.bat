@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ============================================================
:: CLEAN HISTORY - One-shot script to remove large files from
:: git history and start fresh with a clean main branch.
:: Run from: app\ directory (or it auto-navigates)
:: ============================================================

echo.
echo ========================================
echo  AGENT 1 - Clean Git History
echo ========================================
echo.

:: Navigate to app directory (parent of release\)
cd /d "%~dp0.."
echo Working directory: %CD%
echo.

:: Safety check - are we in a git repo?
if not exist ".git" (
    echo [ERROR] .git folder not found. Are you in the app\ folder?
    echo.
    pause
    exit /b 1
)

:: Check git
where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git not found. Install from https://git-scm.com
    echo.
    pause
    exit /b 1
)

:: Check gh CLI
where gh >nul 2>&1
if errorlevel 1 (
    echo [ERROR] GitHub CLI ^(gh^) not found. Install from https://cli.github.com
    echo.
    pause
    exit /b 1
)

echo All prerequisites OK.
echo.
echo This script will:
echo   1. Delete ALL existing GitHub releases and tags
echo   2. Create an orphan branch ^(clean history, no large files^)
echo   3. Commit all current files as a fresh start
echo   4. Force-push to origin/main
echo.
echo WARNING: This is destructive and cannot be undone.
echo.
set /p CONFIRM="Type YES to continue: "
if /i not "%CONFIRM%"=="YES" (
    echo Aborted.
    echo.
    pause
    exit /b 0
)

echo.
echo ----------------------------------------
echo [Step 1/7] Deleting GitHub releases...
echo ----------------------------------------
for /f "tokens=*" %%r in ('gh release list --limit 100 --json tagName --jq ".[].tagName" 2^>nul') do (
    echo   Deleting release %%r...
    gh release delete "%%r" --yes --cleanup-tag 2>nul
)
echo   Step 1 done.

echo.
echo ----------------------------------------
echo [Step 2/7] Deleting local tags...
echo ----------------------------------------
for /f "tokens=*" %%t in ('git tag --list 2^>nul') do (
    echo   Deleting tag %%t...
    git tag -d "%%t" >nul 2>&1
)
echo   Step 2 done.

echo.
echo ----------------------------------------
echo [Step 3/7] Deleting remote tags...
echo ----------------------------------------
git push origin --delete --tags 2>nul
echo   Step 3 done.

echo.
echo ----------------------------------------
echo [Step 4/7] Removing large files from staging...
echo ----------------------------------------
git rm --cached agent1-v0.9.4-alpha.zip 2>nul
git rm --cached "storage/templates/look-recast/template.json" 2>nul
for %%f in (agent1-v*.zip) do (
    echo   Removing %%f...
    git rm --cached "%%f" 2>nul
    del /q "%%f" 2>nul
)
echo   Step 4 done.

echo.
echo ----------------------------------------
echo [Step 5/7] Creating orphan branch...
echo ----------------------------------------
git checkout --orphan clean-main
if errorlevel 1 (
    echo [ERROR] Failed to create orphan branch.
    echo.
    pause
    exit /b 1
)
echo   Orphan branch created.

echo.
echo   Staging all files...
git add -A
echo   Step 5 done.

echo.
echo ----------------------------------------
echo [Step 6/7] Committing fresh start...
echo ----------------------------------------
git commit -m "fresh start: v0.9.0-alpha with delta release system"
if errorlevel 1 (
    echo [ERROR] Commit failed. See error above.
    echo.
    pause
    exit /b 1
)

echo   Renaming branch to main...
git branch -D main 2>nul
git branch -m main
echo   Step 6 done.

echo.
echo ----------------------------------------
echo [Step 7/7] Force-pushing to GitHub...
echo ----------------------------------------
git push --force --set-upstream origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed. Try manually:
    echo   git push --force --set-upstream origin main
    echo.
    pause
    exit /b 1
)
echo   Step 7 done.

echo.
echo ========================================
echo  SUCCESS! Git history is now clean.
echo ========================================
echo.
echo Next steps:
echo   1. Check GitHub: https://github.com/valsecchi75/agent1-platform
echo   2. Run: release\publish.bat
echo.
pause
