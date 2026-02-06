#!/bin/bash

echo "========================================"
echo "  DCAT-OCA - Iniciando servicios"
echo "========================================"
echo ""

# Obtener directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Verificar que existen las carpetas
if [ ! -d "backend" ]; then
    echo "ERROR: No se encontro la carpeta backend"
    exit 1
fi

if [ ! -d "frontend" ]; then
    echo "ERROR: No se encontro la carpeta frontend"
    exit 1
fi

# Funcion para limpiar procesos al salir
cleanup() {
    echo ""
    echo "Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Iniciar Backend
echo "[1/2] Iniciando Backend (FastAPI)..."
cd backend
if [ -d "venv" ]; then
    source venv/Scripts/activate 2>/dev/null || source venv/bin/activate 2>/dev/null
fi
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Esperar un poco para que el backend inicie
sleep 3

# Iniciar Frontend
echo "[2/2] Iniciando Frontend (Next.js)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "  Servicios iniciados correctamente"
echo "========================================"
echo ""
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "  Frontend: http://localhost:3000"
echo ""
echo "  Usuarios de prueba:"
echo "  - admin@ocaglobal.com / admin123"
echo "  - editor@ocaglobal.com / editor123"
echo "  - viewer@ocaglobal.com / viewer123"
echo ""
echo "  Presiona Ctrl+C para detener"
echo "========================================"

# Esperar a que terminen los procesos
wait
