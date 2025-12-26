<div align="center">

# DCAT-OCA

### Dashboard de Control y Análisis Técnico

**Plataforma de inteligencia operacional para servicios técnicos de distribución eléctrica**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org/)
[![Pandas](https://img.shields.io/badge/Pandas-Data_Processing-150458?style=flat-square&logo=pandas)](https://pandas.pydata.org/)

<br/>

<img src="assets/logoOcaHorizontal.svg" alt="OCA Global Logo" width="200"/>

---

*Sistema desarrollado para **OCA Global** - Servicios técnicos para **Enel Chile***

</div>

---

## Problema que Resuelve

En operaciones de distribución eléctrica, los equipos técnicos generan miles de registros diarios desde múltiples fuentes: inspecciones de nuevas conexiones, lecturas de medidores, evaluaciones de telecomunicaciones y controles de pérdidas. Esta información fragmentada en archivos Excel/CSV dificulta:

- Tomar decisiones en tiempo real
- Identificar patrones y anomalías
- Generar reportes consolidados
- Medir KPIs de desempeño

**DCAT-OCA** centraliza estos datos en una plataforma web que transforma +2.5 millones de registros en dashboards interactivos con análisis automatizado.

---

## Características Principales

| Capacidad | Descripción |
|-----------|-------------|
| **Procesamiento Masivo** | Carga y análisis de +2.5M registros en memoria con Pandas |
| **Dashboards en Tiempo Real** | Visualización de KPIs con gráficos interactivos (Tremor + Recharts) |
| **Filtrado Avanzado** | Por zona, inspector, comuna, fechas, estado y más |
| **Análisis Comparativo** | Métricas vs período anterior con indicadores de tendencia |
| **Exportación Flexible** | Descarga de datos filtrados en CSV o Excel |
| **Control de Acceso** | Autenticación JWT con 3 niveles de rol |
| **Insights Automáticos** | Detección de anomalías y patrones relevantes |

---

## Módulos del Sistema

### 1. Nuevas Conexiones (NNCC)
**Estado:** Producción | **Registros:** ~1M

Gestión de inspecciones para conexiones Netbilling.

- Tasa de efectividad y ejecución
- Análisis de multas y conformidad
- Distribución por zona y base
- Tendencia mensual de inspecciones
- Seguimiento de estado de contratistas

### 2. Lecturas
**Estado:** Producción | **Registros:** ~730K

Control de inspecciones de lectura de medidores.

- Inspecciones en plazo vs fuera de plazo
- Días de respuesta (promedio, mínimo, máximo)
- Análisis por origen: ORDENES, SEC, VISITA VIRTUAL
- Top 5 hallazgos detectados
- Evolución diaria de inspecciones

### 3. Telecomunicaciones
**Estado:** Producción | **Registros:** ~120K

Evaluación de factibilidad para instalación en postes.

- Tasa de aprobación/rechazo
- Análisis por empresa solicitante
- Conteo de postes evaluados
- Geolocalización de casos

### 4. Control de Pérdidas (Calidad)
**Estado:** Producción | **Registros:** ~1.6M

Inspecciones para detección de irregularidades en sistemas mono y trifásicos.

- Solicitadas vs ejecutadas
- Análisis de anomalías:
  - Modelo no corresponde
  - Medidor no corresponde
  - Requiere normalización
  - Perno no normalizado
- Distribución por resultado y contratista
- Evolución mensual

### 5. Corte y Reposición
**Estado:** Próximamente

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Next.js 14 (App Router) + TypeScript + Tailwind CSS     │   │
│  │  ────────────────────────────────────────────────────    │   │
│  │  • Tremor Components (Cards, Charts, Tables)             │   │
│  │  • Recharts (Gráficos personalizados)                    │   │
│  │  • Context API (Auth, Sidebar)                           │   │
│  │  • react-hook-form + Zod (Validación)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                        HTTP + JWT                                │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      BACKEND                              │   │
│  │  FastAPI + Python 3.11+ + Pandas                         │   │
│  │  ────────────────────────────────────────────────────    │   │
│  │  • API RESTful (/api/v1/*)                               │   │
│  │  • JWT + bcrypt (Autenticación)                          │   │
│  │  • Pydantic (Validación de esquemas)                     │   │
│  │  • DataFrames en caché (2.5M+ registros)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                         Lectura                                  │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    DATOS (CSV/Excel)                      │   │
│  │  /data/                                                   │   │
│  │  • INFORME NNCC (26 MB)                                  │   │
│  │  • informe_lectura_*.csv                                 │   │
│  │  • informe_teleco.csv                                    │   │
│  │  • informe_calidad_*.csv                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Instalación

### Requisitos

- **Node.js** 18+
- **Python** 3.11+
- **Git**

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/DCAT-OCA.git
cd DCAT-OCA
```

### 2. Configurar el Backend

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

# Crear archivo de configuración
cp .env.example .env
# Editar .env con tus valores
```

### 3. Configurar el Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo de configuración
cp .env.example .env.local
# Verificar que NEXT_PUBLIC_API_URL apunte al backend
```

### 4. Colocar los datos

Copiar los archivos CSV en la carpeta `/data/`:

```
data/
├── 2025-05 INFORME NNCC (2024-2029) DIC 2025.csv
├── informe_lectura_ORDENES_ORDENES.csv
├── informe_lectura_SEC_SEC.csv
├── informe_lectura_VIRTUAL_*.csv
├── informe_teleco.csv
├── informe_calidad_mono_*.csv
└── informe_calidad_tri_*.csv
```

### 5. Iniciar los servicios

**Terminal 1 - Backend:**
```bash
cd backend
venv\Scripts\activate  # Windows
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Accesos

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

---

## Variables de Entorno

### Backend (`backend/.env`)

```env
# Seguridad
SECRET_KEY=tu-clave-secreta-muy-segura-de-32-caracteres-minimo
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 días

# CORS
CORS_ORIGINS=["http://localhost:3000"]

# API
API_V1_PREFIX=/api/v1
DEBUG=True
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Usuarios por Defecto

| Email | Contraseña | Rol | Permisos |
|-------|------------|-----|----------|
| `admin@ocaglobal.com` | admin123 | Admin | Lectura, escritura, gestión |
| `editor@ocaglobal.com` | editor123 | Editor | Lectura, escritura, carga de datos |
| `viewer@ocaglobal.com` | viewer123 | Viewer | Solo lectura |

---

## API Endpoints

### Autenticación

```
POST   /api/v1/auth/login     # Obtener token JWT
GET    /api/v1/auth/me        # Información del usuario actual
POST   /api/v1/auth/logout    # Cerrar sesión
```

### Módulos de Datos

Cada módulo expone endpoints similares:

```
GET    /api/v1/{modulo}           # Listar registros (paginado + filtros)
GET    /api/v1/{modulo}/stats     # Estadísticas y KPIs
GET    /api/v1/{modulo}/export    # Descargar CSV/Excel
POST   /api/v1/{modulo}/upload    # Cargar nuevos datos (editor+)
GET    /api/v1/{modulo}/comunas   # Listado de comunas
GET    /api/v1/{modulo}/zonas     # Listado de zonas
GET    /api/v1/{modulo}/inspectors # Listado de inspectores
```

**Módulos disponibles:** `nuevas-conexiones`, `lecturas`, `teleco`, `calidad`

### Dashboard

```
GET    /api/v1/dashboard/summary  # Resumen de todos los módulos
```

---

## Estructura del Proyecto

```
DCAT-OCA/
│
├── frontend/                      # Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/                   # App Router
│   │   │   ├── login/             # Página de login
│   │   │   └── dashboard/         # Dashboard principal
│   │   │       ├── page.tsx       # Vista resumen
│   │   │       ├── nuevas-conexiones/
│   │   │       ├── lecturas/
│   │   │       ├── telecomunicaciones/
│   │   │       └── control-perdidas/
│   │   ├── components/
│   │   │   ├── layout/            # Header, Sidebar
│   │   │   └── ui/                # Button, Input, Export
│   │   ├── contexts/              # AuthContext, SidebarContext
│   │   ├── lib/                   # API client, utilities
│   │   └── types/                 # TypeScript definitions
│   ├── public/                    # Assets estáticos
│   ├── tailwind.config.ts         # Configuración Tailwind + Tremor
│   └── package.json
│
├── backend/                       # FastAPI + Python
│   ├── app/
│   │   ├── main.py                # Aplicación principal
│   │   ├── core/
│   │   │   ├── config.py          # Configuración
│   │   │   └── security.py        # JWT, hashing
│   │   ├── api/
│   │   │   ├── v1/                # Endpoints versión 1
│   │   │   │   ├── auth.py
│   │   │   │   ├── nuevas_conexiones.py
│   │   │   │   ├── lecturas.py
│   │   │   │   ├── teleco.py
│   │   │   │   ├── calidad.py
│   │   │   │   └── dashboard.py
│   │   │   └── deps.py            # Dependencias (auth)
│   │   ├── schemas/               # Modelos Pydantic
│   │   └── services/              # Lógica de negocio
│   │       ├── data_service.py    # NNCC
│   │       ├── lecturas_service.py
│   │       ├── teleco_service.py
│   │       └── calidad_service.py
│   └── requirements.txt
│
├── data/                          # Archivos CSV fuente
├── docs/                          # Documentación adicional
│   └── STYLE_GUIDE.md             # Guía de estilos
├── assets/                        # Logos corporativos
│
├── start.bat                      # Inicio rápido Windows
├── start.sh                       # Inicio rápido Linux
└── cloudflare_link.bat            # Túnel público temporal
```

---

## Scripts de Desarrollo

### Windows

```batch
:: Iniciar frontend
start.bat frontend

:: Iniciar backend
start.bat backend
```

### Publicar temporalmente (Cloudflare Tunnel)

```batch
:: Exponer frontend públicamente
cloudflare_link.bat frontend

:: Exponer backend públicamente
cloudflare_link.bat backend
```

Genera un enlace `https://*.trycloudflare.com` sin necesidad de cuenta.

---

## Colores Corporativos

| Color | Hex | Uso |
|-------|-----|-----|
| **Azul OCA** | `#294D6D` | Primario, navegación, acciones principales |
| **Rojo OCA** | `#DE473C` | Alertas, errores, valores negativos |
| Blanco | `#FFFFFF` | Fondos, texto sobre oscuro |
| Gris claro | `#F8FAFC` | Fondos secundarios |

---

## Tecnologías

### Frontend
- **Next.js 14** - Framework React con App Router
- **TypeScript 5.9** - Tipado estático
- **Tailwind CSS 3.4** - Estilos utilitarios
- **Tremor 3.18** - Componentes de dashboard
- **Recharts 3.6** - Gráficos personalizados
- **react-hook-form 7** - Gestión de formularios
- **Zod 4** - Validación de esquemas
- **Lucide React** - Iconografía

### Backend
- **FastAPI** - Framework web moderno
- **Python 3.11+** - Lenguaje base
- **Pandas** - Procesamiento de datos
- **Pydantic** - Validación de modelos
- **python-jose** - Tokens JWT
- **passlib + bcrypt** - Hashing de contraseñas
- **openpyxl** - Generación de Excel

---

## Métricas del Proyecto

| Concepto | Valor |
|----------|-------|
| Registros procesados | +2,500,000 |
| Módulos activos | 4 |
| Endpoints API | +40 |
| Archivos TypeScript | 23 |
| Archivos Python | 25 |

---

## Roadmap

- [ ] Módulo Corte y Reposición
- [ ] Modo oscuro
- [ ] Exportación a PDF con gráficos
- [ ] Notificaciones en tiempo real
- [ ] Base de datos persistente (PostgreSQL)
- [ ] Caché con Redis
- [ ] Tests automatizados
- [ ] Docker Compose para deployment

---

## Contribución

Este es un proyecto privado de OCA Global. Para contribuir:

1. Crear una rama desde `main`
2. Implementar cambios siguiendo la [guía de estilos](docs/STYLE_GUIDE.md)
3. Abrir un Pull Request con descripción detallada

---

## Licencia

**Proyecto privado** - OCA Global © 2024-2025

Todos los derechos reservados. Este software es propiedad exclusiva de OCA Global y está destinado únicamente para uso interno en operaciones con Enel Chile.

---

<div align="center">

**[OCA Global](https://ocaglobal.com)** | Servicios Técnicos para **Enel Chile**

</div>
