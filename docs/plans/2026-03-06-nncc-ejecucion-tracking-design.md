# NNCC Dias de Ejecucion Tracking — Design

## Problem
No hay forma de medir cuantos dias se demora la ejecucion de inspecciones de una base NNCC desde que se envia.

## Solution
1. En Configuracion, nuevo apartado para registrar la fecha de envio de cada base
2. En el dashboard, el card de Avance se enriquece con: dias transcurridos, promedio diario en habiles, y proyeccion de termino

## Data Model
- Reusar tabla `settings` con keys `nncc_fecha_envio_base:<base_name>` → valor fecha ISO `YYYY-MM-DD`
- Categoria: `nuevas_conexiones`

## Backend
- Nuevo endpoint `GET /api/v1/nuevas-conexiones/dashboard/ejecucion-stats?base=X`
- Lee fecha_envio de settings, consulta ultima fecha_inspeccion y total inspeccionadas de la base
- Calcula dias habiles transcurridos, promedio diario, pendientes, fecha proyectada
- Nuevo endpoint `GET /api/v1/settings/fechas-envio-base` para listar todas las fechas configuradas
- Nuevo endpoint `PUT /api/v1/settings/fechas-envio-base` para guardar batch

## Frontend — Configuracion
- Nuevo apartado "Fechas de Envio de Base" con date pickers por base
- Misma mecanica de guardar que settings existentes

## Frontend — Dashboard
- ProgressKpi de Avance se reemplaza por card enriquecido
- Muestra: avance %, dias transcurridos, promedio insp/dia habil, fecha proyectada
- Si no hay fecha configurada: solo avance como ahora
- Si avance = 100%: "Completado en X dias"

## Calculo de proyeccion
```
dias_habiles = contar lun-vie entre fecha_envio y (ultima_inspeccion si 100%, sino hoy)
promedio_diario = total_inspeccionadas / dias_habiles
pendientes = total_asignadas - total_inspeccionadas
dias_restantes = ceil(pendientes / promedio_diario)
fecha_proyectada = hoy + dias_restantes (saltando sabados/domingos)
```
