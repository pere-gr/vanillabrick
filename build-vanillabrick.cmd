@echo off
setlocal enabledelayedexpansion

rem Paths
set "ROOT=%~dp0src"
set "OUT=%~dp0dist\vanillabrick.js"
set "TEMPLATE=%~dp0VanillaBrick.template.js"
set "TMP=%TEMP%\VanillaBrick_bundle.tmp"

rem Ensure output directory exists
if not exist "%~dp0dist" mkdir "%~dp0dist"

if not exist "%TEMPLATE%" (
  echo ERROR: Template file not found: "%TEMPLATE%"
  exit /b 1
)

rem Build bundle into temp (only subfolder JS files)
> "%TMP%" type nul

rem Append every other .js file under src (subfolders)
for /r "%ROOT%" %%F in (*.js) do (
    rem Skip files located directly under ROOT (we only want subdirectories)
    if /I not "%%~dpF"=="%ROOT%\" (
        >> "%TMP%" echo(
        >> "%TMP%" type "%%F"
    )
)

rem Replace tag in template with bundle contents
powershell -NoLogo -NoProfile -Command ^
  "$tpl  = Get-Content -Raw '%TEMPLATE%';" ^
  "$body = Get-Content -Raw '%TMP%';" ^
  "$out  = $tpl -replace '/\* @BUNDLE \*/', $body;" ^
  "Set-Content '%OUT%' $out;"

del /q "%TMP%" >nul 2>&1

echo Done. Output: "%OUT%"

