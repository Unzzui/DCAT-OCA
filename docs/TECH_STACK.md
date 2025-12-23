# Arquitectura Tecnica - Dashboard DCAT-OCA

## Resumen del Proyecto

Dashboard web para consolidar y visualizar datos de servicios prestados a Enel, comenzando con el servicio de **Nuevas Conexiones (Netbilling)**.

### Problema que resuelve
- No existe punto centralizado para visualizar estadisticas
- Datos dispersos en multiples Excel
- Dificultad para generar insights rapidos
- Falta de filtros y busquedas eficientes

---

## Stack Tecnologico

### Frontend
| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| **Next.js** | 14.x | Framework React con SSR/SSG |
| **TypeScript** | 5.x | Tipado estatico |
| **Tailwind CSS** | 3.x | Estilos utilitarios |
| **Tremor** | 3.x | Componentes de dashboard |
| **Recharts** | 2.x | Graficos interactivos |
| **Lucide React** | latest | Iconos |
| **React Hook Form** | 7.x | Manejo de formularios |
| **Zod** | 3.x | Validacion de schemas |

### Backend
| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| **FastAPI** | 0.109.x | API REST |
| **Python** | 3.11+ | Runtime |
| **Pandas** | 2.x | Procesamiento de datos |
| **Pydantic** | 2.x | Validacion de datos |
| **Python-Jose** | 3.x | JWT tokens |
| **Passlib** | 1.7.x | Hash de passwords |
| **Uvicorn** | 0.27.x | ASGI server |

### Base de Datos
| Fase | Tecnologia | Proposito |
|------|------------|-----------|
| **MVP** | CSV/Parquet | Almacenamiento inicial |
| **Produccion** | PostgreSQL | BD relacional |
| **Cache** | Redis (opcional) | Cache de queries |

### Infraestructura
| Servicio | Proposito |
|----------|-----------|
| **Vercel** | Hosting frontend |
| **Railway/Render** | Hosting backend |
| **Supabase** | PostgreSQL (futuro) |

---

## Arquitectura

```
                    +------------------+
                    |     Vercel       |
                    |   (Frontend)     |
                    +--------+---------+
                             |
                             | HTTPS
                             v
                    +--------+---------+
                    |     Next.js      |
                    |   App Router     |
                    +--------+---------+
                             |
                             | API Calls
                             v
                    +--------+---------+
                    |     FastAPI      |
                    |    (Backend)     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
         +--------+    +--------+    +--------+
         |  CSV   |    | Cache  |    |  Auth  |
         | (MVP)  |    | Redis  |    |  JWT   |
         +--------+    +--------+    +--------+
```

---

## Estructura de Carpetas

### Frontend (Next.js)
```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Dashboard principal
│   │   ├── nuevas-conexiones/
│   │   │   └── page.tsx
│   │   ├── lecturas/                # Futuro
│   │   ├── corte-reposicion/        # Futuro
│   │   └── control-perdidas/        # Futuro
│   ├── api/                         # API routes (proxy opcional)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                          # Componentes base
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   └── ...
│   ├── charts/                      # Graficos
│   │   ├── bar-chart.tsx
│   │   ├── line-chart.tsx
│   │   ├── pie-chart.tsx
│   │   └── kpi-card.tsx
│   ├── layout/                      # Layout components
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── footer.tsx
│   └── features/                    # Por servicio
│       └── nuevas-conexiones/
│           ├── filters.tsx
│           ├── data-table.tsx
│           └── stats-cards.tsx
├── lib/
│   ├── api.ts                       # Cliente API
│   ├── auth.ts                      # Utilidades auth
│   └── utils.ts                     # Helpers
├── hooks/
│   ├── use-auth.ts
│   └── use-data.ts
├── types/
│   └── index.ts                     # Tipos TypeScript
├── public/
│   └── assets/
│       ├── logo-oca.png
│       └── favicon.ico
├── tailwind.config.ts
├── next.config.js
└── package.json
```

### Backend (FastAPI)
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                      # Entry point
│   ├── config.py                    # Configuracion
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py                  # Dependencias
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py            # Router principal
│   │       ├── auth.py              # Endpoints auth
│   │       └── endpoints/
│   │           ├── nuevas_conexiones.py
│   │           ├── lecturas.py      # Futuro
│   │           └── ...
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py              # JWT, hashing
│   │   └── config.py                # Settings
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── nuevas_conexiones.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── token.py
│   │   └── nuevas_conexiones.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── data_loader.py           # Carga CSV/Excel
│   │   └── analytics.py             # Calculos KPIs
│   └── data/                        # CSVs (MVP)
│       └── nuevas_conexiones.csv
├── tests/
├── requirements.txt
└── Dockerfile
```

---

## Modelos de Datos

### Usuario
```python
class User:
    id: int
    email: str
    hashed_password: str
    full_name: str
    role: Literal["admin", "editor", "viewer"]
    is_active: bool
    created_at: datetime
```

### Nuevas Conexiones (campos principales)
```python
class NuevaConexion:
    id: int
    n_cliente: str
    fecha_reporte: date
    estado_nv: str
    etapa_nv: str
    comuna: str
    fecha_protocolo: date | None
    n_medidor: str | None
    potencia_instalada: float | None
    tipo_cliente: str          # Masivo, GGCC
    tension: str               # BT, MT
    tarifa: str
    ejecutor: str              # CONTRATISTA, STARBEAT
    subestacion: str
    zona: str                  # FLORIDA, CHACABUCO, CORDILLERA, PACIFICO
```

---

## API Endpoints

### Autenticacion
```
POST   /api/v1/auth/login          # Login
POST   /api/v1/auth/logout         # Logout
GET    /api/v1/auth/me             # Usuario actual
```

### Nuevas Conexiones
```
GET    /api/v1/nuevas-conexiones                    # Lista con filtros
GET    /api/v1/nuevas-conexiones/{id}               # Detalle
GET    /api/v1/nuevas-conexiones/stats              # KPIs agregados
GET    /api/v1/nuevas-conexiones/export             # Exportar (csv/excel/pdf)
POST   /api/v1/nuevas-conexiones/upload             # Subir Excel (editor+)
```

### Filtros soportados (query params)
```
?fecha_desde=2024-01-01
?fecha_hasta=2024-12-31
?mes=2024-10
?zona=FLORIDA
?tipo_cliente=Masivo
?estado=FINALIZADA
?page=1
?limit=50
?sort_by=fecha_reporte
?order=desc
```

---

## Autenticacion y Roles

### Flujo JWT
1. Usuario envia email/password a `/auth/login`
2. Backend valida y retorna `access_token` + `refresh_token`
3. Frontend guarda tokens en httpOnly cookies
4. Cada request incluye token en header `Authorization: Bearer <token>`
5. Backend valida token y extrae rol del usuario

### Permisos por rol
| Accion | Admin | Editor | Viewer |
|--------|-------|--------|--------|
| Ver dashboard | Si | Si | Si |
| Filtrar datos | Si | Si | Si |
| Exportar datos | Si | Si | Si |
| Subir Excel | Si | Si | No |
| Gestionar usuarios | Si | No | No |
| Config sistema | Si | No | No |

---

## Optimizaciones de Rendimiento

### Frontend
- **Server Components**: Renderizado en servidor por defecto
- **Streaming**: Suspense para carga progresiva
- **Pagination**: Tablas con paginacion server-side
- **Debounce**: Filtros con debounce 300ms
- **Memoization**: useMemo/useCallback en calculos pesados
- **Virtual scrolling**: Para tablas >1000 filas

### Backend
- **Pagination**: Limite de registros por request
- **Indexing**: Indices en campos de filtro frecuentes
- **Caching**: Redis para queries repetitivas
- **Lazy loading**: Cargar CSV en memoria solo una vez
- **Async**: Endpoints asincronos con asyncio

### Datos
- **Parquet**: Formato columnar mas eficiente que CSV
- **Compresion**: gzip para transferencia
- **Partial loading**: Solo columnas necesarias

---

## Exportacion

### Formatos soportados
| Formato | Libreria | Uso |
|---------|----------|-----|
| CSV | pandas | Datos crudos |
| Excel | openpyxl | Con formato |
| PDF | reportlab + matplotlib | Con graficos |

### Flujo de exportacion
1. Usuario selecciona filtros
2. Click en "Exportar" y selecciona formato
3. Backend genera archivo con datos filtrados
4. Retorna archivo para descarga

---

## Deployment

### Frontend (Vercel)
```bash
# vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

### Backend (Railway/Render)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Variables de entorno
```env
# Frontend
NEXT_PUBLIC_API_URL=https://api.dcat-oca.com

# Backend
DATABASE_URL=postgresql://...
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

## Roadmap MVP

### Fase 1: Setup inicial
- [ ] Crear proyecto Next.js con TypeScript
- [ ] Configurar Tailwind + Tremor
- [ ] Crear proyecto FastAPI
- [ ] Implementar auth basica

### Fase 2: Nuevas Conexiones
- [ ] Endpoint carga CSV
- [ ] API filtros y paginacion
- [ ] Dashboard con KPIs
- [ ] Tabla con filtros
- [ ] Graficos basicos

### Fase 3: Exportacion
- [ ] Export CSV
- [ ] Export Excel
- [ ] Export PDF con graficos

### Fase 4: Polish
- [ ] Optimizaciones
- [ ] Testing
- [ ] Deploy produccion
