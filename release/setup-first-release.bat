@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
color 0F
title AGENT 1 - First Release Setup

echo.
echo  ================================================================
echo   AGENT 1 - Setup Completo + Prima Pubblicazione
echo  ================================================================
echo.
echo   Questo script fa TUTTO:
echo   1. Verifica prerequisiti (Node, Git, GitHub CLI)
echo   2. Autentica su GitHub (se necessario)
echo   3. Crea il repo privato valsecchi75/agent1-platform
echo   4. Verifica token auto-update (gia configurato)
echo   5. Inizializza git e fa il primo push
echo   6. Build di verifica
echo   7. Crea zip e pubblica la prima release
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
    echo  [ERRORE] Node.js non trovato. Scarica da: https://nodejs.org
    pause & exit /b 1
)
node -v > "%TEMP%\a1_tmp.txt" 2>nul
set /p NODE_VER=<"%TEMP%\a1_tmp.txt"
del "%TEMP%\a1_tmp.txt" 2>nul
echo  Node.js: !NODE_VER! [OK]

where git >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] Git non trovato. Scarica da: https://git-scm.com
    pause & exit /b 1
)
echo  Git [OK]

where gh >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] GitHub CLI non trovato. Scarica da: https://cli.github.com
    pause & exit /b 1
)
echo  GitHub CLI [OK]

echo.
echo  Tutti i prerequisiti OK.
echo.

REM ================================================================
REM  STEP 2 - Autenticazione GitHub
REM ================================================================
echo  [STEP 2/7] Verifica autenticazione GitHub...
echo.

gh auth status >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  Non sei autenticato su GitHub CLI.
    echo  Avvio login nel browser...
    echo.
    gh auth login --web --git-protocol https
    if !ERRORLEVEL! NEQ 0 (
        echo  [ERRORE] Autenticazione fallita.
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
echo  [STEP 3/7] Verifica/creazione repository...
echo.

set "REPO_NAME=agent1-platform"
set "REPO_FULL=valsecchi75/!REPO_NAME!"

gh repo view !REPO_FULL! >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo  Repo !REPO_FULL! gia esistente. [OK]
) else (
    echo  Creo repo privato !REPO_FULL!...
    gh repo create !REPO_FULL! --private --description "AGENT 1 - API-Driven Creative Generation Platform"
    if !ERRORLEVEL! NEQ 0 (
        echo  [ERRORE] Creazione repo fallita.
        pause & exit /b 1
    )
    echo  Repo creato. [OK]
)
echo.

REM ================================================================
REM  STEP 4 - Verifica token auto-update (gia configurato)
REM ================================================================
echo  [STEP 4/7] Verifica token auto-update...
echo.

set "TOKEN_FILE=src\lib\update\token.ts"
if not exist "!TOKEN_FILE!" (
    echo  [ATTENZIONE] !TOKEN_FILE! non trovato.
    echo  Il sistema auto-update non sara attivo.
    goto :step4_done
)

node -e "const c=require('fs').readFileSync('src/lib/update/token.ts','utf8');const ok=c.includes('OBFUSCATED_TOKEN')&&!c.includes(\"= ''\");process.exit(ok?0:1);" >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    echo  Token auto-update configurato in token.ts [OK]
) else (
    echo  [ATTENZIONE] token.ts presente ma OBFUSCATED_TOKEN e vuoto.
    echo  Il sistema di aggiornamenti non sara attivo.
    echo  Puoi configurarlo in seguito con: node release\encode-token.js ^<token^>
)

:step4_done
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
    echo  [ERRORE] Impossibile leggere versione da package.json.
    pause & exit /b 1
)
echo  Versione: !PKG_VERSION!
echo.

REM Crea .gitignore se mancante (evita di committare node_modules/next)
if not exist ".gitignore" (
    echo  Creo .gitignore...
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
    echo  .gitignore creato [OK]
)

REM Init git se necessario
if exist ".git" (
    echo  Repository git gia presente.
    git remote get-url origin >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  Aggiungo remote origin...
        git remote add origin "https://github.com/!REPO_FULL!.git"
    ) else (
        echo  Remote origin gia configurato.
    )
) else (
    echo  Inizializzo git repository...
    git init -b main
    git remote add origin "https://github.com/!REPO_FULL!.git"
)

git config core.filemode false
git config core.autocrlf true

echo.
echo  Staging file e commit...
git add -A
git status --short
echo.

git commit -m "release: AGENT 1 v!PKG_VERSION! initial release"
if !ERRORLEVEL! NEQ 0 (
    echo  [INFO] Nessun file da committare (potrebbe essere gia tutto staged).
)

echo.
echo  Push su GitHub...
git branch -M main
git push -u origin main
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [ATTENZIONE] Push fallito. Il repo potrebbe avere contenuti preesistenti.
    set /p "FORCE_PUSH=  Fare force push? (s/n): "
    if /i "!FORCE_PUSH!"=="s" (
        git push -u origin main --force
        if !ERRORLEVEL! NEQ 0 (
            echo  [ERRORE] Force push fallito. Verifica la connessione e le credenziali.
            pause & exit /b 1
        )
    ) else (
        echo  Push saltato. Continuo con la pubblicazione della release.
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
    echo  [ATTENZIONE] Build fallito.
    set /p "BUILD_CONT=  Continua comunque con la pubblicazione? (s/n): "
    if /i not "!BUILD_CONT!"=="s" (
        echo  Correggi gli errori di build e rilancia questo script.
        pause & exit /b 1
    )
    echo  [ATTENZIONE] Continuo nonostante il build fallito.
) else (
    echo  [OK] Build riuscito.
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
    echo  [ERRORE] release\.releaseinclude non trovato. Impossibile creare lo zip.
    pause & exit /b 1
)

echo  Creo zip di distribuzione...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$items=Get-Content 'release\.releaseinclude'|Where-Object{$_ -and -not $_.StartsWith('#')}|ForEach-Object{$_.Trim().TrimEnd('/')};$td='.release-staging';New-Item -ItemType Directory -Path $td|Out-Null;foreach($i in $items){if(Test-Path $i){$dest=Join-Path $td $i;$par=Split-Path $dest -Parent;if(-not(Test-Path $par)){New-Item -ItemType Directory -Path $par -Force|Out-Null};if((Get-Item $i).PSIsContainer){Copy-Item -Recurse -Force $i $dest}else{Copy-Item -Force $i $dest}}};Compress-Archive -Path (Join-Path $td '*') -DestinationPath '!ZIP_NAME!' -Force;Remove-Item -Recurse -Force $td;$sz=[math]::Round((Get-Item '!ZIP_NAME!').Length/1MB,1);Write-Host('  Zip: !ZIP_NAME! ('+$sz+' MB)')"

if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

if not exist "!ZIP_NAME!" (
    echo  [ERRORE] Creazione zip fallita.
    pause & exit /b 1
)
echo  [OK] Zip creato.
echo.

REM Scrivi release notes
node -e "var fs=require('fs');var v='!PKG_VERSION!';var n='AGENT 1 v'+v+'\r\n\r\nPrima release alpha della piattaforma di generazione creativa AI a nodi.\r\n\r\n## Funzionalita principali\r\n\r\n- Node editor visuale (React Flow)\r\n- Multi-provider API: Gemini, fal.ai, Replicate, WaveSpeed, Kie.ai\r\n- 58 modelli registrati\r\n- Sistema di theming 10 skin\r\n- Gallery, Reports, Loved pages\r\n- Auto-update integrato\r\n- Workflow tabs + session persistence\r\n- Template save/load\r\n';fs.writeFileSync('release/release-notes.tmp',n);" 2>nul

if not exist "release\release-notes.tmp" (
    echo AGENT 1 v!PKG_VERSION! > release\release-notes.tmp
)

echo  Pubblico release su GitHub...
gh release create "v!PKG_VERSION!" "!ZIP_NAME!" --title "AGENT 1 v!PKG_VERSION!" --notes-file "release/release-notes.tmp" --repo !REPO_FULL!
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [ERRORE] Pubblicazione fallita.
    echo  Zip disponibile: !ZIP_NAME!
    echo  Riprova con: release\publish.bat
    pause & exit /b 1
)

REM Cleanup
if exist "release\release-notes.tmp" del "release\release-notes.tmp" 2>nul
if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

echo.
echo  ================================================================
echo.
echo   SETUP COMPLETATO CON SUCCESSO!
echo.
echo   Repo:    https://github.com/!REPO_FULL!
echo   Release: https://github.com/!REPO_FULL!/releases/tag/v!PKG_VERSION!
echo.
echo   Prossime release: usa  release\publish.bat
echo.
echo  ================================================================
echo.
pause
exit /b 0
