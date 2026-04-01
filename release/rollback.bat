@echo off
setlocal enabledelayedexpansion
color 0F
title AGENT 1 - Release Rollback

echo.
echo  ========================================
echo   AGENT 1 - Release Rollback
echo  ========================================
echo.
echo  Questo script sposta il flag "latest"
echo  su una release precedente di GitHub.
echo  Nessuna release viene cancellata.
echo.
echo  ========================================
echo.

REM ================================================================
REM  STEP 0 — Prerequisiti
REM ================================================================

where gh >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERRORE] GitHub CLI non trovato. Installa da https://cli.github.com
    pause & exit /b 1
)

gh auth status >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERRORE] GitHub CLI non autenticato. Lancia: gh auth login
    pause & exit /b 1
)

set "REPO=valsecchi75/agent1-platform"

gh repo view %REPO% >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERRORE] Impossibile accedere al repo %REPO%.
    echo  Verifica di avere i permessi corretti.
    pause & exit /b 1
)

echo  Repository: %REPO% [OK]
echo.

REM ================================================================
REM  STEP 1 — Lista release disponibili
REM ================================================================

echo  ----------------------------------------
echo   Release disponibili
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
    echo  Nessuna release trovata.
    pause & exit /b 0
)

if %RELEASE_COUNT% LEQ 1 (
    echo.
    echo  C'e' solo una release. Non c'e' niente a cui tornare.
    pause & exit /b 0
)

echo.
echo  ----------------------------------------
echo.

REM ================================================================
REM  STEP 2 — Selezione versione target
REM ================================================================

set /p "CHOICE=  Scegli il numero della release da promuovere a latest: "

REM Validate choice
if "!REL_TAG_%CHOICE%!"=="" (
    echo  [ERRORE] Scelta non valida.
    pause & exit /b 1
)

set "TARGET_TAG=!REL_TAG_%CHOICE%!"

if "%TARGET_TAG%"=="%CURRENT_LATEST%" (
    echo  [INFO] %TARGET_TAG% e' gia la release latest.
    pause & exit /b 0
)

echo.
echo  Hai scelto: %TARGET_TAG%
echo.

REM Show release details
echo  Dettagli release:
echo  ----------------------------------------
gh release view "%TARGET_TAG%" --repo %REPO% --json body --jq ".body" 2>nul | findstr /n "." | findstr /b "^[1-5]:" 2>nul
echo  ----------------------------------------
echo.

REM ================================================================
REM  STEP 3 — Conferma
REM ================================================================

echo  ========================================
echo   ATTENZIONE
echo  ========================================
echo.
echo  Stai per rendere %TARGET_TAG% la release "latest".
echo  La release corrente %CURRENT_LATEST% NON verra' cancellata.
echo  I client riceveranno %TARGET_TAG% al prossimo check aggiornamenti.
echo.
echo  NOTA: Questo NON modifica i file locali. Per allineare il tuo
echo  ambiente, usa il sistema di auto-update dalla UI dopo il rollback.
echo.
echo  ========================================
echo.

set /p "CONFIRM=  Confermi? (s/n): "
if /i not "%CONFIRM%"=="s" (
    echo  Annullato.
    pause & exit /b 0
)

REM ================================================================
REM  STEP 4 — Esecuzione
REM ================================================================

echo.
echo  Rimuovo flag latest da %CURRENT_LATEST%...
gh release edit "%CURRENT_LATEST%" --latest=false --repo %REPO%
if %ERRORLEVEL% NEQ 0 (
    echo  [ERRORE] Impossibile modificare %CURRENT_LATEST%.
    echo  Nessuna modifica effettuata.
    pause & exit /b 1
)

echo  Imposto %TARGET_TAG% come latest...
gh release edit "%TARGET_TAG%" --latest=true --repo %REPO%
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ATTENZIONE] Il flag latest potrebbe essere in uno stato indefinito.
    echo  Verifica con: gh release list --repo %REPO%
    pause & exit /b 1
)

REM ================================================================
REM  STEP 5 — Verifica
REM ================================================================

echo.
echo  Verifico...
set "VERIFIED_TAG="
for /f "delims=" %%t in ('gh release view --repo %REPO% --json tagName --jq ".tagName" 2^>nul') do set "VERIFIED_TAG=%%t"

if "%VERIFIED_TAG%"=="" (
    echo  [ATTENZIONE] Impossibile verificare la release latest (errore di rete o auth).
    echo  Verifica manualmente: gh release list --repo %REPO%
) else if "%VERIFIED_TAG%"=="%TARGET_TAG%" (
    echo  [OK] Rollback completato!
    echo.
    echo  La release latest e' ora: %TARGET_TAG%
) else (
    echo  [ATTENZIONE] La verifica mostra: %VERIFIED_TAG% (atteso: %TARGET_TAG%)
    echo  Verifica manualmente: gh release list --repo %REPO%
)

echo.
pause
