@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
color 0F
title AGENT 1 - Diagnosi STEP 4

echo.
echo  ========================================
echo   Diagnosi STEP 4 - Delta Detection
echo  ========================================
echo.

REM Versione Node.js
echo  Node.js:
node --version
echo.

REM Test TEMP
echo  TEMP path: %TEMP%
echo.

REM Test write to temp file
node -e "var fs=require('fs');fs.writeFileSync(process.env.TEMP+'/a1_test.txt','ok');console.log('TEMP writable: OK');"
if !ERRORLEVEL! NEQ 0 (
    echo  [ERROR] Cannot write to TEMP
) else (
    del "%TEMP%\a1_test.txt" 2>nul
)
echo.

REM Test fs.cpSync
node -e "var fs=require('fs');if(typeof fs.cpSync==='function'){console.log('fs.cpSync: AVAILABLE')}else{console.log('fs.cpSync: NOT AVAILABLE - Node.js too old (< 16.7)')}"
echo.

REM Test .releaseinclude
if exist "release\.releaseinclude" (
    echo  .releaseinclude: FOUND
) else (
    echo  [ERROR] .releaseinclude: NOT FOUND
)
echo.

REM Test git tags
echo  Git tags esistenti:
git tag --list "v*" --sort=-version:refname
echo  (vuoto = prima release FULL)
echo.

REM Simulate staging creation with visible output
echo  Test .release-staging creation...
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

node -e "var fs=require('fs'),path=require('path');var RELEASE_TYPE='full',NEW_VERSION='test',PREV_VERSION='none';var result={type:'full',files:0,deleted:0,error:null};try{var wl=fs.readFileSync('release/.releaseinclude','utf8').split('\n').map(function(l){return l.trim()}).filter(function(l){return l&&!l.startsWith('#')});console.log('Whitelist items: '+wl.length);var td='.release-staging';if(fs.existsSync(td))fs.rmSync(td,{recursive:true,force:true});fs.mkdirSync(td,{recursive:true});console.log('Staging dir created OK');wl.forEach(function(item){var clean=item.endsWith('/')?item.slice(0,-1):item;if(!fs.existsSync(clean)){console.log('  SKIP (does not exist): '+clean);return}var st=fs.statSync(clean);console.log('  Copy: '+clean+' ('+(st.isDirectory()?'dir':'file')+')');var dest=path.join(td,clean);fs.mkdirSync(path.dirname(dest),{recursive:true});if(st.isDirectory()){fs.cpSync(clean,dest,{recursive:true})}else{fs.copyFileSync(clean,dest)}});result.files=99;result.error=null}catch(e){result.error=e.message;console.log('ERROR: '+e.message)}fs.writeFileSync(process.env.TEMP+'/a1_build_result.txt',JSON.stringify(result));console.log('Result file written OK')"

echo.
if exist "%TEMP%\a1_build_result.txt" (
    echo  [OK] Result file created
    node -e "var r=JSON.parse(require('fs').readFileSync(process.env.TEMP+'/a1_build_result.txt','utf8'));console.log('  error: '+r.error)"
    del "%TEMP%\a1_build_result.txt" 2>nul
) else (
    echo  [ERROR] Result file NOT created - Node process crashed
)

if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

echo.
echo  ========================================
echo   End of diagnostics
echo  ========================================
echo.
pause
