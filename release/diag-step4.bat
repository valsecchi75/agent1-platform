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

REM Test scrittura file temp
node -e "var fs=require('fs');fs.writeFileSync(process.env.TEMP+'/a1_test.txt','ok');console.log('TEMP scrivibile: OK');"
if !ERRORLEVEL! NEQ 0 (
    echo  [ERRORE] Non riesco a scrivere in TEMP
) else (
    del "%TEMP%\a1_test.txt" 2>nul
)
echo.

REM Test fs.cpSync
node -e "var fs=require('fs');if(typeof fs.cpSync==='function'){console.log('fs.cpSync: DISPONIBILE')}else{console.log('fs.cpSync: NON DISPONIBILE - Node.js troppo vecchio (< 16.7)')}"
echo.

REM Test .releaseinclude
if exist "release\.releaseinclude" (
    echo  .releaseinclude: TROVATO
) else (
    echo  [ERRORE] .releaseinclude: NON TROVATO
)
echo.

REM Test git tags
echo  Git tags esistenti:
git tag --list "v*" --sort=-version:refname
echo  (vuoto = prima release FULL)
echo.

REM Simula creazione staging con output visibile
echo  Test creazione .release-staging...
if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

node -e "var fs=require('fs'),path=require('path');var RELEASE_TYPE='full',NEW_VERSION='test',PREV_VERSION='none';var result={type:'full',files:0,deleted:0,error:null};try{var wl=fs.readFileSync('release/.releaseinclude','utf8').split('\n').map(function(l){return l.trim()}).filter(function(l){return l&&!l.startsWith('#')});console.log('Whitelist items: '+wl.length);var td='.release-staging';if(fs.existsSync(td))fs.rmSync(td,{recursive:true,force:true});fs.mkdirSync(td,{recursive:true});console.log('Staging dir creata OK');wl.forEach(function(item){var clean=item.endsWith('/')?item.slice(0,-1):item;if(!fs.existsSync(clean)){console.log('  SKIP (non esiste): '+clean);return}var st=fs.statSync(clean);console.log('  Copia: '+clean+' ('+(st.isDirectory()?'dir':'file')+')');var dest=path.join(td,clean);fs.mkdirSync(path.dirname(dest),{recursive:true});if(st.isDirectory()){fs.cpSync(clean,dest,{recursive:true})}else{fs.copyFileSync(clean,dest)}});result.files=99;result.error=null}catch(e){result.error=e.message;console.log('ERRORE: '+e.message)}fs.writeFileSync(process.env.TEMP+'/a1_build_result.txt',JSON.stringify(result));console.log('File risultato scritto OK')"

echo.
if exist "%TEMP%\a1_build_result.txt" (
    echo  [OK] File risultato creato
    node -e "var r=JSON.parse(require('fs').readFileSync(process.env.TEMP+'/a1_build_result.txt','utf8'));console.log('  error: '+r.error)"
    del "%TEMP%\a1_build_result.txt" 2>nul
) else (
    echo  [ERRORE] File risultato NON creato - il processo Node e' crashato
)

if exist ".release-staging" rmdir /s /q ".release-staging" 2>nul

echo.
echo  ========================================
echo   Fine diagnostica
echo  ========================================
echo.
pause
