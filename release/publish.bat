@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
color 0F
title AGENT 1 - Release Publisher (Delta)

echo.
echo  ========================================
echo   AGENT 1 - Release Publisher (Delta)
echo  ========================================
echo.

REM ================================================================
REM  LOG SETUP
REM ================================================================
if not exist "release\logs" mkdir "release\logs"
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmmss"') do set "LOG_TS=%%T"
set "LOG_FILE=release\logs\publish-!LOG_TS!.log"
echo [!LOG_TS!] Publish started> "!LOG_FILE!"

REM ================================================================
REM  STEP 1 - Prerequisiti + Info versione
REM ================================================================

where node >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] Node.js non trovato. Installa da https://nodejs.org
    echo [ERRORE] Node.js non trovato>> "!LOG_FILE!"
    pause & exit /b 1
)
where git >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] Git non trovato. Installa da https://git-scm.com
    echo [ERRORE] Git non trovato>> "!LOG_FILE!"
    pause & exit /b 1
)
where gh >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] GitHub CLI non trovato. Installa da https://cli.github.com
    echo [ERRORE] GitHub CLI non trovato>> "!LOG_FILE!"
    pause & exit /b 1
)
gh auth status >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] GitHub CLI non autenticato. Lancia: gh auth login
    echo [ERRORE] GitHub CLI non autenticato>> "!LOG_FILE!"
    pause & exit /b 1
)

REM Leggi versione con file temp
node -p "require('./package.json').version" > "%TEMP%\a1_ver.txt" 2>nul
set /p CURRENT_VERSION=<"%TEMP%\a1_ver.txt"
del "%TEMP%\a1_ver.txt" 2>nul

if "!CURRENT_VERSION!"=="" (
    echo  [ERRORE] Impossibile leggere versione da package.json.
    pause & exit /b 1
)
echo  Versione corrente: !CURRENT_VERSION!
echo [INFO] Versione corrente: !CURRENT_VERSION!>> "!LOG_FILE!"
echo.

REM -- Flags --
set "DRY_RUN=0"
set "FORCE_FULL=0"
if "%~1"=="--dry-run" set "DRY_RUN=1"
if "%~1"=="--full" set "FORCE_FULL=1"
if "%~2"=="--full" set "FORCE_FULL=1"

if "!DRY_RUN!"=="1" (
    echo  =========================================
    echo   DRY RUN - nessuna azione reale
    echo  =========================================
    echo.
)
if "!FORCE_FULL!"=="1" (
    echo  [INFO] Modalita FULL forzata [--full]
    echo.
)

REM -- Detect phase --
node -p "const v='!CURRENT_VERSION!';v.includes('-alpha')?'alpha':v.includes('-beta')?'beta':'stable'" > "%TEMP%\a1_phase.txt" 2>nul
set /p PHASE=<"%TEMP%\a1_phase.txt"
del "%TEMP%\a1_phase.txt" 2>nul
if "!PHASE!"=="" set "PHASE=stable"

REM ================================================================
REM  STEP 2 - Scelta tipo di bump (SOLO calcolo, nessuna scrittura)
REM ================================================================

if "!PHASE!"=="alpha" goto :menu_alpha
if "!PHASE!"=="beta"  goto :menu_beta
goto :menu_stable

:menu_alpha
echo  Fase: ALPHA
echo.
echo  Scegli il tipo di release:
echo    [a] Alpha patch    0.9.x-alpha -- 0.9.y-alpha
echo    [b] Promuovi a Beta          -- 1.0.0-beta
echo    [r] Release finale           -- 1.0.0
echo.
set /p "BUMP=  Scelta: "
if /i "!BUMP!"=="a" goto :calc_version
if /i "!BUMP!"=="b" goto :calc_version
if /i "!BUMP!"=="r" goto :calc_version
echo  [ERRORE] Scelta non valida. Usa: a, b, r
pause & exit /b 1

:menu_beta
echo  Fase: BETA
echo.
echo  Scegli il tipo di release:
echo    [b] Beta patch     1.0.0-beta.x -- 1.0.0-beta.y
echo    [r] Release finale              -- 1.0.0
echo.
set /p "BUMP=  Scelta: "
if /i "!BUMP!"=="b" goto :calc_version
if /i "!BUMP!"=="r" goto :calc_version
echo  [ERRORE] Scelta non valida. Usa: b, r
pause & exit /b 1

:menu_stable
echo  Fase: STABILE
echo.
echo  Scegli il tipo di release:
echo    [p] Patch   (bug fix)
echo    [m] Minor   (nuove feature)
echo    [M] Major   (breaking changes)
echo.
set /p "BUMP=  Scelta: "
if "!BUMP!"=="p" goto :calc_version
if "!BUMP!"=="m" goto :calc_version
if "!BUMP!"=="M" goto :calc_version
echo  [ERRORE] Scelta non valida. Usa: p, m, M
pause & exit /b 1

:calc_version
node -e "var v='!CURRENT_VERSION!',b='!BUMP!',ph='!PHASE!',nv;if(ph==='alpha'){if(b==='a'){var p=v.match(/^(\d+)\.(\d+)\.(\d+)/);nv=p[1]+'.'+p[2]+'.'+(parseInt(p[3])+1)+'-alpha'}else if(b==='b'){nv='1.0.0-beta'}else if(b==='r'){nv='1.0.0'}}else if(ph==='beta'){if(b==='b'){var m=v.match(/beta\.?(\d*)/);var n=m&&m[1]?parseInt(m[1])+1:1;nv='1.0.0-beta.'+n}else if(b==='r'){nv='1.0.0'}}else{var p=v.match(/^(\d+)\.(\d+)\.(\d+)/);var ma=parseInt(p[1]),mi=parseInt(p[2]),pa=parseInt(p[3]);if(b==='p')nv=ma+'.'+mi+'.'+(pa+1);else if(b==='m')nv=ma+'.'+(mi+1)+'.0';else if(b==='M')nv=(ma+1)+'.0.0'}process.stdout.write(nv||'ERROR')" > "%TEMP%\a1_newver.txt" 2>nul
set /p NEW_VERSION=<"%TEMP%\a1_newver.txt"
del "%TEMP%\a1_newver.txt" 2>nul

if "!NEW_VERSION!"=="ERROR" (
    echo  [ERRORE] Calcolo versione fallito.
    pause & exit /b 1
)
if "!NEW_VERSION!"=="" (
    echo  [ERRORE] Calcolo versione fallito.
    pause & exit /b 1
)

echo.
echo  Versione suggerita: !NEW_VERSION!
echo.
set /p "OVERRIDE_VERSION=  Premi INVIO per confermare, oppure scrivi una versione diversa: "
if not "!OVERRIDE_VERSION!"=="" set "NEW_VERSION=!OVERRIDE_VERSION!"
echo  [OK] Versione finale: !NEW_VERSION!
echo [INFO] Versione finale: !NEW_VERSION!>> "!LOG_FILE!"
echo.

REM -- ZIP_NAME --
set "ZIP_NAME=agent1-v!NEW_VERSION!.zip"

REM -- Dry run salta step 3-6 --
if "!DRY_RUN!"=="1" goto :step7_summary

REM ================================================================
REM  STEP 3 - Build di verifica
REM  (PRIMA del version bump — se fallisce, nulla viene modificato)
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 3: Build di verifica
echo  ----------------------------------------
echo.
call npm run build
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] Build fallito.
    echo [ERRORE] Build fallito>> "!LOG_FILE!"
    set /p "BUILD_CHOICE=  Abortire o continuare comunque? (a/c): "
    if /i "!BUILD_CHOICE!"=="a" (
        echo  Nessun file modificato - annullamento pulito.
        echo [INFO] Annullato prima del bump - nessun rollback necessario>> "!LOG_FILE!"
        pause & exit /b 0
    )
    echo  [ATTENZIONE] Continuo nonostante il build fallito.
) else (
    echo  [OK] Build riuscito
    echo [OK] Build riuscito>> "!LOG_FILE!"
)

REM ================================================================
REM  STEP 4 - Delta detection + Creazione zip
REM  (PRIMA del version bump — se fallisce, nulla viene modificato)
REM  Usa script esterno per evitare problemi di escape e lunghezza CLI
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 4: Delta detection + Creazione zip
echo  ----------------------------------------
echo.

if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
if not exist "release\.tmp" mkdir "release\.tmp" 2>nul

if not exist "release\.releaseinclude" (
    echo  [ERRORE] release\.releaseinclude non trovato.
    pause & exit /b 1
)

REM -- Detect last release tag --
set "LAST_TAG="
set "RELEASE_TYPE=full"
set "PREVIOUS_VERSION=none"

if "!FORCE_FULL!"=="0" (
    for /f "delims=" %%t in ('git tag --list "v*" --sort=-version:refname 2^>nul') do (
        if "!LAST_TAG!"=="" set "LAST_TAG=%%t"
    )
)

if "!LAST_TAG!"=="" (
    echo  [INFO] Nessun tag precedente. Creo release FULL.
    echo [INFO] Nessun tag - release FULL>> "!LOG_FILE!"
    set "RELEASE_TYPE=full"
) else (
    echo  [INFO] Ultimo tag: !LAST_TAG! - Creo release DELTA.
    echo [INFO] Ultimo tag: !LAST_TAG! - DELTA>> "!LOG_FILE!"
    set "RELEASE_TYPE=delta"
    set "PREVIOUS_VERSION=!LAST_TAG:~1!"
)

REM ================================================================
REM  Delega la creazione staging a build-staging.js (script esterno)
REM ================================================================

node release/build-staging.js "!RELEASE_TYPE!" "!NEW_VERSION!" "!PREVIOUS_VERSION!" "!LAST_TAG!"

if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] build-staging.js ha restituito errore.
    echo [ERRORE] build-staging.js fallito>> "!LOG_FILE!"
)

REM Leggi risultato da Node
if not exist "release\.tmp\a1_build_result.txt" (
    echo  [ERRORE] Delta detection fallita - nessun risultato da build-staging.js.
    echo  [INFO] Nessun file modificato - annullamento pulito.
    echo [ERRORE] Delta detection fallita>> "!LOG_FILE!"
    pause & exit /b 0
)

REM Usa Node per parsare il risultato e scrivere variabili semplici
node -e "var r=JSON.parse(require('fs').readFileSync('release/.tmp/a1_build_result.txt','utf8'));var lines=['type='+r.type,'files='+r.files,'deleted='+(r.deleted||0),'error='+(r.error?r.error:'none')];require('fs').writeFileSync('release/.tmp/a1_build_vars.txt',lines.join('\n'));" 2>nul

set "BUILD_type="
set "BUILD_files=0"
set "BUILD_deleted=0"
set "BUILD_error=none"
for /f "usebackq tokens=1,* delims==" %%a in ("release\.tmp\a1_build_vars.txt") do (
    set "BUILD_%%a=%%b"
)
del "release\.tmp\a1_build_vars.txt" 2>nul

if "!BUILD_error!"=="NO_CHANGES" (
    echo  [INFO] Nessun file modificato rispetto a !LAST_TAG!. Nulla da rilasciare.
    echo [INFO] Nessun file modificato - annullamento pulito>> "!LOG_FILE!"
    del "release\.tmp\a1_build_result.txt" 2>nul
    if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
    pause & exit /b 0
)
if not "!BUILD_error!"=="none" (
    echo  [ERRORE] Delta detection: !BUILD_error!
    echo  [INFO] Nessun file modificato - annullamento pulito.
    echo [ERRORE] !BUILD_error!>> "!LOG_FILE!"
    del "release\.tmp\a1_build_result.txt" 2>nul
    if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
    pause & exit /b 0
)

echo  [OK] !BUILD_type!: !BUILD_files! file inclusi, !BUILD_deleted! file eliminati
echo [OK] !BUILD_type!: !BUILD_files! file, !BUILD_deleted! eliminati>> "!LOG_FILE!"
echo  [OK] manifest.json generato (type: !BUILD_type!)

REM Log file list dettagliato
node -e "var r=JSON.parse(require('fs').readFileSync('release/.tmp/a1_build_result.txt','utf8'));var fs=require('fs');var log='';if(r.fileList)log+='\n[DELTA FILES]\n'+r.fileList;if(r.deletedList)log+='\n[DELETED FILES]\n'+r.deletedList;if(log)fs.appendFileSync('!LOG_FILE!',log+'\n');" 2>nul
del "release\.tmp\a1_build_result.txt" 2>nul

REM ================================================================
REM  Crea ZIP da staging dir
REM ================================================================
echo.
echo  Creazione ZIP: !ZIP_NAME!

powershell -NoProfile -ExecutionPolicy Bypass -Command "try{Set-Location '!CD!';$td='.release-staging';if(-not(Test-Path $td)){throw 'Staging dir non trovata: '+$td};$fc=(Get-ChildItem -Path $td -Recurse -File).Count;Compress-Archive -Path \"$td\*\" -DestinationPath '!ZIP_NAME!' -Force;$sz=[math]::Round((Get-Item '!ZIP_NAME!').Length/1MB,2);Write-Host('  Zip creato: !ZIP_NAME! - '+$sz+' MB - '+$fc+' file')}catch{Write-Host('  ERRORE PowerShell: '+$_.Exception.Message);exit 1}"

if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

if not exist "!ZIP_NAME!" (
    echo  [ERRORE] Creazione zip fallita.
    echo  [INFO] Nessun file modificato - annullamento pulito.
    echo [ERRORE] Creazione zip fallita>> "!LOG_FILE!"
    pause & exit /b 0
)

REM Calcola dimensione ZIP
for %%A in ("!ZIP_NAME!") do set "ZIP_BYTES=%%~zA"
node -e "process.stdout.write(String(Math.round(!ZIP_BYTES!/1048576)))" > "%TEMP%\a1_zipsize.txt" 2>nul
set /p ZIP_SIZE_MB=<"%TEMP%\a1_zipsize.txt"
del "%TEMP%\a1_zipsize.txt" 2>nul
if "!ZIP_SIZE_MB!"=="" set "ZIP_SIZE_MB=0"

echo  [OK] ZIP: !ZIP_SIZE_MB! MB (!BUILD_type!)
echo [OK] ZIP creato: !ZIP_SIZE_MB! MB (!BUILD_type!)>> "!LOG_FILE!"

echo.
set /p "CONFIRM_BUMP=  Build e ZIP OK. Proseguo con il version bump e commit? (s/n): "
if /i not "!CONFIRM_BUMP!"=="s" goto :abort_cleanup

REM ================================================================
REM  STEP 4b - Version bump (ORA che build e zip sono OK)
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 4b: Version bump
echo  ----------------------------------------
echo.

REM -- Aggiorna badge versione nei file sorgente UI --
node -e "var fs=require('fs');function toDisplay(v){var a=v.match(/^(\d+\.\d+\.\d+)-alpha/);var b=v.match(/^(\d+\.\d+\.\d+)-beta/);var s=v.match(/^(\d+\.\d+\.\d+)$/);if(a)return 'Alpha '+a[1];if(b)return 'Beta '+b[1];if(s)return 'v'+s[1];return v.charAt(0).toUpperCase()+v.slice(1)}var oldL=toDisplay('!CURRENT_VERSION!');var newL=toDisplay('!NEW_VERSION!');if(oldL===newL){process.stdout.write('  [INFO] Badge gia aggiornato ('+newL+')\n');process.exit(0)}var files=['src/app/credits/page.tsx','src/components/settings/CreditsModal.tsx'];var re=new RegExp('(>\\s*)'+oldL.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\s*<)','g');var updated=0;files.forEach(function(f){if(fs.existsSync(f)===false)return;var c=fs.readFileSync(f,'utf8');var n=c.replace(re,'$1'+newL+'$2');if(n!==c){fs.writeFileSync(f,n);updated++;process.stdout.write('  [OK] Badge aggiornato: '+f+'\n')}});if(updated===0)process.stdout.write('  [AVVISO] Nessun badge trovato - aggiornamento manuale necessario\n');" 2>nul

REM -- Aggiorna package.json --
node -e "var fs=require('fs');var p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='!NEW_VERSION!';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
echo  [OK] package.json aggiornato a v!NEW_VERSION!
echo [OK] package.json aggiornato>> "!LOG_FILE!"

REM -- Aggiorna start scripts --
if exist "start.bat" (
    node -e "var fs=require('fs');var c=fs.readFileSync('start.bat','utf8');c=c.replace(/v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)*/,'v!NEW_VERSION!');fs.writeFileSync('start.bat',c);"
    echo  [OK] start.bat aggiornato
)
if exist "start.sh" (
    node -e "var fs=require('fs');var c=fs.readFileSync('start.sh','utf8');c=c.replace(/v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)*/,'v!NEW_VERSION!');fs.writeFileSync('start.sh',c);"
    echo  [OK] start.sh aggiornato
)

echo  [OK] Version bump completato
echo [OK] Version bump a v!NEW_VERSION!>> "!LOG_FILE!"

REM ================================================================
REM  STEP 5 - Git commit + tag + push
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 5: Git commit + tag + push
echo  ----------------------------------------
echo.
echo  File modificati:
git status --short
echo.

set /p "CONFIRM_COMMIT=  Confermi commit e push? (s/n): "
if /i not "!CONFIRM_COMMIT!"=="s" goto :abort_cleanup

git add package.json start.bat start.sh src/app/credits/page.tsx src/components/settings/CreditsModal.tsx 2>nul
git commit -m "release: v!NEW_VERSION!" 2>nul
echo  [OK] Commit creato

REM -- Create git tag --
git tag -d "v!NEW_VERSION!" 2>nul
git tag "v!NEW_VERSION!" 2>nul
echo  [OK] Tag v!NEW_VERSION! creato

REM -- Push con auto-upstream --
echo  Pushing...
git push --set-upstream origin main 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [AVVISO] Push con upstream fallito, provo push normale...
    git push 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [ATTENZIONE] Push fallito.
        set /p "FORCE_PUSH=  Fare force push? (s/n): "
        if /i "!FORCE_PUSH!"=="s" (
            git push --set-upstream origin main --force 2>nul
        ) else (
            echo  Push saltato.
        )
    )
)

REM Push tag separatamente
git push origin "v!NEW_VERSION!" 2>nul
echo  [OK] Push completato
echo [OK] Commit + tag + push>> "!LOG_FILE!"
echo.

REM ================================================================
REM  STEP 6 - Release notes
REM ================================================================
echo  ----------------------------------------
echo   STEP 6: Release notes
echo  ----------------------------------------
echo.
echo  Genero release notes...

node -e "var fs=require('fs');try{var c=fs.readFileSync('CHANGELOG.md','utf8');var m=c.match(/## \[Unreleased\][\s\S]*?\n([\s\S]*?)(?=\n## \[|$)/);fs.writeFileSync('release/release-notes.tmp',m&&m[1]?m[1].trim():'Release v!NEW_VERSION!')}catch(e){fs.writeFileSync('release/release-notes.tmp','Release v!NEW_VERSION!')}" 2>nul

if not exist "release\release-notes.tmp" (
    echo Release v!NEW_VERSION!> "release\release-notes.tmp"
)

echo  Apro Notepad - chiudi quando hai finito.
echo.

:edit_notes_loop
start /wait notepad "release\release-notes.tmp"

if not exist "release\release-notes.tmp" (
    echo  [AVVISO] File note cancellato. Ricreato.
    echo Release v!NEW_VERSION!> "release\release-notes.tmp"
)

echo  Anteprima:
echo  ----------------------------------------
set "LINE_COUNT=0"
for /f "usebackq tokens=* delims=" %%L in ("release\release-notes.tmp") do (
    set /a "LINE_COUNT+=1"
    if !LINE_COUNT! LEQ 5 echo  %%L
)
echo  ----------------------------------------
echo.

set /p "NOTES_OK=  Release notes OK? (s/n): "
if /i not "!NOTES_OK!"=="s" goto :edit_notes_loop

REM ================================================================
REM  STEP 7 - Pubblicazione su GitHub
REM ================================================================

:step7_summary
echo.
echo  ========================================
echo   RIEPILOGO PUBBLICAZIONE
echo  ========================================
echo.
echo  Versione:     v!NEW_VERSION!
echo  Tipo:         !BUILD_type!
echo  Repository:   valsecchi75/agent1-platform
echo  Tag:          v!NEW_VERSION!

if "!DRY_RUN!"=="1" (
    echo  Zip:          [non creato - dry run]
    echo.
    echo  ========================================
    echo.
    echo  [DRY RUN] Nessuna pubblicazione effettuata.
    echo  Comando:
    echo  gh release create "v!NEW_VERSION!" "!ZIP_NAME!" --title "AGENT 1 v!NEW_VERSION!" --notes-file "release/release-notes.tmp" --repo valsecchi75/agent1-platform
    echo.
    pause & exit /b 0
)

echo  Zip:          !ZIP_NAME! (!ZIP_SIZE_MB! MB)
echo.
echo  Release notes:
echo  ----------------------------------------
set "PREVIEW_COUNT=0"
for /f "usebackq tokens=* delims=" %%L in ("release\release-notes.tmp") do (
    set /a "PREVIEW_COUNT+=1"
    if !PREVIEW_COUNT! LEQ 3 echo  %%L
)
echo  ----------------------------------------
echo.
echo  ========================================
echo.

set /p "CONFIRM_PUBLISH=  Pubblico la release? (s/n): "
if /i not "!CONFIRM_PUBLISH!"=="s" (
    echo.
    echo  Pubblicazione annullata.
    echo  Modifiche locali mantenute. Rilancia publish.bat per riprovare.
    goto :final_cleanup
)

echo.
echo  Pubblico su GitHub...
echo [INFO] gh release create v!NEW_VERSION!>> "!LOG_FILE!"

gh release create "v!NEW_VERSION!" "!ZIP_NAME!" --title "AGENT 1 v!NEW_VERSION!" --notes-file "release/release-notes.tmp" --repo valsecchi75/agent1-platform
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [ERRORE] Pubblicazione fallita.
    echo  [INFO] Verifica:
    echo    1. gh auth status
    echo    2. Connessione internet
    echo    3. Il tag v!NEW_VERSION! non esista gia come release
    echo.
    echo  Per riprovare SOLO la pubblicazione:
    echo    gh release create "v!NEW_VERSION!" "!ZIP_NAME!" --title "AGENT 1 v!NEW_VERSION!" --notes-file "release/release-notes.tmp" --repo valsecchi75/agent1-platform
    echo.
    echo [ERRORE] gh release create fallito>> "!LOG_FILE!"
    pause & exit /b 1
)

echo.
echo  ========================================
echo   Release v!NEW_VERSION! pubblicata!
echo  ========================================
echo.
echo  URL: https://github.com/valsecchi75/agent1-platform/releases/tag/v!NEW_VERSION!
echo.
echo [OK] Release v!NEW_VERSION! pubblicata>> "!LOG_FILE!"

REM ================================================================
REM  STEP 8 - Candidate Release ZIP (clean, senza DB/dati)
REM  Usa script esterno build-candidate.js
REM ================================================================
echo  ----------------------------------------
echo   STEP 8: Candidate Release ZIP
echo  ----------------------------------------
echo.

set "CANDIDATE_DIR=..\Candidate Release"
set "CANDIDATE_ZIP=!CANDIDATE_DIR!\agent1-candidate-v!NEW_VERSION!.zip"
set "CANDIDATE_STAGING=.candidate-staging"

if exist "!CANDIDATE_STAGING!" rmdir /s /q "!CANDIDATE_STAGING!" 2>nul
if not exist "!CANDIDATE_DIR!" mkdir "!CANDIDATE_DIR!" 2>nul

echo  Creo staging pulito (esclusi: storage, .db, .env, Token.txt)...

node release/build-candidate.js "!NEW_VERSION!" "!PREVIOUS_VERSION!"

if !ERRORLEVEL! NEQ 0 (
    echo  [AVVISO] Staging Candidate fallito - ZIP non creato
    echo [AVVISO] Candidate staging fallito>> "!LOG_FILE!"
    goto :after_candidate
)

if exist "!CANDIDATE_ZIP!" del "!CANDIDATE_ZIP!" 2>nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try{Set-Location '!CD!';$td='.candidate-staging';if(-not(Test-Path $td)){throw 'Candidate staging non trovata'};Compress-Archive -Path \"$td\*\" -DestinationPath '!CANDIDATE_ZIP!' -Force;$sz=[math]::Round((Get-Item '!CANDIDATE_ZIP!').Length/1MB,2);Write-Host('  [OK] Candidate: agent1-candidate-v!NEW_VERSION!.zip ('+$sz+' MB)')}catch{Write-Host('  [AVVISO] Candidate ZIP fallito: '+$_.Exception.Message);exit 1}"

if not exist "!CANDIDATE_ZIP!" (
    echo  [AVVISO] Candidate ZIP non creato
    echo [AVVISO] Candidate ZIP non creato>> "!LOG_FILE!"
) else (
    echo  [OK] Salvato in: Candidate Release\agent1-candidate-v!NEW_VERSION!.zip
    echo [OK] Candidate Release ZIP creato>> "!LOG_FILE!"
)

:after_candidate
if exist "!CANDIDATE_STAGING!" rmdir /s /q "!CANDIDATE_STAGING!" 2>nul
echo.
goto :final_cleanup

:abort_cleanup
echo.
echo  Operazione annullata.
echo [INFO] Operazione annullata dall'utente>> "!LOG_FILE!"
if exist "release\release-notes.tmp" del "release\release-notes.tmp" 2>nul
if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
if exist ".candidate-staging" rmdir /s /q ".candidate-staging" 2>nul

REM -- Verifica se il bump era gia avvenuto --
node -p "require('./package.json').version" > "%TEMP%\a1_curver.txt" 2>nul
set /p ABORT_VER=<"%TEMP%\a1_curver.txt"
del "%TEMP%\a1_curver.txt" 2>nul
if not "!ABORT_VER!"=="!CURRENT_VERSION!" (
    echo  [AVVISO] package.json e' stato modificato (v!ABORT_VER!).
    echo  Per annullare il bump:
    echo    git checkout package.json start.bat start.sh src/app/credits/page.tsx src/components/settings/CreditsModal.tsx
) else (
    echo  [OK] Nessun file modificato - annullamento pulito.
)
echo.
pause
exit /b 0

:final_cleanup
if exist "release\release-notes.tmp" del "release\release-notes.tmp" 2>nul
if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
if exist ".candidate-staging" rmdir /s /q ".candidate-staging" 2>nul

REM -- Prune old logs (keep last 20) --
node -e "var fs=require('fs'),p=require('path'),d='release/logs';try{var ls=fs.readdirSync(d).filter(function(f){return f.startsWith('publish-')&&f.endsWith('.log')}).sort().reverse();for(var i=20;i<ls.length;i++){try{fs.unlinkSync(p.join(d,ls[i]))}catch(e){}}}catch(e){}" 2>nul

echo [INFO] Cleanup completato>> "!LOG_FILE!"
pause
exit /b 0
