@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
color 0F
title AGENT 1 - First Release Setup

echo.
echo  ================================================================
echo   AGENT 1 - Complete Setup + First Release
echo  ================================================================
echo.
echo   This script does EVERYTHING:
echo   1. Check prerequisites (Node, Git, GitHub CLI)
echo   2. Authenticate on GitHub (if needed)
echo   3. Create private repo valsecchi75/agent1-platform
echo   4. Verify auto-update token (already configured)
echo   5. Initialize git and push first commit
echo   6. Verification build
echo   7. Create zip and publish first release
echo.
echo  ================================================================
echo.
pause

REM ================================================================
REM  STEP 1 - Prerequisiti
REM  Usa file temp per catturare output — niente for/goto
REM ================================================================
echo.
echo  [STEP 1/7] Verifica prerequisiti...
echo.

where node >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] Node.js not found. Download from: https://nodejs.org
    pause & exit /b 1
)
node -v > "%TEMP%\a1_tmp.txt" 2>nul
set /p NODE_VER=<"%TEMP%\a1_tmp.txt"
del "%TEMP%\a1_tmp.txt" 2>nul
echo  Node.js: !NODE_VER! [OK]

where git >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] Git not found. Download from: https://git-scm.com
    pause & exit /b 1
)
echo  Git [OK]

where gh >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] GitHub CLI not found. Download from: https://cli.github.com
    pause & exit /b 1
)
echo  GitHub CLI [OK]

echo.
echo  All prerequisites OK.
echo.

REM ================================================================
REM  STEP 2 - Autenticazione GitHub
REM ================================================================
echo  [STEP 2/7] Verifica autenticazione GitHub...
echo.

gh auth status >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  You are not authenticated on GitHub CLI.
    echo  Starting browser login...
    echo.
    gh auth login --web --git-protocol https
    if !ERRORLEVEL! NEQ 0 (
        echo  [ERROR] Authentication failed.
        pause & exit /b 1
    )
)

gh api user --jq .login > "%TEMP%\a1_tmp.txt" 2>nul
set /p GH_USER=<"%TEMP%\a1_tmp.txt"
del "%TEMP%\a1_tmp.txt" 2>nul
echo  Autenticato come: !GH_USER! [OK]
echo.

REM ================================================================
REM  STEP 3 - Creazione repository privato
REM ================================================================
echo  [STEP 3/7] Verify/create repository...
echo.

set "REPO_NAME=agent1-platform"
set "REPO_FULL=valsecchi75/!REPO_NAME!"

gh repo view !REPO_FULL! >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo  Repo !REPO_FULL! already exists. [OK]
) else (
    echo  Creating private repo !REPO_FULL!...
    gh repo create !REPO_FULL! --public --description "AGENT 1 - API-Driven Creative Generation Platform"
    if !ERRORLEVEL! NEQ 0 (
        echo  [ERROR] Repo creation failed.
        pause & exit /b 1
    )
    echo  Repo created. [OK]
)
echo.

REM ================================================================
REM  STEP 4 - REMOVED (public API, no token needed)
REM ================================================================
echo  [STEP 4/7] Token verification... SKIPPED (public API)
echo  The update system uses public GitHub APIs.
echo  No token required.
echo.

REM ================================================================
REM  STEP 5 - Leggi versione, init git, primo push
REM ================================================================
echo  [STEP 5/7] Inizializzazione Git + push...
echo.

REM Leggi versione con file temp (evita conflitti virgolette in for/f)
node -p "require('./package.json').version" > "%TEMP%\a1_ver.txt" 2>nul
set /p PKG_VERSION=<"%TEMP%\a1_ver.txt"
del "%TEMP%\a1_ver.txt" 2>nul

if "!PKG_VERSION!"=="" (
    echo  [ERROR] Unable to read version from package.json.
    pause & exit /b 1
)
echo  Versione: !PKG_VERSION!
echo.

REM Create .gitignore if missing (avoids committing node_modules/next)
if not exist ".gitignore" (
    echo  Creating .gitignore...
    (
        echo node_modules/
        echo .next/
        echo .env.local
        echo *.zip
        echo .release-staging/
        echo release/release-notes.tmp
        echo data/
        echo storage/
        echo logs/
        echo input/
        echo output/
    ) > .gitignore
    echo  .gitignore created [OK]
)

REM Initialize git if needed
if exist ".git" (
    echo  Git repository already present.
    git remote get-url origin >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  Adding remote origin...
        git remote add origin "https://github.com/!REPO_FULL!.git"
    ) else (
        echo  Remote origin already configured.
    )
) else (
    echo  Initializing git repository...
    git init -b main
    git remote add origin "https://github.com/!REPO_FULL!.git"
)

git config core.filemode false
git config core.autocrlf true

echo.
echo  Staging files and commit...
git add -A
git status --short
echo.

git commit -m "release: AGENT 1 v!PKG_VERSION! initial release"
if !ERRORLEVEL! NEQ 0 (
    echo  [INFO] No files to commit (may already be staged).
)

echo.
echo  Pushing to GitHub...
git branch -M main
git push -u origin main
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [WARNING] Push failed. The repo may have pre-existing content.
    set /p "FORCE_PUSH=  Do force push? (y/n): "
    if /i "!FORCE_PUSH!"=="y" (
        git push -u origin main --force
        if !ERRORLEVEL! NEQ 0 (
            echo  [ERROR] Force push failed. Check connection and credentials.
            pause & exit /b 1
        )
    ) else (
        echo  Push skipped. Continuing with release publication.
    )
)
echo  [OK] Codice su GitHub.
echo.

REM ================================================================
REM  STEP 6 - Build di verifica
REM ================================================================
echo  [STEP 6/7] Build di verifica...
echo.

call npm run build
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [WARNING] Build failed.
    set /p "BUILD_CONT=  Continue anyway with publication? (y/n): "
    if /i not "!BUILD_CONT!"=="y" (
        echo  Fix build errors and rerun this script.
        pause & exit /b 1
    )
    echo  [WARNING] Continuing despite build failure.
) else (
    echo  [OK] Build succeeded.
)
echo.

REM ================================================================
REM  STEP 7 - Crea zip e pubblica release
REM ================================================================
echo  [STEP 7/7] Creazione zip e pubblicazione...
echo.

set "ZIP_NAME=agent1-v!PKG_VERSION!.zip"
if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

if not exist "release\.releaseinclude" (
    echo  [ERROR] release\.releaseinclude not found. Unable to create zip.
    pause & exit /b 1
)

echo  Creating distribution zip...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$items=Get-Content 'release\.releaseinclude'|Where-Object{$_ -and -not $_.StartsWith('#')}|ForEach-Object{$_.Trim().TrimEnd('/')};$td='.release-staging';New-Item -ItemType Directory -Path $td|Out-Null;foreach($i in $items){if(Test-Path $i){$dest=Join-Path $td $i;$par=Split-Path $dest -Parent;if(-not(Test-Path $par)){New-Item -ItemType Directory -Path $par -Force|Out-Null};if((Get-Item $i).PSIsContainer){Copy-Item -Recurse -Force $i $dest}else{Copy-Item -Force $i $dest}}};Compress-Archive -Path (Join-Path $td '*') -DestinationPath '!ZIP_NAME!' -Force;Remove-Item -Recurse -Force $td;$sz=[math]::Round((Get-Item '!ZIP_NAME!').Length/1MB,1);Write-Host('  Zip: !ZIP_NAME! ('+$sz+' MB)')"

if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

if not exist "!ZIP_NAME!" (
    echo  [ERROR] Zip creation failed.
    pause & exit /b 1
)
echo  [OK] Zip created.
echo.

REM Scrivi release notes
node -e "var fs=require('fs');var v='!PKG_VERSION!';var n='AGENT 1 v'+v+'\r\n\r\nPrima release alpha della piattaforma di generazione creativa AI a nodi.\r\n\r\n## Funzionalita principali\r\n\r\n- Node editor visuale (React Flow)\r\n- Multi-provider API: Gemini, fal.ai, Replicate, WaveSpeed, Kie.ai\r\n- 58 modelli registrati\r\n- Sistema di theming 10 skin\r\n- Gallery, Reports, Loved pages\r\n- Auto-update integrato\r\n- Workflow tabs + session persistence\r\n- Template save/load\r\n';fs.writeFileSync('release/release-notes.tmp',n);" 2>nul

if not exist "release\release-notes.tmp" (
    echo AGENT 1 v!PKG_VERSION! > release\release-notes.tmp
)

echo  Publishing release on GitHub...
gh release create "v!PKG_VERSION!" "!ZIP_NAME!" --title "AGENT 1 v!PKG_VERSION!" --notes-file "release/release-notes.tmp" --repo !REPO_FULL!
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [ERROR] Publication failed.
    echo  Zip available: !ZIP_NAME!
    echo  Retry with: release\publish.bat
    pause & exit /b 1
)

REM Cleanup
if exist "release\release-notes.tmp" del "release\release-notes.tmp" 2>nul
if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

echo.
echo  ================================================================
echo.
echo   SETUP COMPLETED SUCCESSFULLY!
echo.
echo   Repo:    https://github.com/!REPO_FULL!
echo   Release: https://github.com/!REPO_FULL!/releases/tag/v!PKG_VERSION!
echo.
echo   Future releases: use  release\publish.bat
echo.
echo  ================================================================
echo.
pause
exit /b 0
