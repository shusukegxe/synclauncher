@echo off
rem ============================================================
rem  Sync - instalador del lanzador Bros 26.2 (sin permisos de admin)
rem  Instala en %APPDATA%\AppSync, registra mcq:// y crea accesos directos
rem ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "DEST=%APPDATA%\AppSync"
set "EXE=%DEST%\SyncApp.exe"

echo.
echo   Sync - instalador del lanzador
echo   ----------------------------------------
echo   Destino: %DEST%
echo.

rem 1) matar instancia previa (evita el error de archivo bloqueado)
taskkill /F /IM SyncApp.exe >nul 2>&1

rem 2) copiar archivos
if not exist "%DEST%" mkdir "%DEST%" >nul 2>&1
if not exist "%DEST%\config" mkdir "%DEST%\config" >nul 2>&1
if not exist "%DEST%\CustomSkinLoader" mkdir "%DEST%\CustomSkinLoader" >nul 2>&1
if not exist "%DEST%\shaderpacks" mkdir "%DEST%\shaderpacks" >nul 2>&1

copy /y "SyncApp.exe" "%DEST%\" >nul
if exist "preset.json" copy /y "preset.json" "%DEST%\" >nul
if exist "config\*" xcopy /e /i /y "config" "%DEST%\config\" >nul
if exist "CustomSkinLoader\*" xcopy /e /i /y "CustomSkinLoader" "%DEST%\CustomSkinLoader\" >nul
if exist "shaderpacks\*.txt" copy /y "shaderpacks\*.txt" "%DEST%\shaderpacks\" >nul

rem 3) quitar la marca de internet (nada de pantalla azul de Smartscreen)
for %%F in ("%DEST%\SyncApp.exe") do powershell -NoProfile -Command "Unblock-File -LiteralPath '%%~F'" >nul 2>&1
powershell -NoProfile -Command "Get-ChildItem -Path '%DEST%' -Recurse -File -ErrorAction SilentlyContinue | Unblock-File" >nul 2>&1

rem 4) registrar el protocolo mcq:// (HKCU, no necesita admin)
reg add "HKCU\Software\Classes\mcq" /ve /d "URL:SyncApp Protocol" /f >nul
reg add "HKCU\Software\Classes\mcq" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\mcq\shell\open\command" /ve /d "\"%EXE%\" \"%%1\"" /f >nul

rem 5) accesos directos
set "SMSTART=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
if not exist "%SMSTART%\Sync" mkdir "%SMSTART%\Sync" >nul 2>&1
powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut('%SMSTART%\Sync\Sync.lnk'); $l.TargetPath='%EXE%'; $l.Save()" >nul 2>&1
powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Sync.lnk'); $l.TargetPath='%EXE%'; $l.Save()" >nul 2>&1

echo   [OK] Archivos copiados a %DEST%
echo   [OK] Protocolo mcq:// registrado
echo   [OK] Accesos directos creados
echo.
echo   Abriendo el lanzador...
start "" "%EXE%"
timeout /t 3 >nul
echo   Listo. Para jugar: entra a https://shusukegxe.github.io/synclauncher/ y pulsa JUGAR.
echo.
pause
