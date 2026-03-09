# DCAT-OCA — Enel Dashboard

## Design Philosophy

**MANDATORY**: All UI work must follow `docs/DESIGN_PHILOSOPHY.md` — Minimalismo Ejecutivo de Alto Impacto.

Key rules:
- No emojis, no decorative icons, no elements without analytical function
- Sober palette: slate grays, steel blue (#4f6d7a), signal colors only for status (red=danger, green=success, amber=warning)
- Typography: Inter, sizes 10-11px for labels/tables, xl-2xl for KPIs, uppercase tracking-wider for section headers
- Cards: white bg, border-slate-200/60, shadow-sm, rounded-lg
- Charts: white tooltips, dashed grid lines #f1f5f9, no axis lines/ticks, labels 10-11px #64748b
- Tables: minimal borders (border-b border-slate-50), subtle hover
- When in doubt between adding or removing a visual element, remove it
- Must feel: executive, strategic, professional, controlled, premium

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tremor UI, Tailwind CSS, ECharts, Leaflet
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL
- **Key paths:**
  - Dashboard: `frontend/src/app/dashboard/nuevas-conexiones/`
  - Components: `frontend/src/app/dashboard/nuevas-conexiones/components/`
  - Chart theme: `frontend/src/app/dashboard/nuevas-conexiones/chart-theme.ts`
  - API client: `frontend/src/lib/api.ts`
  - Backend API: `backend/app/api/v1/nuevas_conexiones.py`
  - Dashboard service: `backend/app/services/nncc_dashboard_service.py`
  - Precalculation: `scripts/precalculate_nncc.py`

## Conventions

- Spanish for user-facing text (no tildes in code comments)
- English for code identifiers
- Pre-calculated stats stored in DB, fetched via dashboard service
- Client-side filtering for zona (backend returns all zona data)
- Chart theme constants in `chart-theme.ts` — always import from there
