@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
color 0E
title AGENT 1 - Version Reset Tool

echo.
echo  =============================================
echo   AGENT 1 - Version Reset Tool
echo   Resetta versioni da v0.9.0-alpha
echo  =============================================
echo.
echo  ATTENZIONE: Questo script:
echo   1. Cancella TUTTE le release su GitHub
echo   2. Cancella TUTTI i tag locali e remoti
echo   3. Resetta package.json a 0.9.0-alpha
echo   4. Pulisce i file ZIP orfani
echo.

set /p "CONFIRM=  Sei sicuro? Scrivi RESET per confermare: "
if not "!CONFIRM!"=="RESET" (
    echo  Annullato.
    pause & exit /b 0
)

echo.
echo  ----------------------------------------
echo   STEP 1: Verifica prerequisiti
echo  ----------------------------------------
echo.

where gh >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] GitHub CLI non trovato.
    pause & exit /b 1
)
gh auth status >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] GitHub CLI non autenticato.
    pause & exit /b 1
)

echo  [OK] Prerequisiti verificati
echo.

echo  ----------------------------------------
echo   STEP 2: Cancellazione release GitHub
echo  ----------------------------------------
echo.

echo  Cercando release esistenti...
gh release list --repo valsecchi75/agent1-platform --limit 50 > "%TEMP%\a1_releases.txt" 2>nul

for /f "tokens=1" %%r in (%TEMP%\a1_releases.txt) do (
    echo  Cancello release: %%r
    gh release delete "%%r" --repo valsecchi75/agent1-platform --yes --cleanup-tag 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo  [AVVISO] Fallito per %%r, provo senza cleanup-tag...
        gh release delete "%%r" --repo valsecchi75/agent1-platform --yes 2>nul
    )
)
del "%TEMP%\a1_releases.txt" 2>nul

echo  [OK] Release cancellate
echo.

echo  ----------------------------------------
echo   STEP 3: Cancellazione tag
echo  ----------------------------------------
echo.

echo  Cancello tag locali...
for /f "tokens=*" %%t in ('git tag -l 2^>nul') do (
    echo  Tag locale: %%t
    git tag -d "%%t" 2>nul
)

echo  Cancello tag remoti...
for /f "tokens=*" %%t in ('git ls-remote --tags origin 2^>nul ^| findstr /r "refs/tags/v"') do (
    for /f "tokens=2 delims=/" %%n in ("%%t") do (
        echo  Tag remoto: %%n
        git push origin --delete "%%n" 2>nul
    )
)

REM Simpler approach: try common tag patterns
for %%v in (v0.9.2-alpha v0.9.3-alpha v0.9.4-alpha v0.9.5-alpha v0.9.6-alpha v0.9.7-alpha v0.9.8-alpha) do (
    git push origin --delete "%%v" 2>nul
)

echo  [OK] Tag cancellati
echo.

echo  ----------------------------------------
echo   STEP 4: Reset versione a 0.9.0-alpha
echo  ----------------------------------------
echo.

node -e "var fs=require('fs');var p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='0.9.0-alpha';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
echo  [OK] package.json resettato a 0.9.0-alpha

REM Update start scripts
for %%f in (start.bat start.sh) do (
    if exist "%%f" (
        node -e "var fs=require('fs');var f='%%f';var c=fs.readFileSync(f,'utf8');c=c.replace(/v\d+\.\d+\.\d+[^\s]*/,'v0.9.0-alpha');fs.writeFileSync(f,c);"
        echo  [OK] %%f aggiornato a v0.9.0-alpha
    )
)

echo.

echo  ----------------------------------------
echo   STEP 5: Pulizia file ZIP orfani
echo  ----------------------------------------
echo.

for %%z in (agent1-v*.zip) do (
    if exist "%%z" (
        echo  Cancello: %%z
        del "%%z" 2>nul
    )
)
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

echo  [OK] File ZIP orfani rimossi
echo.

echo  ----------------------------------------
echo   STEP 6: Commit reset
echo  ----------------------------------------
echo.

set /p "COMMIT_RESET=  Vuoi fare commit del reset? (s/n): "
if /i "!COMMIT_RESET!"=="s" (
    git add package.json start.bat start.sh .gitignore
    git commit -m "chore: reset version to 0.9.0-alpha for fresh release cycle"
    git push
    echo  [OK] Commit e push completati
) else (
    echo  [INFO] Commit saltato. Fallo manualmente quando pronto.
)

echo.
echo  =============================================
echo   Reset completato!
echo  =============================================
echo.
echo  Versione attuale: 0.9.0-alpha
echo  Prossimo step: lancia publish.bat per creare
echo  la prima release FULL v0.9.0-alpha
echo.

pause
exit /b 0
