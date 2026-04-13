@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
color 0F
title AGENT 1 - Release Publisher

echo.
echo  ========================================
echo   AGENT 1 - Release Publisher
echo   GitHub: Delta  /  Candidate: Full
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
    echo  [ERROR] Node.js not found. Install from https://nodejs.org
    echo [ERROR] Node.js not found>> "!LOG_FILE!"
    pause & exit /b 1
)
where git >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] Git not found. Install from https://git-scm.com
    echo [ERROR] Git not found>> "!LOG_FILE!"
    pause & exit /b 1
)
where gh >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] GitHub CLI not found. Install from https://cli.github.com
    echo [ERROR] GitHub CLI not found>> "!LOG_FILE!"
    pause & exit /b 1
)
gh auth status >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] GitHub CLI not authenticated. Run: gh auth login
    echo [ERROR] GitHub CLI not authenticated>> "!LOG_FILE!"
    pause & exit /b 1
)

REM Leggi versione con file temp
node -p "require('./package.json').version" > "%TEMP%\a1_ver.txt" 2>nul
set /p CURRENT_VERSION=<"%TEMP%\a1_ver.txt"
del "%TEMP%\a1_ver.txt" 2>nul

if "!CURRENT_VERSION!"=="" (
    echo  [ERROR] Unable to read version from package.json.
    pause & exit /b 1
)
echo  Versione corrente: !CURRENT_VERSION!
echo [INFO] Versione corrente: !CURRENT_VERSION!>> "!LOG_FILE!"
echo.

REM -- Flags --
set "DRY_RUN=0"
if "%~1"=="--dry-run" set "DRY_RUN=1"

if "!DRY_RUN!"=="1" (
    echo  =========================================
    echo   DRY RUN - no real actions
    echo  =========================================
    echo.
)

REM -- Detect phase --
node -p "const v='!CURRENT_VERSION!';v.includes('-alpha')?'alpha':v.includes('-beta')?'beta':'stable'" > "%TEMP%\a1_phase.txt" 2>nul
set /p PHASE=<"%TEMP%\a1_phase.txt"
del "%TEMP%\a1_phase.txt" 2>nul
if "!PHASE!"=="" set "PHASE=stable"

REM ================================================================
REM  STEP 2 - Choose bump type (CALCULATION ONLY, no writes)
REM ================================================================

if "!PHASE!"=="alpha" goto :menu_alpha
if "!PHASE!"=="beta"  goto :menu_beta
goto :menu_stable

:menu_alpha
echo  Phase: ALPHA
echo.
echo  Choose release type:
echo    [a] Alpha patch    0.9.x-alpha -- 0.9.y-alpha
echo    [b] Promote to Beta          -- 1.0.0-beta
echo    [r] Final release            -- 1.0.0
echo.
set /p "BUMP=  Choice: "
if /i "!BUMP!"=="a" goto :calc_version
if /i "!BUMP!"=="b" goto :calc_version
if /i "!BUMP!"=="r" goto :calc_version
echo  [ERROR] Invalid choice. Use: a, b, r
pause & exit /b 1

:menu_beta
echo  Phase: BETA
echo.
echo  Choose release type:
echo    [b] Beta patch     1.0.0-beta.x -- 1.0.0-beta.y
echo    [r] Final release              -- 1.0.0
echo.
set /p "BUMP=  Choice: "
if /i "!BUMP!"=="b" goto :calc_version
if /i "!BUMP!"=="r" goto :calc_version
echo  [ERROR] Invalid choice. Use: b, r
pause & exit /b 1

:menu_stable
echo  Phase: STABLE
echo.
echo  Choose release type:
echo    [p] Patch   (bug fix)
echo    [m] Minor   (new features)
echo    [M] Major   (breaking changes)
echo.
set /p "BUMP=  Choice: "
if "!BUMP!"=="p" goto :calc_version
if "!BUMP!"=="m" goto :calc_version
if "!BUMP!"=="M" goto :calc_version
echo  [ERROR] Invalid choice. Use: p, m, M
pause & exit /b 1

:calc_version
node -e "var v='!CURRENT_VERSION!',b='!BUMP!',ph='!PHASE!',nv;if(ph==='alpha'){if(b==='a'){var p=v.match(/^(\d+)\.(\d+)\.(\d+)/);nv=p[1]+'.'+p[2]+'.'+(parseInt(p[3])+1)+'-alpha'}else if(b==='b'){nv='1.0.0-beta'}else if(b==='r'){nv='1.0.0'}}else if(ph==='beta'){if(b==='b'){var m=v.match(/beta\.?(\d*)/);var n=m&&m[1]?parseInt(m[1])+1:1;nv='1.0.0-beta.'+n}else if(b==='r'){nv='1.0.0'}}else{var p=v.match(/^(\d+)\.(\d+)\.(\d+)/);var ma=parseInt(p[1]),mi=parseInt(p[2]),pa=parseInt(p[3]);if(b==='p')nv=ma+'.'+mi+'.'+(pa+1);else if(b==='m')nv=ma+'.'+(mi+1)+'.0';else if(b==='M')nv=(ma+1)+'.0.0'}process.stdout.write(nv||'ERROR')" > "%TEMP%\a1_newver.txt" 2>nul
set /p NEW_VERSION=<"%TEMP%\a1_newver.txt"
del "%TEMP%\a1_newver.txt" 2>nul

if "!NEW_VERSION!"=="ERROR" (
    echo  [ERROR] Version calculation failed.
    pause & exit /b 1
)
if "!NEW_VERSION!"=="" (
    echo  [ERROR] Version calculation failed.
    pause & exit /b 1
)

echo.
echo  Suggested version: !NEW_VERSION!
echo.
set /p "OVERRIDE_VERSION=  Press ENTER to confirm, or type a different version: "
if not "!OVERRIDE_VERSION!"=="" set "NEW_VERSION=!OVERRIDE_VERSION!"
echo  [OK] Final version: !NEW_VERSION!
echo [INFO] Final version: !NEW_VERSION!>> "!LOG_FILE!"
echo.

REM -- ZIP_NAME --
set "ZIP_NAME=agent1-v!NEW_VERSION!.zip"

REM -- Dry run skips step 3-6 --
if "!DRY_RUN!"=="1" goto :step7_summary

REM ================================================================
REM  STEP 2b - Auto-commit pending changes (GR-007)
REM  git diff compares commits, not working tree.
REM  If there are uncommitted files, commit them now.
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 2b: Check uncommitted changes
echo  ----------------------------------------
echo.

git diff --quiet --exit-code >nul 2>nul
set "HAS_UNSTAGED=!ERRORLEVEL!"
git diff --quiet --cached --exit-code >nul 2>nul
set "HAS_STAGED=!ERRORLEVEL!"

REM Check for untracked files too
for /f %%i in ('git ls-files --others --exclude-standard ^| find /c /v ""') do set "UNTRACKED_COUNT=%%i"

if !HAS_UNSTAGED! EQU 0 if !HAS_STAGED! EQU 0 if !UNTRACKED_COUNT! EQU 0 (
    echo  [OK] No pending changes.
    echo [OK] Clean working tree>> "!LOG_FILE!"
    goto :step3_build
)

echo  Found uncommitted changes:
git status --short
echo.
set /p "AUTO_COMMIT=  Auto-commit before release? (y/n): "
if /i "!AUTO_COMMIT!"=="n" (
    echo  [WARNING] Proceeding without commit. Delta may not include latest changes.
    echo [WARN] User chose not to commit>> "!LOG_FILE!"
    goto :step3_build
)

git add -A
git commit -m "chore: pre-release changes for v!NEW_VERSION!"
if !ERRORLEVEL! EQU 0 (
    echo  [OK] Changes auto-committed.
    echo [OK] Auto-commit pre-release>> "!LOG_FILE!"
) else (
    echo  [WARNING] Commit failed. Proceeding anyway.
    echo [WARN] Auto-commit failed>> "!LOG_FILE!"
)

:step3_build

REM ================================================================
REM  STEP 3 - Verification build
REM  (BEFORE version bump — if fails, nothing modified)
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 3: Verification build
echo  ----------------------------------------
echo.
call npm run build
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] Build failed.
    echo [ERROR] Build failed>> "!LOG_FILE!"
    set /p "BUILD_CHOICE=  Abort or continue anyway? (a/c): "
    if /i "!BUILD_CHOICE!"=="a" (
        echo  No files modified - clean abort.
        echo [INFO] Aborted before bump - no rollback needed>> "!LOG_FILE!"
        pause & exit /b 0
    )
    echo  [WARNING] Continuing despite build failure.
) else (
    echo  [OK] Build succeeded
    echo [OK] Build succeeded>> "!LOG_FILE!"
)

REM ================================================================
REM  STEP 4 - Delta detection + Zip creation
REM  (BEFORE version bump — if fails, nothing modified)
REM  Uses external script to avoid escape and CLI length issues
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 4: Delta detection + Zip creation
echo  ----------------------------------------
echo.

if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
if not exist "release\.tmp" mkdir "release\.tmp" 2>nul

if not exist "release\.releaseinclude" (
    echo  [ERROR] release\.releaseinclude not found.
    pause & exit /b 1
)

REM -- Detect last release tag --
set "LAST_TAG="
set "RELEASE_TYPE=full"
set "PREVIOUS_VERSION=none"

REM -- GitHub riceve SEMPRE delta (solo file modificati dall'ultimo tag) --
for /f "delims=" %%t in ('git tag --list "v*" --sort=-version:refname 2^>nul') do (
    if "!LAST_TAG!"=="" set "LAST_TAG=%%t"
)

if "!LAST_TAG!"=="" (
    echo  [INFO] No previous tag. Creating FULL release.
    echo [INFO] No tag - FULL release>> "!LOG_FILE!"
    set "RELEASE_TYPE=full"
) else (
    echo  [INFO] Last tag: !LAST_TAG! - Creating DELTA release.
    echo [INFO] Last tag: !LAST_TAG! - DELTA>> "!LOG_FILE!"
    set "RELEASE_TYPE=delta"
    set "PREVIOUS_VERSION=!LAST_TAG:~1!"
)

REM ================================================================
REM  Delegate staging creation to build-staging.js (external script)
REM ================================================================

node release/build-staging.js "!RELEASE_TYPE!" "!NEW_VERSION!" "!PREVIOUS_VERSION!" "!LAST_TAG!"

if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] build-staging.js returned error.
    echo [ERROR] build-staging.js failed>> "!LOG_FILE!"
)

REM Leggi risultato da Node
if not exist "release\.tmp\a1_build_result.txt" (
    echo  [ERROR] Delta detection failed - no result from build-staging.js.
    echo  [INFO] No files modified - clean abort.
    echo [ERROR] Delta detection failed>> "!LOG_FILE!"
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
    echo  [INFO] No files changed since !LAST_TAG!. Nothing to release.
    echo [INFO] No files modified - clean abort>> "!LOG_FILE!"
    del "release\.tmp\a1_build_result.txt" 2>nul
    if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
    pause & exit /b 0
)
if not "!BUILD_error!"=="none" (
    echo  [ERROR] Delta detection: !BUILD_error!
    echo  [INFO] No files modified - clean abort.
    echo [ERROR] !BUILD_error!>> "!LOG_FILE!"
    del "release\.tmp\a1_build_result.txt" 2>nul
    if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
    pause & exit /b 0
)

echo  [OK] !BUILD_type!: !BUILD_files! files included, !BUILD_deleted! files deleted
echo [OK] !BUILD_type!: !BUILD_files! files, !BUILD_deleted! deleted>> "!LOG_FILE!"
echo  [OK] manifest.json generated (type: !BUILD_type!)

REM Log file list dettagliato
node -e "var r=JSON.parse(require('fs').readFileSync('release/.tmp/a1_build_result.txt','utf8'));var fs=require('fs');var log='';if(r.fileList)log+='\n[DELTA FILES]\n'+r.fileList;if(r.deletedList)log+='\n[DELETED FILES]\n'+r.deletedList;if(log)fs.appendFileSync('!LOG_FILE!',log+'\n');" 2>nul
del "release\.tmp\a1_build_result.txt" 2>nul

REM ================================================================
REM  Create ZIP from staging dir
REM ================================================================
echo.
echo  Creating ZIP: !ZIP_NAME!

powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$root='!CD!';$td=Join-Path $root '.release-staging';$zip=Join-Path $root '!ZIP_NAME!';if(-not(Test-Path $td)){throw 'Staging dir not found: '+$td};$fc=(Get-ChildItem -Path $td -Recurse -File).Count;Push-Location $td;Compress-Archive -Path '*' -DestinationPath $zip -Force;Pop-Location;$sz=[math]::Round((Get-Item $zip).Length/1MB,2);Write-Host('  Zip created: !ZIP_NAME! - '+$sz+' MB - '+$fc+' files')}catch{Write-Host('  PowerShell ERROR: '+$_.Exception.Message);exit 1}"

if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

if not exist "!ZIP_NAME!" (
    echo  [ERROR] Zip creation failed.
    echo  [INFO] No files modified - clean abort.
    echo [ERROR] Zip creation failed>> "!LOG_FILE!"
    pause & exit /b 0
)

REM Calcola dimensione ZIP
for %%A in ("!ZIP_NAME!") do set "ZIP_BYTES=%%~zA"
node -e "process.stdout.write(String(Math.round(!ZIP_BYTES!/1048576)))" > "%TEMP%\a1_zipsize.txt" 2>nul
set /p ZIP_SIZE_MB=<"%TEMP%\a1_zipsize.txt"
del "%TEMP%\a1_zipsize.txt" 2>nul
if "!ZIP_SIZE_MB!"=="" set "ZIP_SIZE_MB=0"

echo  [OK] ZIP: !ZIP_SIZE_MB! MB (!BUILD_type!)
echo [OK] ZIP created: !ZIP_SIZE_MB! MB (!BUILD_type!)>> "!LOG_FILE!"

echo.
set /p "CONFIRM_BUMP=  Build and ZIP OK. Continue with version bump and commit? (y/n): "
if /i not "!CONFIRM_BUMP!"=="y" goto :abort_cleanup

REM ================================================================
REM  STEP 4b - Version bump (NOW that build and zip are OK)
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 4b: Version bump
echo  ----------------------------------------
echo.

REM -- Update version badge in UI source files --
node -e "var fs=require('fs');function toDisplay(v){var a=v.match(/^(\d+\.\d+\.\d+)-alpha/);var b=v.match(/^(\d+\.\d+\.\d+)-beta/);var s=v.match(/^(\d+\.\d+\.\d+)$/);if(a)return 'Alpha '+a[1];if(b)return 'Beta '+b[1];if(s)return 'v'+s[1];return v.charAt(0).toUpperCase()+v.slice(1)}var oldL=toDisplay('!CURRENT_VERSION!');var newL=toDisplay('!NEW_VERSION!');if(oldL===newL){process.stdout.write('  [INFO] Badge already updated ('+newL+')\n');process.exit(0)}var files=['src/app/credits/page.tsx','src/components/settings/CreditsModal.tsx'];var re=new RegExp('(>\\s*)'+oldL.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\s*<)','g');var updated=0;files.forEach(function(f){if(fs.existsSync(f)===false)return;var c=fs.readFileSync(f,'utf8');var n=c.replace(re,'$1'+newL+'$2');if(n!==c){fs.writeFileSync(f,n);updated++;process.stdout.write('  [OK] Badge updated: '+f+'\n')}});if(updated===0)process.stdout.write('  [WARNING] No badge found - manual update required\n');" 2>nul

REM -- Update package.json --
node -e "var fs=require('fs');var p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='!NEW_VERSION!';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
echo  [OK] package.json updated to v!NEW_VERSION!
echo [OK] package.json updated>> "!LOG_FILE!"

REM -- Update start scripts --
if exist "start.bat" (
    node -e "var fs=require('fs');var c=fs.readFileSync('start.bat','utf8');c=c.replace(/v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)*/,'v!NEW_VERSION!');fs.writeFileSync('start.bat',c);"
    echo  [OK] start.bat updated
)
if exist "start.sh" (
    node -e "var fs=require('fs');var c=fs.readFileSync('start.sh','utf8');c=c.replace(/v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)*/,'v!NEW_VERSION!');fs.writeFileSync('start.sh',c);"
    echo  [OK] start.sh updated
)

echo  [OK] Version bump completed
echo [OK] Version bump to v!NEW_VERSION!>> "!LOG_FILE!"

REM ================================================================
REM  STEP 5 - Git commit + tag + push
REM ================================================================
echo.
echo  ----------------------------------------
echo   STEP 5: Git commit + tag + push
echo  ----------------------------------------
echo.
echo  Modified files:
git status --short
echo.

set /p "CONFIRM_COMMIT=  Confirm commit and push? (y/n): "
if /i not "!CONFIRM_COMMIT!"=="y" goto :abort_cleanup

git add package.json start.bat start.sh src/app/credits/page.tsx src/components/settings/CreditsModal.tsx 2>nul
git commit -m "release: v!NEW_VERSION!" 2>nul
echo  [OK] Commit creato

REM -- Create git tag --
git tag -d "v!NEW_VERSION!" 2>nul
git tag "v!NEW_VERSION!" 2>nul
echo  [OK] Tag v!NEW_VERSION! creato

REM -- Push con auto-upstream --
echo  Pushing...
git push origin master:main 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo  [WARNING] Push failed, trying with force...
    set /p "FORCE_PUSH=  Do force push? (y/n): "
    if /i "!FORCE_PUSH!"=="y" (
        git push origin master:main --force 2>nul
    ) else (
        echo  Push skipped.
    )
)

REM Push tag separatamente
git push origin "v!NEW_VERSION!" 2>nul
echo  [OK] Push completed
echo [OK] Commit + tag + push>> "!LOG_FILE!"
echo.

REM ================================================================
REM  STEP 6 - Release notes
REM ================================================================
echo  ----------------------------------------
echo   STEP 6: Release notes
echo  ----------------------------------------
echo.
echo  Generating release notes...

node -e "var fs=require('fs');try{var c=fs.readFileSync('CHANGELOG.md','utf8');var m=c.match(/## \[Unreleased\][\s\S]*?\n([\s\S]*?)(?=\n## \[|$)/);fs.writeFileSync('release/release-notes.tmp',m&&m[1]?m[1].trim():'Release v!NEW_VERSION!')}catch(e){fs.writeFileSync('release/release-notes.tmp','Release v!NEW_VERSION!')}" 2>nul

if not exist "release\release-notes.tmp" (
    echo Release v!NEW_VERSION!> "release\release-notes.tmp"
)

echo  Opening Notepad - close when done.
echo.

:edit_notes_loop
start /wait notepad "release\release-notes.tmp"

if not exist "release\release-notes.tmp" (
    echo  [WARNING] Notes file deleted. Recreated.
    echo Release v!NEW_VERSION!> "release\release-notes.tmp"
)

echo  Preview:
echo  ----------------------------------------
set "LINE_COUNT=0"
for /f "usebackq tokens=* delims=" %%L in ("release\release-notes.tmp") do (
    set /a "LINE_COUNT+=1"
    if !LINE_COUNT! LEQ 5 echo  %%L
)
echo  ----------------------------------------
echo.

set /p "NOTES_OK=  Release notes OK? (y/n): "
if /i not "!NOTES_OK!"=="y" goto :edit_notes_loop

REM ================================================================
REM  STEP 7 - Pubblicazione su GitHub
REM ================================================================

:step7_summary
echo.
echo  ========================================
echo   PUBLICATION SUMMARY
echo  ========================================
echo.
echo  Version:      v!NEW_VERSION!
echo  Type:         !BUILD_type!
echo  Repository:   valsecchi75/agent1-platform
echo  Tag:          v!NEW_VERSION!

if "!DRY_RUN!"=="1" (
    echo  Zip:          [not created - dry run]
    echo.
    echo  ========================================
    echo.
    echo  [DRY RUN] No publication performed.
    echo  Command:
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

set /p "CONFIRM_PUBLISH=  Publish the release? (y/n): "
if /i not "!CONFIRM_PUBLISH!"=="y" (
    echo.
    echo  Publication cancelled.
    echo  Local changes retained. Rerun publish.bat to retry.
    goto :final_cleanup
)

echo.
echo  Publishing on GitHub...
echo [INFO] gh release create v!NEW_VERSION!>> "!LOG_FILE!"

gh release create "v!NEW_VERSION!" "!ZIP_NAME!" --title "AGENT 1 v!NEW_VERSION!" --notes-file "release/release-notes.tmp" --repo valsecchi75/agent1-platform
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  [ERROR] Publication failed.
    echo  [INFO] Check:
    echo    1. gh auth status
    echo    2. Internet connection
    echo    3. Tag v!NEW_VERSION! doesn't already exist as release
    echo.
    echo  To retry ONLY the publication:
    echo    gh release create "v!NEW_VERSION!" "!ZIP_NAME!" --title "AGENT 1 v!NEW_VERSION!" --notes-file "release/release-notes.tmp" --repo valsecchi75/agent1-platform
    echo.
    echo [ERROR] gh release create failed>> "!LOG_FILE!"
    pause & exit /b 1
)

echo.
echo  ========================================
echo   Release v!NEW_VERSION! published!
echo  ========================================
echo.
echo  URL: https://github.com/valsecchi75/agent1-platform/releases/tag/v!NEW_VERSION!
echo.
echo [OK] Release v!NEW_VERSION! published>> "!LOG_FILE!"

REM ================================================================
REM  STEP 8 - Candidate Release ZIP (clean, no DB/data)
REM  Uses external script build-candidate.js
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

echo  Creating clean staging (excluded: storage, .db, .env, Token.txt)...

node release/build-candidate.js "!NEW_VERSION!" "!PREVIOUS_VERSION!"

if !ERRORLEVEL! NEQ 0 (
    echo  [WARNING] Candidate staging failed - ZIP not created
    echo [WARNING] Candidate staging failed>> "!LOG_FILE!"
    goto :after_candidate
)

if exist "!CANDIDATE_ZIP!" del "!CANDIDATE_ZIP!" 2>nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "try{Set-Location '!CD!';$td='.candidate-staging';if(-not(Test-Path $td)){throw 'Candidate staging not found'};Compress-Archive -Path \"$td\*\" -DestinationPath '!CANDIDATE_ZIP!' -Force;$sz=[math]::Round((Get-Item '!CANDIDATE_ZIP!').Length/1MB,2);Write-Host('  [OK] Candidate: agent1-candidate-v!NEW_VERSION!.zip ('+$sz+' MB)')}catch{Write-Host('  [WARNING] Candidate ZIP failed: '+$_.Exception.Message);exit 1}"

if not exist "!CANDIDATE_ZIP!" (
    echo  [WARNING] Candidate ZIP not created
    echo [WARNING] Candidate ZIP not created>> "!LOG_FILE!"
) else (
    echo  [OK] Saved in: Candidate Release\agent1-candidate-v!NEW_VERSION!.zip
    echo [OK] Candidate Release ZIP created>> "!LOG_FILE!"
)

:after_candidate
if exist "!CANDIDATE_STAGING!" rmdir /s /q "!CANDIDATE_STAGING!" 2>nul
echo.
goto :final_cleanup

:abort_cleanup
echo.
echo  Operation cancelled.
echo [INFO] Operation cancelled by user>> "!LOG_FILE!"
if exist "release\release-notes.tmp" del "release\release-notes.tmp" 2>nul
if exist "!ZIP_NAME!" del "!ZIP_NAME!" 2>nul
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul
if exist ".candidate-staging" rmdir /s /q ".candidate-staging" 2>nul

REM -- Check if bump already happened --
node -p "require('./package.json').version" > "%TEMP%\a1_curver.txt" 2>nul
set /p ABORT_VER=<"%TEMP%\a1_curver.txt"
del "%TEMP%\a1_curver.txt" 2>nul
if not "!ABORT_VER!"=="!CURRENT_VERSION!" (
    echo  [WARNING] package.json has been modified (v!ABORT_VER!).
    echo  To cancel the bump:
    echo    git checkout package.json start.bat start.sh src/app/credits/page.tsx src/components/settings/CreditsModal.tsx
) else (
    echo  [OK] No files modified - clean abort.
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

echo [INFO] Cleanup completed>> "!LOG_FILE!"
pause
exit /b 0
