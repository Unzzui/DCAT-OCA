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

# --- Liberar puertos antes de iniciar ---
echo "[0/3] Liberando puertos 8000 y 3000..."

# Matar procesos conocidos que usan estos puertos
pkill -9 -f "uvicorn app.main:app" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
sleep 1

for PORT in 8000 3000; do
    # Intentar hasta 3 veces liberar el puerto
    for attempt in 1 2 3; do
        PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo "  Matando procesos en puerto $PORT (PIDs: $PIDS) - intento $attempt"
            echo "$PIDS" | xargs kill -9 2>/dev/null || true
            sleep 1
        else
            echo "  Puerto $PORT libre"
            break
        fi
    done
done

# Espera final para que el SO libere los sockets
sleep 1

# Funcion para limpiar procesos al salir
cleanup() {
    echo ""
    echo "Deteniendo servicios..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    # Limpieza extra por si quedaron procesos huerfanos
    lsof -ti :8000 2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti :3000 2>/dev/null | xargs kill -9 2>/dev/null || true
    echo "Servicios detenidos."
    exit 0
}

trap cleanup SIGINT SIGTERM

# --- Activar virtualenv ---
echo ""
echo "[1/3] Activando entorno virtual..."
if [ -f "$SCRIPT_DIR/venv/bin/activate" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
    echo "  venv activado: $(which python)"
elif [ -f "$SCRIPT_DIR/venv/Scripts/activate" ]; then
    source "$SCRIPT_DIR/venv/Scripts/activate"
    echo "  venv activado (Windows): $(which python)"
else
    echo "  WARNING: No se encontro virtualenv, usando python del sistema"
fi

# --- Iniciar Backend ---
echo ""
echo "[2/3] Iniciando Backend (FastAPI) en puerto 8000..."
cd "$SCRIPT_DIR/backend"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Esperar a que el backend responda
echo -n "  Esperando backend"
for i in $(seq 1 15); do
    if curl -s -o /dev/null http://localhost:8000/docs 2>/dev/null; then
        echo " OK"
        break
    fi
    echo -n "."
    sleep 1
done

# --- Asegurar .env.local del frontend ---
if [ ! -f "$SCRIPT_DIR/frontend/.env.local" ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > "$SCRIPT_DIR/frontend/.env.local"
    echo "  Creado frontend/.env.local -> http://localhost:8000"
fi

# --- Iniciar Frontend ---
echo ""
echo "[3/3] Iniciando Frontend (Next.js) en puerto 3000..."
cd "$SCRIPT_DIR/frontend"
npx next dev --port 3000 &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Esperar a que el frontend responda
echo -n "  Esperando frontend"
for i in $(seq 1 20); do
    if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
        echo " OK"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "========================================"
echo "  Servicios iniciados correctamente"
echo "========================================"
echo ""
echo "  Backend:  http://localhost:8000  (PID $BACKEND_PID)"
echo "  API Docs: http://localhost:8000/docs"
echo "  Frontend: http://localhost:3000  (PID $FRONTEND_PID)"
echo ""
echo "  Presiona Ctrl+C para detener ambos"
echo "========================================"

# Esperar a que terminen los procesos
wait
