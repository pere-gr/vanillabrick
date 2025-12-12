@echo off
setlocal enabledelayedexpansion

rem Paths
set "ROOT=%~dp0src"
set "OUT_JS=%~dp0dist\vanillabrick.js"
set "OUT_CSS=%~dp0dist\vanillabrick.css"
set "TEMPLATE=%~dp0VanillaBrick.template.js"
set "TMP_JS=%TEMP%\VanillaBrick_bundle.tmp"
set "TMP_CSS=%TEMP%\VanillaBrick_css.tmp"

rem Ensure output directory exists
if not exist "%~dp0dist" mkdir "%~dp0dist"

if not exist "%TEMPLATE%" (
  echo ERROR: Template file not found: "%TEMPLATE%"
  exit /b 1
)

rem ========== Build JavaScript ==========
echo Building JavaScript bundle...

rem Build bundle into temp (only subfolder JS files)
> "%TMP_JS%" type nul

rem Append every other .js file under src (subfolders)
for /r "%ROOT%" %%F in (*.js) do (
    rem Skip files located directly under ROOT (we only want subdirectories)
    if /I not "%%~dpF"=="%ROOT%\" (
        >> "%TMP_JS%" echo(
        >> "%TMP_JS%" type "%%F"
    )
)

rem Replace tag in template with bundle contents
powershell -NoLogo -NoProfile -Command ^
  "$tpl  = Get-Content -Raw '%TEMPLATE%';" ^
  "$body = Get-Content -Raw '%TMP_JS%';" ^
  "$out  = $tpl -replace '/\* @BUNDLE \*/', $body;" ^
  "Set-Content '%OUT_JS%' $out;"

del /q "%TMP_JS%" >nul 2>&1

echo Done. JavaScript: "%OUT_JS%"

rem ========== Build CSS ==========
echo Building CSS bundle...

rem Build CSS bundle into temp
> "%TMP_CSS%" type nul

rem Append every .css file under src/css
for /r "%ROOT%\css" %%F in (*.css) do (
    >> "%TMP_CSS%" echo(
    >> "%TMP_CSS%" type "%%F"
)

rem Copy CSS bundle to output
copy /Y "%TMP_CSS%" "%OUT_CSS%" >nul

del /q "%TMP_CSS%" >nul 2>&1

echo Done. CSS: "%OUT_CSS%"
echo.
echo Build complete!
