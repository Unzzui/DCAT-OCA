import pandas as pd
import os
from typing import Optional, Dict, Any, List
from datetime import datetime
from ..core.config import settings

# Global dataframe cache
_df_cache: Optional[pd.DataFrame] = None

# Precio por inspección (CLP)
PRECIO_INSPECCION = 3000


def load_data(force_reload: bool = False) -> pd.DataFrame:
    global _df_cache

    if _df_cache is not None and not force_reload:
        return _df_cache

    # Archivo NNCC
    csv_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data",
        "2025-05 INFORME NNCC (2024-2029) DIC 2025.csv"
    )

    if not os.path.exists(csv_path):
        # Create empty dataframe with expected columns
        _df_cache = pd.DataFrame(columns=[
            "id", "vta", "cliente", "nombre_cliente", "direccion", "comuna",
            "tarifa", "zona", "base", "n_medidor", "estado_efectividad",
            "resultado_inspeccion", "multa", "observaciones_multa",
            "fecha_inspeccion", "inspector", "estado_contratista",
            "resultado_normalizacion", "cumple_norma_cc", "cliente_conforme",
            "estado_empalme"
        ])
        return _df_cache

    print(f"Loading data from: {csv_path}")
    df = pd.read_csv(csv_path, encoding='utf-8', low_memory=False)

    # Standardize column names for easier access
    column_mapping = {
        "VTA": "vta",
        "Cliente": "cliente",
        "Nombre cliente": "nombre_cliente",
        "Dirección": "direccion",
        "Comuna": "comuna",
        "TARIFA": "tarifa",
        "ZONA": "zona",
        "BASE": "base",
        "N° MEDIDOR": "n_medidor",
        "ESTADO EFECTIVIDAD OCA": "estado_efectividad",
        "RESULTADO FINAL DE INSPCCION": "resultado_inspeccion",
        "MULTA SI/NO": "multa",
        "OBSERVACIONES DE MULTA": "observaciones_multa",
        "FECHA INSPECCIÓN": "fecha_inspeccion",
        "Inspector3": "inspector",
        "ESTADO CONTRATISTA": "estado_contratista",
        "RESULTADO FINAL DE REVISIÓN DE NORMALIZACIÓN": "resultado_normalizacion",
        "CUMPLE NORMA CODIGO COLORES": "cumple_norma_cc",
        "CLIENTE CONFORME": "cliente_conforme",
        "ESTADO DEL EMPALME": "estado_empalme",
        "TIPO INSPECCIÓN": "tipo_inspeccion",
        "VOLTAJE": "voltaje",
    }

    # Rename columns that exist
    rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Parse dates
    if "fecha_inspeccion" in df.columns:
        df["fecha_inspeccion"] = pd.to_datetime(df["fecha_inspeccion"], errors='coerce')

    # Normalizar inspector (Title Case)
    if "inspector" in df.columns:
        df["inspector"] = df["inspector"].fillna("").str.strip().str.title()

    # Add id if not present
    if 'id' not in df.columns:
        df['id'] = range(1, len(df) + 1)

    # Convertir cliente a string
    if 'cliente' in df.columns:
        df['cliente'] = df['cliente'].astype(str).str.replace('.0', '', regex=False)

    _df_cache = df
    print(f"Loaded {len(df)} records")
    return df


def get_filtered_data(
    search: Optional[str] = None,
    zona: Optional[str] = None,
    inspector: Optional[str] = None,
    estado: Optional[str] = None,
    comuna: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    base: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "fecha_inspeccion",
    order: str = "desc"
) -> Dict[str, Any]:
    df = load_data()

    if df.empty:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "pages": 0
        }

    # Apply filters
    mask = pd.Series([True] * len(df))

    if search:
        search_mask = pd.Series([False] * len(df))
        search_cols = ['cliente', 'comuna', 'inspector', 'n_medidor', 'direccion']
        for col in search_cols:
            if col in df.columns:
                search_mask |= df[col].astype(str).str.contains(search, case=False, na=False)
        mask &= search_mask

    if zona and 'zona' in df.columns:
        mask &= df['zona'].str.upper() == zona.upper()

    if inspector and 'inspector' in df.columns:
        mask &= df['inspector'].str.contains(inspector, case=False, na=False)

    if estado and 'estado_efectividad' in df.columns:
        mask &= df['estado_efectividad'].str.contains(estado, case=False, na=False)

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if base and 'base' in df.columns:
        mask &= df['base'] == base

    if fecha_desde and 'fecha_inspeccion' in df.columns:
        mask &= df['fecha_inspeccion'] >= pd.to_datetime(fecha_desde)

    if fecha_hasta and 'fecha_inspeccion' in df.columns:
        mask &= df['fecha_inspeccion'] <= pd.to_datetime(fecha_hasta)

    filtered_df = df[mask].copy()

    # Sort
    if sort_by in filtered_df.columns:
        filtered_df = filtered_df.sort_values(
            by=sort_by,
            ascending=(order == "asc"),
            na_position='last'
        )

    # Paginate
    total = len(filtered_df)
    pages = (total + limit - 1) // limit
    start = (page - 1) * limit
    end = start + limit

    paginated_df = filtered_df.iloc[start:end]

    # Convert to dict
    items = paginated_df.to_dict(orient='records')

    # Format dates for JSON
    for item in items:
        for key, value in item.items():
            if isinstance(value, pd.Timestamp):
                item[key] = value.strftime('%Y-%m-%d') if pd.notna(value) else None
            elif pd.isna(value):
                item[key] = None

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


def get_stats(
    zona: Optional[str] = None,
    base: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> Dict[str, Any]:
    """Get aggregated statistics for NNCC inspections with optional filters."""
    df = load_data()

    empty_response = {
        "total": 0,
        "efectivas": 0,
        "no_efectivas": 0,
        "bien_ejecutados": 0,
        "mal_ejecutados": 0,
        "tasa_efectividad": 0,
        "por_zona": {},
        "por_inspector": [],
        "por_mes": [],
        "monto_estimado": 0,
        "con_multa": 0,
        "pendientes_normalizar": 0,
        # Client metrics
        "cliente_conforme": {"conforme": 0, "disconforme": 0, "sin_dato": 0, "sin_inspeccionar": 0},
        "estado_empalme": {},
        "cumple_norma_cc": {"cumple": 0, "no_cumple": 0, "sin_dato": 0, "sin_inspeccionar": 0},
        # Evolution data
        "evolucion_mensual": [],
        # Comparativas, insights, top comunas
        "comparativas": {
            "efectividad": {"actual": 0, "anterior": 0, "diferencia": 0},
            "bien_ejecutado": {"actual": 0, "anterior": 0, "diferencia": 0},
            "conformidad": {"actual": 0, "anterior": 0, "diferencia": 0},
            "cumple_norma_cc": {"actual": 0, "anterior": 0, "diferencia": 0},
        },
        "top_comunas_problemas": [],
        "insights": [],
    }

    if df.empty:
        return empty_response

    # Apply filters
    mask = pd.Series([True] * len(df))

    if zona and 'zona' in df.columns:
        mask &= df['zona'].str.upper() == zona.upper()

    if base and 'base' in df.columns:
        mask &= df['base'] == base

    if fecha_desde and 'fecha_inspeccion' in df.columns:
        mask &= df['fecha_inspeccion'] >= pd.to_datetime(fecha_desde)

    if fecha_hasta and 'fecha_inspeccion' in df.columns:
        mask &= df['fecha_inspeccion'] <= pd.to_datetime(fecha_hasta)

    df = df[mask].copy()

    if df.empty:
        return empty_response

    # Efectividad
    efectivas = 0
    no_efectivas = 0
    if 'estado_efectividad' in df.columns:
        efectivas = len(df[df['estado_efectividad'].str.contains('EFECTIVA', case=False, na=False) &
                          ~df['estado_efectividad'].str.contains('NO EFECTIVA', case=False, na=False)])
        no_efectivas = len(df[df['estado_efectividad'].str.contains('NO EFECTIVA', case=False, na=False)])

    # Resultado inspección
    bien_ejecutados = 0
    mal_ejecutados = 0
    if 'resultado_inspeccion' in df.columns:
        bien_ejecutados = len(df[df['resultado_inspeccion'].str.contains('BIEN', case=False, na=False)])
        mal_ejecutados = len(df[df['resultado_inspeccion'].str.contains('MAL', case=False, na=False)])

    # Tasa de efectividad
    total = len(df)
    tasa_efectividad = (efectivas / total * 100) if total > 0 else 0

    # Por zona
    por_zona = {}
    if 'zona' in df.columns:
        por_zona = df['zona'].value_counts().to_dict()

    # Por inspector (top 10)
    por_inspector = []
    if 'inspector' in df.columns:
        inspector_counts = df['inspector'].value_counts().head(10)
        for inspector, count in inspector_counts.items():
            if inspector and inspector.strip():
                inspector_df = df[df['inspector'] == inspector]
                efectivas_insp = len(inspector_df[inspector_df['estado_efectividad'].str.contains('EFECTIVA', case=False, na=False) &
                                                   ~inspector_df['estado_efectividad'].str.contains('NO EFECTIVA', case=False, na=False)])
                tasa = (efectivas_insp / count * 100) if count > 0 else 0
                por_inspector.append({
                    "inspector": inspector,
                    "cantidad": int(count),
                    "efectividad": round(tasa, 1)
                })

    # Por mes
    por_mes = []
    if 'fecha_inspeccion' in df.columns:
        df_with_date = df[df['fecha_inspeccion'].notna()].copy()
        if not df_with_date.empty:
            df_with_date['mes'] = df_with_date['fecha_inspeccion'].dt.to_period('M')
            monthly = df_with_date.groupby('mes').agg({
                'id': 'count'
            }).reset_index()
            monthly.columns = ['mes', 'cantidad']
            monthly['mes'] = monthly['mes'].astype(str)

            # Calcular efectividad por mes
            for idx, row in monthly.iterrows():
                mes_df = df_with_date[df_with_date['mes'].astype(str) == row['mes']]
                efectivas_mes = len(mes_df[mes_df['estado_efectividad'].str.contains('EFECTIVA', case=False, na=False) &
                                           ~mes_df['estado_efectividad'].str.contains('NO EFECTIVA', case=False, na=False)])
                monthly.at[idx, 'efectividad'] = round((efectivas_mes / row['cantidad'] * 100), 1) if row['cantidad'] > 0 else 0

            por_mes = monthly.tail(12).to_dict(orient='records')

    # Monto estimado
    monto_estimado = total * PRECIO_INSPECCION

    # Con multa
    con_multa = 0
    if 'multa' in df.columns:
        con_multa = len(df[df['multa'].str.upper() == 'SI'])

    # Pendientes de normalizar
    pendientes_normalizar = 0
    if 'resultado_normalizacion' in df.columns:
        pendientes_normalizar = len(df[df['resultado_normalizacion'].str.contains('PENDIENTE', case=False, na=False)])

    # === CLIENT METRICS ===

    # Cliente conforme
    # Valores: "cliente conforme", "cliente disconforme", "S/N", "#N/D", vacío (sin inspeccionar)
    cliente_conforme = {"conforme": 0, "disconforme": 0, "sin_dato": 0, "sin_inspeccionar": 0}
    if 'cliente_conforme' in df.columns:
        col = df['cliente_conforme'].fillna('').str.upper().str.strip()
        cliente_conforme["conforme"] = int(len(df[col.str.contains('CONFORME', na=False) & ~col.str.contains('DISCONFORME', na=False)]))
        cliente_conforme["disconforme"] = int(len(df[col.str.contains('DISCONFORME', na=False)]))
        cliente_conforme["sin_dato"] = int(len(df[col.isin(['S/N', '#N/D', 'S/N ', '#N/D '])]))
        cliente_conforme["sin_inspeccionar"] = int(len(df[col == '']))

    # Estado empalme (breakdown by category)
    estado_empalme = {}
    if 'estado_empalme' in df.columns:
        # Reemplazar vacíos y valores nulos, normalizar texto
        col = df['estado_empalme'].fillna('').astype(str).str.strip().str.upper()

        # Normalizar valores
        def normalize_empalme(val):
            val = val.strip()
            if val == '' or val == 'NAN':
                return 'Sin Inspeccionar'
            if val in ['#N/D', 'S/N', '#N/A', 'N/A']:
                return 'Sin Dato'
            if val in ['BUENO', 'BUEN', 'BIEN']:
                return 'Bueno'
            if val in ['MALO', 'MAL']:
                return 'Malo'
            if val in ['REGULAR']:
                return 'Regular'
            # Si es un número, ignorar
            try:
                float(val.replace('.', '').replace(',', ''))
                return 'Sin Dato'
            except:
                pass
            # Capitalizar para consistencia
            return val.title()

        col = col.apply(normalize_empalme)
        counts = col.value_counts()
        estado_empalme = {str(k): int(v) for k, v in counts.items()}

    # Cumple norma código colores
    # Valores: "Cumple Norma CC", "No Cumple Norma CC", "S/N", "#N/D", vacío
    cumple_norma_cc = {"cumple": 0, "no_cumple": 0, "sin_dato": 0, "sin_inspeccionar": 0}
    if 'cumple_norma_cc' in df.columns:
        col = df['cumple_norma_cc'].fillna('').str.upper().str.strip()
        cumple_norma_cc["cumple"] = int(len(df[col.str.contains('CUMPLE', na=False) & ~col.str.contains('NO CUMPLE', na=False)]))
        cumple_norma_cc["no_cumple"] = int(len(df[col.str.contains('NO CUMPLE', na=False)]))
        cumple_norma_cc["sin_dato"] = int(len(df[col.isin(['S/N', '#N/D', 'S/N ', '#N/D '])]))
        cumple_norma_cc["sin_inspeccionar"] = int(len(df[col == '']))

    # === EVOLUTION DATA (monthly trends) ===
    evolucion_mensual = []
    if 'fecha_inspeccion' in df.columns:
        df_with_date = df[df['fecha_inspeccion'].notna()].copy()
        if not df_with_date.empty:
            df_with_date['mes'] = df_with_date['fecha_inspeccion'].dt.to_period('M')
            meses = sorted(df_with_date['mes'].unique())

            for mes in meses:
                mes_df = df_with_date[df_with_date['mes'] == mes]
                mes_total = len(mes_df)

                # Efectividad
                mes_efectivas = len(mes_df[mes_df['estado_efectividad'].str.contains('EFECTIVA', case=False, na=False) &
                                           ~mes_df['estado_efectividad'].str.contains('NO EFECTIVA', case=False, na=False)])
                tasa_efect = round((mes_efectivas / mes_total * 100), 1) if mes_total > 0 else 0

                # Bien ejecutados (sobre efectivas)
                mes_bien = 0
                if 'resultado_inspeccion' in mes_df.columns:
                    mes_bien = len(mes_df[mes_df['resultado_inspeccion'].str.contains('BIEN', case=False, na=False)])
                tasa_bien = round((mes_bien / mes_efectivas * 100), 1) if mes_efectivas > 0 else 0

                # Cliente conforme (sobre los que tienen respuesta)
                mes_conforme = 0
                mes_con_respuesta_cliente = 0
                if 'cliente_conforme' in mes_df.columns:
                    col_cc = mes_df['cliente_conforme'].fillna('').str.upper().str.strip()
                    mes_conforme = len(mes_df[col_cc.str.contains('CONFORME', na=False) & ~col_cc.str.contains('DISCONFORME', na=False)])
                    mes_disconforme = len(mes_df[col_cc.str.contains('DISCONFORME', na=False)])
                    mes_con_respuesta_cliente = mes_conforme + mes_disconforme
                tasa_conforme = round((mes_conforme / mes_con_respuesta_cliente * 100), 1) if mes_con_respuesta_cliente > 0 else 0

                # Cumple norma CC (sobre los que tienen respuesta)
                mes_cumple = 0
                mes_con_respuesta_cc = 0
                if 'cumple_norma_cc' in mes_df.columns:
                    col_ncc = mes_df['cumple_norma_cc'].fillna('').str.upper().str.strip()
                    mes_cumple = len(mes_df[col_ncc.str.contains('CUMPLE', na=False) & ~col_ncc.str.contains('NO CUMPLE', na=False)])
                    mes_no_cumple = len(mes_df[col_ncc.str.contains('NO CUMPLE', na=False)])
                    mes_con_respuesta_cc = mes_cumple + mes_no_cumple
                tasa_cumple_cc = round((mes_cumple / mes_con_respuesta_cc * 100), 1) if mes_con_respuesta_cc > 0 else 0

                evolucion_mensual.append({
                    "mes": str(mes),
                    "total": mes_total,
                    "efectivas": mes_efectivas,
                    "efectividad": tasa_efect,
                    "bien_ejecutados": mes_bien,
                    "tasa_bien_ejecutado": tasa_bien,
                    "cliente_conforme": mes_conforme,
                    "tasa_conformidad": tasa_conforme,
                    "cumple_norma_cc": mes_cumple,
                    "tasa_cumple_cc": tasa_cumple_cc,
                })

            # Keep last 12 months
            evolucion_mensual = evolucion_mensual[-12:]

    # === COMPARATIVAS (mes actual vs anterior) ===
    comparativas = {
        "efectividad": {"actual": 0, "anterior": 0, "diferencia": 0},
        "bien_ejecutado": {"actual": 0, "anterior": 0, "diferencia": 0},
        "conformidad": {"actual": 0, "anterior": 0, "diferencia": 0},
        "cumple_norma_cc": {"actual": 0, "anterior": 0, "diferencia": 0},
    }

    if len(evolucion_mensual) >= 2:
        actual = evolucion_mensual[-1]
        anterior = evolucion_mensual[-2]

        comparativas["efectividad"] = {
            "actual": actual["efectividad"],
            "anterior": anterior["efectividad"],
            "diferencia": round(actual["efectividad"] - anterior["efectividad"], 1)
        }
        comparativas["bien_ejecutado"] = {
            "actual": actual["tasa_bien_ejecutado"],
            "anterior": anterior["tasa_bien_ejecutado"],
            "diferencia": round(actual["tasa_bien_ejecutado"] - anterior["tasa_bien_ejecutado"], 1)
        }
        comparativas["conformidad"] = {
            "actual": actual["tasa_conformidad"],
            "anterior": anterior["tasa_conformidad"],
            "diferencia": round(actual["tasa_conformidad"] - anterior["tasa_conformidad"], 1)
        }
        comparativas["cumple_norma_cc"] = {
            "actual": actual["tasa_cumple_cc"],
            "anterior": anterior["tasa_cumple_cc"],
            "diferencia": round(actual["tasa_cumple_cc"] - anterior["tasa_cumple_cc"], 1)
        }
    elif len(evolucion_mensual) == 1:
        actual = evolucion_mensual[-1]
        comparativas["efectividad"]["actual"] = actual["efectividad"]
        comparativas["bien_ejecutado"]["actual"] = actual["tasa_bien_ejecutado"]
        comparativas["conformidad"]["actual"] = actual["tasa_conformidad"]
        comparativas["cumple_norma_cc"]["actual"] = actual["tasa_cumple_cc"]

    # === TOP 5 COMUNAS PROBLEMÁTICAS ===
    top_comunas_problemas = []
    if 'comuna' in df.columns and 'resultado_inspeccion' in df.columns:
        # Calcular métricas por comuna
        comunas_stats = []
        for comuna in df['comuna'].dropna().unique():
            comuna_df = df[df['comuna'] == comuna]
            comuna_total = len(comuna_df)

            if comuna_total < 5:  # Ignorar comunas con muy pocos datos
                continue

            # Mal ejecutados
            comuna_mal = len(comuna_df[comuna_df['resultado_inspeccion'].str.contains('MAL', case=False, na=False)])
            tasa_mal = round((comuna_mal / comuna_total * 100), 1) if comuna_total > 0 else 0

            # Disconformes
            comuna_disconf = 0
            if 'cliente_conforme' in comuna_df.columns:
                col_cc = comuna_df['cliente_conforme'].fillna('').str.upper().str.strip()
                comuna_disconf = len(comuna_df[col_cc.str.contains('DISCONFORME', na=False)])

            # No cumple norma
            comuna_no_cumple = 0
            if 'cumple_norma_cc' in comuna_df.columns:
                col_ncc = comuna_df['cumple_norma_cc'].fillna('').str.upper().str.strip()
                comuna_no_cumple = len(comuna_df[col_ncc.str.contains('NO CUMPLE', na=False)])

            # Score de problemas (ponderado)
            score_problemas = comuna_mal + comuna_disconf + comuna_no_cumple

            comunas_stats.append({
                "comuna": str(comuna),
                "total": comuna_total,
                "mal_ejecutados": comuna_mal,
                "tasa_mal_ejecutado": tasa_mal,
                "disconformes": comuna_disconf,
                "no_cumple_norma": comuna_no_cumple,
                "score_problemas": score_problemas
            })

        # Ordenar por score de problemas y tomar top 5
        comunas_stats.sort(key=lambda x: x["score_problemas"], reverse=True)
        top_comunas_problemas = comunas_stats[:5]

    # === INSIGHTS AUTOMÁTICOS ===
    insights = []

    # Insight de efectividad
    if tasa_efectividad < 95:
        insights.append({
            "tipo": "warning",
            "titulo": "Efectividad bajo meta",
            "mensaje": f"La efectividad actual ({round(tasa_efectividad, 1)}%) está por debajo de la meta del 95%"
        })
    elif tasa_efectividad >= 98:
        insights.append({
            "tipo": "success",
            "titulo": "Excelente efectividad",
            "mensaje": f"La efectividad actual ({round(tasa_efectividad, 1)}%) supera ampliamente la meta"
        })

    # Insight de tendencia
    if len(evolucion_mensual) >= 2:
        diff_efect = comparativas["efectividad"]["diferencia"]
        if diff_efect >= 3:
            insights.append({
                "tipo": "success",
                "titulo": "Tendencia positiva",
                "mensaje": f"La efectividad mejoró {diff_efect}% respecto al mes anterior"
            })
        elif diff_efect <= -3:
            insights.append({
                "tipo": "warning",
                "titulo": "Tendencia negativa",
                "mensaje": f"La efectividad cayó {abs(diff_efect)}% respecto al mes anterior"
            })

    # Insight de conformidad
    total_con_respuesta = cliente_conforme["conforme"] + cliente_conforme["disconforme"]
    if total_con_respuesta > 0:
        tasa_conf = (cliente_conforme["conforme"] / total_con_respuesta * 100)
        if tasa_conf < 90:
            insights.append({
                "tipo": "warning",
                "titulo": "Atención en satisfacción",
                "mensaje": f"Solo {round(tasa_conf, 1)}% de clientes están conformes"
            })

    # Insight de comunas problemáticas
    if top_comunas_problemas and top_comunas_problemas[0]["score_problemas"] > 10:
        top_comuna = top_comunas_problemas[0]
        insights.append({
            "tipo": "info",
            "titulo": "Comuna con más incidencias",
            "mensaje": f"{top_comuna['comuna']} concentra {top_comuna['mal_ejecutados']} trabajos mal ejecutados"
        })

    # Insight de zonas (si no hay filtro de zona)
    if not zona and por_zona:
        zona_max = max(por_zona.items(), key=lambda x: x[1])
        zona_min = min(por_zona.items(), key=lambda x: x[1])
        if zona_max[1] > zona_min[1] * 2:
            insights.append({
                "tipo": "info",
                "titulo": "Distribución desigual",
                "mensaje": f"Zona {zona_max[0]} tiene {zona_max[1]} inspecciones vs {zona_min[1]} en {zona_min[0]}"
            })

    return {
        "total": total,
        "efectivas": efectivas,
        "no_efectivas": no_efectivas,
        "bien_ejecutados": bien_ejecutados,
        "mal_ejecutados": mal_ejecutados,
        "tasa_efectividad": round(tasa_efectividad, 1),
        "por_zona": por_zona,
        "por_inspector": por_inspector,
        "por_mes": por_mes,
        "monto_estimado": monto_estimado,
        "con_multa": con_multa,
        "pendientes_normalizar": pendientes_normalizar,
        # Client metrics
        "cliente_conforme": cliente_conforme,
        "estado_empalme": estado_empalme,
        "cumple_norma_cc": cumple_norma_cc,
        # Evolution data
        "evolucion_mensual": evolucion_mensual,
        # New: Comparativas, insights, top comunas
        "comparativas": comparativas,
        "top_comunas_problemas": top_comunas_problemas,
        "insights": insights,
    }


def get_comunas() -> List[str]:
    """Get list of unique comunas."""
    df = load_data()
    if 'comuna' in df.columns:
        return sorted(df['comuna'].dropna().unique().tolist())
    return []


def get_zonas() -> List[str]:
    """Get list of unique zonas."""
    df = load_data()
    if 'zona' in df.columns:
        return sorted(df['zona'].dropna().unique().tolist())
    return []


def get_inspectors() -> List[Dict[str, Any]]:
    """Get list of inspectors with their stats."""
    df = load_data()
    if 'inspector' not in df.columns:
        return []

    inspectors = []
    inspector_counts = df['inspector'].value_counts()

    for inspector, count in inspector_counts.items():
        if inspector and inspector.strip():
            inspector_df = df[df['inspector'] == inspector]
            efectivas_insp = len(inspector_df[inspector_df['estado_efectividad'].str.contains('EFECTIVA', case=False, na=False) &
                                               ~inspector_df['estado_efectividad'].str.contains('NO EFECTIVA', case=False, na=False)])
            tasa = (efectivas_insp / count * 100) if count > 0 else 0
            inspectors.append({
                "inspector": inspector,
                "cantidad": int(count),
                "efectividad": round(tasa, 1)
            })

    return inspectors


def get_bases() -> List[str]:
    """Get list of unique bases."""
    df = load_data()
    if 'base' in df.columns:
        return sorted(df['base'].dropna().unique().tolist(), reverse=True)
    return []
