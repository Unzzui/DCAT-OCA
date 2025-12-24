# DCAT-OCA - Dashboard de Control y Analisis Tecnico

Dashboard web para consolidar y visualizar datos de servicios prestados a Enel por OCA Global.

## Servicios

- **Nuevas Conexiones** (MVP) - Gestion de conexiones Netbilling
- Lecturas (proximamente)
- Corte y Reposicion (proximamente)
- Control de Perdidas (proximamente)

## Tech Stack

### Frontend
- Next.js 14 + TypeScript
- Tailwind CSS
- Tremor (componentes de dashboard)
- Recharts (graficos)

### Backend
- FastAPI (Python)
- Pandas (procesamiento de datos)
- JWT (autenticacion)

## Requisitos

- Node.js 18+
- Python 3.11+
- npm o yarn

## Instalacion

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

## Acceso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Usuarios de prueba

| Email | Password | Rol |
|-------|----------|-----|
| admin@ocaglobal.com | admin123 | Administrador |
| editor@ocaglobal.com | editor123 | Editor |
| viewer@ocaglobal.com | viewer123 | Visualizador |

## Estructura del Proyecto

```
DCAT-OCA/
├── frontend/           # Next.js app
│   ├── src/
│   │   ├── app/       # Pages y layouts
│   │   ├── components/# Componentes React
│   │   ├── contexts/  # Context providers
│   │   ├── lib/       # Utilidades
│   │   └── types/     # TypeScript types
│   └── public/        # Assets estaticos
├── backend/           # FastAPI app
│   └── app/
│       ├── api/       # Endpoints
│       ├── core/      # Config y seguridad
│       ├── schemas/   # Pydantic models
│       └── services/  # Logica de negocio
├── data/              # Archivos CSV
├── assets/            # Logos e imagenes
└── docs/              # Documentacion
```

## Colores Corporativos

- **Azul OCA**: #294D6D
- **Rojo OCA**: #DE473C

## Licencia

Proyecto privado - OCA Global

## Enlace publico (Cloudflare)

- **Objetivo:** generar un enlace publico temporal para compartir el frontend o la API local mediante Cloudflare Quick Tunnel.
- **Requisitos:** ninguna cuenta necesaria para "Quick Tunnel". Para enlaces persistentes con tu dominio, configura un Tunnel nombrado (no cubierto aqui).

### Uso rapido en Windows

- Ejecuta el script: [cloudflare_link.bat](cloudflare_link.bat)

```bat
:: Exponer el frontend (Next.js en 3000)
cloudflare_link.bat frontend

:: Exponer el backend (FastAPI en 8000)
cloudflare_link.bat backend

:: Exponer un puerto especifico
cloudflare_link.bat port 5173
```

- El script verifica que el puerto este activo y descargara `cloudflared.exe` automaticamente si no esta instalado.
- En la consola veras un enlace `https://*.trycloudflare.com`. Comparte ese URL; mientras la ventana este abierta, el servicio sera accesible.

### Alternativa: ngrok (requiere token)

- Exporta tu token (v3) una vez en esta sesion o de forma persistente:

```bat
:: Sesion actual
set NGROK_AUTHTOKEN=tu_token

:: Persistente (crea variable de usuario)
setx NGROK_AUTHTOKEN "tu_token"
```

- Genera el enlace con el helper: [ngrok_link.bat](ngrok_link.bat)

```bat
:: Frontend (3000)
ngrok_link.bat frontend

:: Backend (8000)
ngrok_link.bat backend

:: Puerto especifico
ngrok_link.bat port 5173
```

- El script valida que el puerto responda, registra el token y descargara `ngrok.exe` si no esta en PATH. El enlace https://*.ngrok-free.app aparecera en consola y funciona mientras el proceso siga vivo.

### Notas

- **Enlaces temporales:** los Quick Tunnels crean subdominios efimeros en `trycloudflare.com`. Al cerrar el proceso, el enlace deja de funcionar.
- **Persistente con tu dominio:** requiere una cuenta de Cloudflare y crear un "Tunnel" nombrado con DNS CNAME apuntando al tunnel. Esto te da un subdominio estable (ej. `demo.tu-dominio.com`).
