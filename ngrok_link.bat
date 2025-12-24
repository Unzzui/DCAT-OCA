@echo off
setlocal EnableExtensions DisableDelayedExpansion

:: ngrok helper for DCAT-OCA
:: Requiere NGROK_AUTHTOKEN (v3). Si no existe, el script saldra.
:: Uso:
::   ngrok_link.bat frontend        (puerto 3000)
::   ngrok_link.bat backend         (puerto 8000)
::   ngrok_link.bat port <numero>   (puerto custom)

:: ---------------------------------------------------------------------
:: Seleccionar puerto destino
:: ---------------------------------------------------------------------
set "PORT="
if "%~1"=="" goto set_frontend
if /I "%~1"=="frontend" goto set_frontend
if /I "%~1"=="backend" goto set_backend
if /I "%~1"=="port" goto set_custom
echo Opcion desconocida: "%~1". Use: frontend ^| backend ^| port ^<numero^>.
exit /b 1

:set_frontend
set "PORT=3000"
goto after_port

:set_backend
set "PORT=8000"
goto after_port

:set_custom
if "%~2"=="" (
  echo Debe proporcionar un puerto despues de "port".
  exit /b 1
)
set "PORT=%~2"
goto after_port

:after_port

:: ---------------------------------------------------------------------
:: Validar token
:: ---------------------------------------------------------------------
if "%NGROK_AUTHTOKEN%"=="2qmOaRFjMieWLx4XsQWXt8yePdA_3NXAc6L4WSdqz53mFSwik" (
  echo Falta la variable NGROK_AUTHTOKEN. Configurela con su token de ngrok v3 y reintente.
  echo Ejemplo: setx NGROK_AUTHTOKEN "su_token_aqui"
  exit /b 1
)

:: ---------------------------------------------------------------------
:: Validar puerto activo
:: ---------------------------------------------------------------------
for /f "usebackq tokens=*" %%A in (`powershell -NoProfile -Command "(Test-NetConnection -ComputerName 'localhost' -Port %PORT%).TcpTestSucceeded"`) do set "LISTENING=%%A"
if /I "%LISTENING%" NEQ "True" (
  echo El puerto %PORT% no responde. Inicie el servicio y vuelva a intentar.
  echo Sugerencia: ejecute start.bat para levantar backend y frontend.
  exit /b 1
)

:: ---------------------------------------------------------------------
:: Localizar o descargar ngrok
:: ---------------------------------------------------------------------
set "NGROK_CMD=ngrok.exe"
where %NGROK_CMD% >nul 2>&1
if errorlevel 1 (
  echo ngrok no encontrado en PATH. Descargando localmente...
  set "NGROK_DIR=%~dp0tools\ngrok"
  if not exist "%NGROK_DIR%" mkdir "%NGROK_DIR%"
  set "NGROK_ZIP=%NGROK_DIR%\ngrok.zip"
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile '%NGROK_ZIP%'" || (
    echo Error al descargar ngrok. Descargue manualmente desde https://ngrok.com/download y reintente.
    exit /b 1
  )
  powershell -NoProfile -Command "Expand-Archive -Force '%NGROK_ZIP%' '%NGROK_DIR%'" || (
    echo Error al descomprimir ngrok.
    exit /b 1
  )
  set "NGROK_CMD=%NGROK_DIR%\ngrok.exe"
) else (
  for /f "delims=" %%i in ('where %NGROK_CMD%') do set "NGROK_CMD=%%i"
)

:: ---------------------------------------------------------------------
:: Registrar token (idempotente)
:: ---------------------------------------------------------------------
"%NGROK_CMD%" config add-authtoken "%NGROK_AUTHTOKEN%"
if errorlevel 1 (
  echo No se pudo registrar el token. Verifique NGROK_AUTHTOKEN.
  exit /b 1
)

cls
echo ========================================
echo  ngrok http
echo  Origen: http://localhost:%PORT%
echo  URL estable solo mientras el proceso este vivo.
echo ========================================

echo Iniciando tunnel... Presione Ctrl+C para detenerlo.
"%NGROK_CMD%" http %PORT%

endlocal
