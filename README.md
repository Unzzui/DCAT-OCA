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
