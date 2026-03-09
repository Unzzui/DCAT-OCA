# NNCC Dias de Ejecucion Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track execution time of NNCC base inspections with projected completion date.

**Architecture:** Store fecha_envio per base in settings table. New backend endpoint calculates dias/proyeccion on-the-fly. Frontend enriches the existing Avance card and adds date pickers in Configuracion.

**Tech Stack:** FastAPI, SQLAlchemy, Next.js, Tremor UI, Tailwind CSS

---

### Task 1: Backend — Fechas de envio endpoints

**Files:**
- Modify: `backend/app/services/settings_service.py`
- Modify: `backend/app/api/v1/settings.py`

**Step 1: Add helpers to settings_service.py**

Add at the end of `backend/app/services/settings_service.py`:

```python
async def get_fechas_envio_base() -> dict[str, str]:
    """Get all nncc_fecha_envio_base:* settings as {base_name: date_str}."""
    prefix = "nncc_fecha_envio_base:"
    if _use_db and db_session.AsyncSessionLocal:
        try:
            async with db_session.AsyncSessionLocal() as session:
                result = await session.execute(
                    select(SettingsModel).where(SettingsModel.key.like(f"{prefix}%"))
                )
                return {
                    s.key[len(prefix):]: s.value
                    for s in result.scalars().all()
                    if s.value
                }
        except Exception:
            pass
    # Fallback to memory cache
    return {
        k[len(prefix):]: v
        for k, v in _settings_cache.items()
        if k.startswith(prefix) and v
    }


async def set_fechas_envio_base(fechas: dict[str, str]) -> bool:
    """Save fecha_envio for multiple bases. fechas = {base_name: 'YYYY-MM-DD'}."""
    for base_name, fecha in fechas.items():
        key = f"nncc_fecha_envio_base:{base_name}"
        # Add to DEFAULT_SETTINGS dynamically so it persists properly
        DEFAULT_SETTINGS[key] = {
            "value": fecha,
            "description": f"Fecha envio base {base_name}",
            "category": "nuevas_conexiones",
        }
        await update_setting(key, fecha)
    return True
```

**Step 2: Add API endpoints to settings.py**

Add at the end of `backend/app/api/v1/settings.py`:

```python
@router.get("/fechas-envio-base")
async def get_fechas_envio_base(
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """Get all configured fecha_envio per NNCC base."""
    return await settings_service.get_fechas_envio_base()


class FechasEnvioUpdate(BaseModel):
    fechas: Dict[str, str]  # {base_name: "YYYY-MM-DD"}


@router.put("/fechas-envio-base")
async def update_fechas_envio_base(
    data: FechasEnvioUpdate,
    admin: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Save fecha_envio for NNCC bases (admin only)."""
    await settings_service.set_fechas_envio_base(data.fechas)
    return {"message": "Fechas actualizadas", "count": len(data.fechas)}
```

**IMPORTANT:** These routes must be registered BEFORE the `/{key}` route in settings.py, otherwise FastAPI will match `fechas-envio-base` as a `{key}` parameter. Move the `get_setting` and `update_setting` routes (the ones with `/{key}`) to the end of the file.

**Step 3: Commit**

```bash
git add backend/app/services/settings_service.py backend/app/api/v1/settings.py
git commit -m "feat(backend): add fechas-envio-base settings endpoints"
```

---

### Task 2: Backend — Ejecucion stats endpoint

**Files:**
- Modify: `backend/app/services/nncc_dashboard_service.py`
- Modify: `backend/app/api/v1/nuevas_conexiones.py`

**Step 1: Add ejecucion stats function to nncc_dashboard_service.py**

Add these imports at the top:

```python
from datetime import date, datetime, timedelta
from math import ceil
from ..services import settings_service
```

Add at the end of the file:

```python
def _count_business_days(start: date, end: date) -> int:
    """Count weekdays (Mon-Fri) between start and end inclusive."""
    if end < start:
        return 0
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:  # Mon=0 .. Fri=4
            days += 1
        current += timedelta(days=1)
    return days


def _add_business_days(start: date, num_days: int) -> date:
    """Add num_days business days to start date."""
    current = start
    added = 0
    while added < num_days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


async def get_ejecucion_stats(base: str = None) -> dict:
    """Calculate execution timing stats for a base."""
    if not base:
        return {}

    # Get fecha_envio from settings
    fechas = await settings_service.get_fechas_envio_base()
    fecha_envio_str = fechas.get(base)
    if not fecha_envio_str:
        return {}

    try:
        fecha_envio = date.fromisoformat(fecha_envio_str)
    except ValueError:
        return {}

    # Get KPIs for this base (already pre-calculated)
    kpis = await _get_stat("overview_kpis", base)
    if not kpis:
        return {}

    total_asignadas = kpis.get("total_asignadas", 0)
    total_inspeccionadas = kpis.get("total_inspecciones", 0)
    pct_avance = kpis.get("pct_avance", 0)

    if total_asignadas == 0:
        return {}

    # Get last inspection date from tendencia data
    tendencia = await _get_stat("tendencia_temporal", base)
    ultima_inspeccion = None
    if tendencia:
        # tendencia has daily entries with periodo as date string
        fechas_insp = [t["periodo"] for t in tendencia if t.get("periodo")]
        if fechas_insp:
            ultima_fecha_str = max(fechas_insp)
            try:
                ultima_inspeccion = date.fromisoformat(ultima_fecha_str)
            except ValueError:
                pass

    # If no tendencia dates, query directly
    if not ultima_inspeccion:
        rows = await execute_query(
            "SELECT MAX(fecha_inspeccion) as ultima FROM nncc WHERE base = :base AND fecha_inspeccion IS NOT NULL",
            {"base": base},
        )
        if rows and rows[0]["ultima"]:
            raw = rows[0]["ultima"]
            if isinstance(raw, str):
                ultima_inspeccion = date.fromisoformat(raw[:10])
            elif isinstance(raw, (datetime, date)):
                ultima_inspeccion = raw if isinstance(raw, date) else raw.date()

    completado = pct_avance >= 100
    hoy = date.today()
    fecha_referencia = ultima_inspeccion if completado and ultima_inspeccion else hoy

    dias_habiles = _count_business_days(fecha_envio, fecha_referencia)
    dias_calendario = (fecha_referencia - fecha_envio).days

    promedio_diario = round(total_inspeccionadas / dias_habiles, 1) if dias_habiles > 0 else 0

    pendientes = max(0, total_asignadas - total_inspeccionadas)
    fecha_proyectada = None
    dias_restantes_habiles = None

    if not completado and promedio_diario > 0:
        dias_restantes_habiles = ceil(pendientes / promedio_diario)
        fecha_proyectada = _add_business_days(hoy, dias_restantes_habiles).isoformat()

    return {
        "fecha_envio": fecha_envio.isoformat(),
        "dias_calendario": dias_calendario,
        "dias_habiles": dias_habiles,
        "completado": completado,
        "ultima_inspeccion": ultima_inspeccion.isoformat() if ultima_inspeccion else None,
        "promedio_diario_habil": promedio_diario,
        "pendientes": pendientes,
        "dias_restantes_habiles": dias_restantes_habiles,
        "fecha_proyectada": fecha_proyectada,
    }
```

**Step 2: Add API endpoint to nuevas_conexiones.py**

Add after the `get_dashboard_mal_ejecutados` endpoint:

```python
@router.get("/dashboard/ejecucion-stats")
async def get_dashboard_ejecucion_stats(
    base: Optional[str] = Query(None, description="Base/periodo"),
    current_user: User = Depends(get_current_user),
):
    """Execution timing stats: days elapsed, projection, avg daily rate."""
    return await nncc_dashboard_service.get_ejecucion_stats(base)
```

**Step 3: Commit**

```bash
git add backend/app/services/nncc_dashboard_service.py backend/app/api/v1/nuevas_conexiones.py
git commit -m "feat(backend): add ejecucion-stats endpoint for tracking inspection days"
```

---

### Task 3: Frontend — Configuracion fechas de envio section

**Files:**
- Modify: `frontend/src/app/dashboard/configuracion/page.tsx`
- Modify: `frontend/src/lib/api.ts` (if needed for type)

**Step 1: Add fechas de envio state and section to Configuracion page**

Add new state after existing state declarations (~line 48):

```typescript
const [fechasEnvio, setFechasEnvio] = useState<Record<string, string>>({})
const [editedFechas, setEditedFechas] = useState<Record<string, string>>({})
const [nnccBases, setNnccBases] = useState<string[]>([])
```

Add a new fetch inside `useEffect` alongside `fetchSettings`:

```typescript
const fetchFechasEnvio = useCallback(async () => {
  try {
    const [fechas, bases] = await Promise.all([
      api.get<Record<string, string>>('/api/v1/settings/fechas-envio-base'),
      api.get<string[]>('/api/v1/nuevas-conexiones/dashboard/bases'),
    ])
    setFechasEnvio(fechas)
    setEditedFechas(fechas)
    setNnccBases(bases)
  } catch (err) {
    console.error('Error fetching fechas envio:', err)
  }
}, [])

useEffect(() => {
  fetchFechasEnvio()
}, [fetchFechasEnvio])
```

Add helper to check for fecha changes:

```typescript
const hasFechaChanges = () => {
  return nnccBases.some(b => (editedFechas[b] || '') !== (fechasEnvio[b] || ''))
}
```

Modify `hasChanges` to include fecha changes:

```typescript
const hasChanges = () => {
  return settings.some(s => editedValues[s.key] !== s.value) || hasFechaChanges()
}
```

In `handleSave`, add after saving settings (before the success message):

```typescript
// Save fechas de envio
const changedFechas: Record<string, string> = {}
nnccBases.forEach(b => {
  if ((editedFechas[b] || '') !== (fechasEnvio[b] || '')) {
    changedFechas[b] = editedFechas[b] || ''
  }
})
if (Object.keys(changedFechas).length > 0) {
  await api.put('/api/v1/settings/fechas-envio-base', { fechas: changedFechas })
  fetchFechasEnvio()
}
```

**Step 2: Add UI section before the settings cards**

Add after the action buttons div and before `{/* Settings by category */}`, import `Calendar` from lucide-react, then:

```tsx
{/* Fechas de Envio de Base */}
{nnccBases.length > 0 && (
  <Card className="mb-6">
    <div className="flex items-center gap-2 mb-4">
      <Calendar size={20} className="text-oca-blue" />
      <Title>Fechas de Envio de Base</Title>
    </div>
    <Text className="text-xs text-gray-500 mb-4">
      Fecha en que se envio cada base de NNCC. Se usa para calcular los dias de ejecucion.
    </Text>
    <div className="space-y-3">
      {nnccBases.map(base => (
        <div key={base} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">
              {base}
            </label>
          </div>
          <div className="w-44">
            <input
              type="date"
              value={editedFechas[base] || ''}
              onChange={(e) => setEditedFechas(prev => ({ ...prev, [base]: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-oca-blue/20 focus:border-oca-blue ${
                (editedFechas[base] || '') !== (fechasEnvio[base] || '')
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-gray-300'
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  </Card>
)}
```

**Step 3: Commit**

```bash
git add frontend/src/app/dashboard/configuracion/page.tsx
git commit -m "feat(frontend): add fechas de envio section in configuracion page"
```

---

### Task 4: Frontend — Enriched Avance KPI card

**Files:**
- Modify: `frontend/src/app/dashboard/nuevas-conexiones/page.tsx`
- Modify: `frontend/src/app/dashboard/nuevas-conexiones/types.ts`

**Step 1: Add EjecucionStats type to types.ts**

Add at the end of `types.ts`:

```typescript
export interface EjecucionStats {
  fecha_envio: string
  dias_calendario: number
  dias_habiles: number
  completado: boolean
  ultima_inspeccion: string | null
  promedio_diario_habil: number
  pendientes: number
  dias_restantes_habiles: number | null
  fecha_proyectada: string | null
}
```

**Step 2: Add state and loader in page.tsx**

Add state (~after line 172):

```typescript
const [ejecucionStats, setEjecucionStats] = useState<EjecucionStats | null>(null)
```

Import the type at the top with the others.

Add loader — call it inside the `loadDashboard` callback, after the existing API call. Add after `setOcaData(all.oca)` (~line 222):

```typescript
// Load ejecucion stats (independent, non-blocking)
if (base) {
  api.get<EjecucionStats>('/api/v1/nuevas-conexiones/dashboard/ejecucion-stats', { base })
    .then(setEjecucionStats)
    .catch(() => setEjecucionStats(null))
} else {
  setEjecucionStats(null)
}
```

**Step 3: Replace the ProgressKpi in Resumen Ejecutivo (line ~985)**

Replace:
```tsx
<ProgressKpi label="Avance" value={kpis?.pct_avance ?? 0} displayValue={kpis ? pct(kpis.pct_avance) : '–'} thresholds={{ good: 80, warning: 50 }} />
```

With an enriched card:

```tsx
{/* Avance + Ejecucion stats */}
<div className="px-4 py-3">
  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Avance</p>
  {(() => {
    const avanceVal = kpis?.pct_avance ?? 0
    const level = avanceVal >= 80 ? 'good' : avanceVal >= 50 ? 'warning' : 'bad'
    const barColor = level === 'good' ? 'bg-green-700' : level === 'warning' ? 'bg-amber-600' : 'bg-red-700'
    const valueColor = level === 'good' ? 'text-green-700' : level === 'warning' ? 'text-amber-700' : 'text-red-700'
    const ej = ejecucionStats
    return (
      <>
        <p className={`text-lg font-semibold ${valueColor} mt-1 leading-none tracking-tight`}>
          {kpis ? pct(avanceVal) : '–'}
        </p>
        <div className="mt-2 w-full bg-slate-100 rounded-full h-[3px] overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, avanceVal)}%` }} />
        </div>
        {ej && ej.fecha_envio && (
          <div className="mt-2 space-y-0.5">
            <p className="text-[10px] text-slate-500">
              {ej.completado
                ? `Completado en ${ej.dias_habiles} dias habiles`
                : `${ej.dias_habiles} dias habiles`
              }
              {' · '}{ej.promedio_diario_habil} insp/dia
            </p>
            {!ej.completado && ej.fecha_proyectada && (
              <p className="text-[10px] font-medium text-slate-600">
                Proyeccion: {new Date(ej.fecha_proyectada + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        )}
      </>
    )
  })()}
</div>
```

**Step 4: Do the same for the OCA tab ProgressKpi (line ~1475)**

Replace:
```tsx
<ProgressKpi label="Avance" value={avance} displayValue={pct(avance)} thresholds={{ good: 80, warning: 50 }} />
```

With:
```tsx
<div className="px-4 py-3">
  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Avance</p>
  {(() => {
    const level = avance >= 80 ? 'good' : avance >= 50 ? 'warning' : 'bad'
    const barColor = level === 'good' ? 'bg-green-700' : level === 'warning' ? 'bg-amber-600' : 'bg-red-700'
    const valueColor = level === 'good' ? 'text-green-700' : level === 'warning' ? 'text-amber-700' : 'text-red-700'
    const ej = ejecucionStats
    return (
      <>
        <p className={`text-lg font-semibold ${valueColor} mt-1 leading-none tracking-tight`}>{pct(avance)}</p>
        <div className="mt-2 w-full bg-slate-100 rounded-full h-[3px] overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, avance)}%` }} />
        </div>
        {ej && ej.fecha_envio && !ej.completado && ej.fecha_proyectada && (
          <p className="text-[10px] text-slate-500 mt-1.5">
            {ej.dias_habiles}d · Proy: {new Date(ej.fecha_proyectada + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </>
    )
  })()}
</div>
```

**Step 5: Commit**

```bash
git add frontend/src/app/dashboard/nuevas-conexiones/page.tsx frontend/src/app/dashboard/nuevas-conexiones/types.ts
git commit -m "feat(frontend): enriched Avance card with dias de ejecucion and projection"
```

---

### Task 5: Verify and test

**Step 1: Start backend and verify endpoints**

```bash
cd /home/unzzui/Proyectos/DCAT-OCA && ./start.sh
```

**Step 2: Test settings endpoints**

```bash
# Get current fechas (should be empty)
curl -s http://localhost:8000/api/v1/settings/fechas-envio-base -H "Authorization: Bearer <token>" | jq

# Set a fecha
curl -s -X PUT http://localhost:8000/api/v1/settings/fechas-envio-base \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fechas": {"2025-12 EJECUTADOS": "2026-01-15"}}' | jq

# Get ejecucion stats
curl -s "http://localhost:8000/api/v1/nuevas-conexiones/dashboard/ejecucion-stats?base=2025-12%20EJECUTADOS" \
  -H "Authorization: Bearer <token>" | jq
```

**Step 3: Test frontend**

- Go to Configuracion page, verify new "Fechas de Envio de Base" section appears
- Set a date for a base, save
- Go to Nuevas Conexiones dashboard, verify the Avance card shows dias + projection
- Test with base at 100% completion

**Step 4: Commit final adjustments if any**
