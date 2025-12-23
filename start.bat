@echo off
echo ========================================
echo   DCAT-OCA - Iniciando servicios
echo ========================================
echo.

:: Verificar que existen las carpetas
if not exist "backend" (
    echo ERROR: No se encontro la carpeta backend
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ERROR: No se encontro la carpeta frontend
    pause
    exit /b 1
)

:: Iniciar Backend en una nueva ventana
echo [1/2] Iniciando Backend (FastAPI)...
start "DCAT-OCA Backend" cmd /k "cd backend && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Esperar un poco para que el backend inicie
timeout /t 3 /nobreak > nul

:: Iniciar Frontend en una nueva ventana
echo [2/2] Iniciando Frontend (Next.js)...
start "DCAT-OCA Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   Servicios iniciados correctamente
echo ========================================
echo.
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Frontend: http://localhost:3000
echo.
echo   Usuarios de prueba:
echo   - admin@ocaglobal.com / admin123
echo   - editor@ocaglobal.com / editor123
echo   - viewer@ocaglobal.com / viewer123
echo.
echo ========================================
pause
