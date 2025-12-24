"""
Servicio de datos para el modulo de Lecturas.
Combina datos de ORDENES y SEC.
"""

import pandas as pd
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

# Global dataframe cache
_df_lecturas_cache: Optional[pd.DataFrame] = None

# Meta de cumplimiento de plazos
META_CUMPLIMIENTO_PLAZO = 90


def load_lecturas_data(force_reload: bool = False) -> pd.DataFrame:
    """Load CSV data for Lecturas into a pandas DataFrame with caching."""
    global _df_lecturas_cache

    if _df_lecturas_cache is not None and not force_reload:
        return _df_lecturas_cache

    base_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data"
    )

    # Archivos de lecturas
    ordenes_path = os.path.join(base_path, "informe_lectura_ORDENES_ORDENES.csv")
    sec_path = os.path.join(base_path, "informe_lectura_SEC_SEC.csv")
    virtual_visit_path = os.path.join(base_path, "informe_lectura_VIRTUAL_VIRTUAL VISIT.csv")
    visita_virtual_path = os.path.join(base_path, "informe_lectura_VIRTUAL_VISITA VIRTUAL.csv")

    dfs = []

    # Cargar ORDENES
    if os.path.exists(ordenes_path):
        df_ordenes = pd.read_csv(ordenes_path, encoding='utf-8', low_memory=False)
        df_ordenes['origen'] = 'ORDENES'
        dfs.append(df_ordenes)
        print(f"Loaded ORDENES: {len(df_ordenes)} records")

    # Cargar SEC
    if os.path.exists(sec_path):
        df_sec = pd.read_csv(sec_path, encoding='utf-8', low_memory=False)
        df_sec['origen'] = 'SEC'
        dfs.append(df_sec)
        print(f"Loaded SEC: {len(df_sec)} records")

    # Cargar VIRTUAL VISIT
    if os.path.exists(virtual_visit_path):
        df_vv = pd.read_csv(virtual_visit_path, encoding='utf-8', low_memory=False)
        df_vv['origen'] = 'VISITA VIRTUAL'
        dfs.append(df_vv)
        print(f"Loaded VIRTUAL VISIT: {len(df_vv)} records")

    # Cargar VISITA VIRTUAL
    if os.path.exists(visita_virtual_path):
        df_visita = pd.read_csv(visita_virtual_path, encoding='utf-8', low_memory=False)
        df_visita['origen'] = 'VISITA VIRTUAL'
        dfs.append(df_visita)
        print(f"Loaded VISITA VIRTUAL: {len(df_visita)} records")

    if not dfs:
        print("No data files found for Lecturas")
        _df_lecturas_cache = pd.DataFrame()
        return _df_lecturas_cache

    # Combinar DataFrames
    df = pd.concat(dfs, ignore_index=True)

    # Mapeo de columnas
    column_mapping = {
        'CANTIDAD': 'cantidad',
        'Caso': 'caso',
        'Fono Contacto': 'fono_contacto',
        'Orden': 'orden',
        'Cliente': 'cliente',
        'Fecha Ingreso': 'fecha_ingreso',
        'Observaciones del Caso': 'observaciones_caso',
        'Task': 'task',
        'Submotivo': 'submotivo',
        'Canal Entrada': 'canal_entrada',
        'Sector': 'sector_original',
        'Zona': 'zona',
        'Ruta': 'ruta',
        'Ruta de Lectura': 'ruta_lectura',
        'Medidor': 'medidor',
        'Marca': 'marca',
        'Constante': 'constante',
        'Tarifa': 'tarifa',
        'Nombre': 'nombre',
        'Direccion': 'direccion',
        'Comuna': 'comuna',
        'SECTOR': 'sector',
        'INSPECTOR': 'inspector',
        'Tipo Medida': 'tipo_medida',
        'FECHA DE RECEPCION Y SALIDA A TERRENO': 'fecha_recepcion_terreno',
        'FECHA DE VENCIMIENTO': 'fecha_vencimiento',
        'OBSERVACION': 'observacion',
        'FECHA INSP': 'fecha_inspeccion',
        'LECTURA': 'lectura',
        'HALLAZGO': 'hallazgo',
        'BAREMO': 'baremo',
        'ESTADO GENERAL': 'estado_general',
        'ESTADO': 'estado_plazo',
        'Fecha de respuesta': 'fecha_respuesta',
        'Rol Responsable': 'rol_responsable',
    }

    # Renombrar columnas que existen
    rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Manejar columna GESTION
    gestion_cols = [col for col in df.columns if 'GESTI' in str(col).upper()]
    if gestion_cols:
        df = df.rename(columns={gestion_cols[0]: 'gestion'})
        for col in gestion_cols[1:]:
            if col in df.columns:
                df = df.drop(columns=[col])

    # Agregar ID
    df['id'] = range(1, len(df) + 1)

    # Limpiar y normalizar datos
    if 'cliente' in df.columns:
        df['cliente'] = df['cliente'].astype(str).str.replace('.0', '', regex=False)

    if 'inspector' in df.columns:
        df['inspector'] = df['inspector'].fillna('').str.strip().str.title()

    if 'hallazgo' in df.columns:
        df['hallazgo'] = df['hallazgo'].fillna('').str.strip().str.upper()

    if 'estado_plazo' in df.columns:
        df['estado_plazo'] = df['estado_plazo'].fillna('').str.strip()

    if 'estado_general' in df.columns:
        df['estado_general'] = df['estado_general'].fillna('').str.strip().str.upper()

    if 'sector' in df.columns:
        df['sector'] = df['sector'].fillna('').str.strip().str.upper()

    if 'comuna' in df.columns:
        df['comuna'] = df['comuna'].fillna('').str.strip().str.upper()

    if 'submotivo' in df.columns:
        df['submotivo'] = df['submotivo'].fillna('').str.strip()

    if 'canal_entrada' in df.columns:
        df['canal_entrada'] = df['canal_entrada'].fillna('').str.strip()

    if 'gestion' in df.columns:
        df['gestion'] = df['gestion'].fillna('').str.strip().str.upper()

    # Parsear fechas
    date_cols = ['fecha_ingreso', 'fecha_respuesta', 'fecha_inspeccion', 'fecha_vencimiento']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')

    # Calcular dias de respuesta
    if 'fecha_ingreso' in df.columns and 'fecha_respuesta' in df.columns:
        df['dias_respuesta'] = (df['fecha_respuesta'] - df['fecha_ingreso']).dt.days

    # Marcar si esta inspeccionado
    if 'fecha_inspeccion' in df.columns:
        df['inspeccionado'] = df['fecha_inspeccion'].notna()

    _df_lecturas_cache = df
    print(f"Total Lecturas loaded: {len(df)} records")
    return df


def get_lecturas_filtered_data(
    search: Optional[str] = None,
    sector: Optional[str] = None,
    inspector: Optional[str] = None,
    estado_plazo: Optional[str] = None,
    hallazgo: Optional[str] = None,
    origen: Optional[str] = None,
    comuna: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "fecha_ingreso",
    order: str = "desc"
) -> Dict[str, Any]:
    """Get filtered and paginated Lecturas data."""
    df = load_lecturas_data()

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
        search_cols = ['cliente', 'nombre', 'comuna', 'inspector', 'medidor', 'direccion', 'orden']
        for col in search_cols:
            if col in df.columns:
                search_mask |= df[col].astype(str).str.contains(search, case=False, na=False)
        mask &= search_mask

    if sector and 'sector' in df.columns:
        mask &= df['sector'].str.upper() == sector.upper()

    if inspector and 'inspector' in df.columns:
        mask &= df['inspector'].str.contains(inspector, case=False, na=False)

    if estado_plazo and 'estado_plazo' in df.columns:
        mask &= df['estado_plazo'].str.contains(estado_plazo, case=False, na=False)

    if hallazgo and 'hallazgo' in df.columns:
        mask &= df['hallazgo'].str.contains(hallazgo, case=False, na=False)

    if origen and 'origen' in df.columns:
        mask &= df['origen'].str.upper() == origen.upper()

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if fecha_desde and 'fecha_ingreso' in df.columns:
        mask &= df['fecha_ingreso'] >= pd.to_datetime(fecha_desde)

    if fecha_hasta and 'fecha_ingreso' in df.columns:
        mask &= df['fecha_ingreso'] <= pd.to_datetime(fecha_hasta)

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

    # Seleccionar columnas para la respuesta
    output_cols = ['id', 'orden', 'cliente', 'nombre', 'direccion', 'comuna', 'sector',
                   'inspector', 'fecha_ingreso', 'fecha_inspeccion', 'fecha_respuesta',
                   'hallazgo', 'estado_general', 'estado_plazo', 'submotivo',
                   'canal_entrada', 'gestion', 'origen', 'dias_respuesta']
    output_cols = [c for c in output_cols if c in paginated_df.columns]

    items = paginated_df[output_cols].to_dict(orient='records')

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


def get_lecturas_stats(
    sector: Optional[str] = None,
    origen: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> Dict[str, Any]:
    """Get aggregated statistics for Lecturas."""
    df = load_lecturas_data()

    empty_response = {
        "total": 0,
        "inspeccionadas": 0,
        "pendientes": 0,
        "tasa_inspeccion": 0,
        "en_plazo": 0,
        "fuera_plazo": 0,
        "tasa_cumplimiento_plazo": 0,
        "dias_respuesta_promedio": 0,
        "dias_respuesta_min": 0,
        "dias_respuesta_max": 0,
        "por_hallazgo": [],
        "por_estado_general": [],
        "por_inspector": [],
        "por_sector": {},
        "por_origen": {},
        "por_canal": [],
        "por_submotivo": [],
        "por_gestion": [],
        "evolucion_diaria": [],
        "comparativas": {
            "inspeccion": {"actual": 0, "anterior": 0, "diferencia": 0},
            "cumplimiento_plazo": {"actual": 0, "anterior": 0, "diferencia": 0},
        },
        "insights": [],
    }

    if df.empty:
        return empty_response

    # Apply filters
    mask = pd.Series([True] * len(df))

    if sector and 'sector' in df.columns:
        mask &= df['sector'].str.upper() == sector.upper()

    if origen and 'origen' in df.columns:
        mask &= df['origen'].str.upper() == origen.upper()

    if fecha_desde and 'fecha_ingreso' in df.columns:
        mask &= df['fecha_ingreso'] >= pd.to_datetime(fecha_desde)

    if fecha_hasta and 'fecha_ingreso' in df.columns:
        mask &= df['fecha_ingreso'] <= pd.to_datetime(fecha_hasta)

    df = df[mask].copy()

    if df.empty:
        return empty_response

    total = len(df)

    # Inspeccionadas vs Pendientes
    inspeccionadas = 0
    pendientes = 0
    if 'inspeccionado' in df.columns:
        inspeccionadas = int(df['inspeccionado'].sum())
        pendientes = total - inspeccionadas
    elif 'fecha_inspeccion' in df.columns:
        inspeccionadas = int(df['fecha_inspeccion'].notna().sum())
        pendientes = total - inspeccionadas

    tasa_inspeccion = round((inspeccionadas / total * 100), 1) if total > 0 else 0

    # Estado Plazo
    en_plazo = 0
    fuera_plazo = 0
    if 'estado_plazo' in df.columns:
        en_plazo = int(len(df[df['estado_plazo'].str.contains('En el Plazo', case=False, na=False)]))
        fuera_plazo = int(len(df[df['estado_plazo'].str.contains('Fuera', case=False, na=False)]))

    tasa_cumplimiento_plazo = round((en_plazo / total * 100), 1) if total > 0 else 0

    # Dias de respuesta
    dias_promedio = 0
    dias_min = 0
    dias_max = 0
    if 'dias_respuesta' in df.columns:
        dias_validos = df['dias_respuesta'].dropna()
        if len(dias_validos) > 0:
            dias_promedio = round(dias_validos.mean(), 1)
            dias_min = int(dias_validos.min())
            dias_max = int(dias_validos.max())

    # Por Hallazgo
    por_hallazgo = []
    if 'hallazgo' in df.columns:
        hallazgos = df[df['hallazgo'] != '']['hallazgo'].value_counts()
        for h, c in hallazgos.items():
            por_hallazgo.append({"hallazgo": h, "cantidad": int(c)})

    # Por Estado General
    por_estado_general = []
    if 'estado_general' in df.columns:
        estados = df[df['estado_general'] != '']['estado_general'].value_counts()
        for e, c in estados.items():
            por_estado_general.append({"estado": e, "cantidad": int(c)})

    # Por Inspector
    por_inspector = []
    if 'inspector' in df.columns:
        df_insp = df[df['inspector'] != '']
        inspector_counts = df_insp['inspector'].value_counts().head(10)
        for inspector, count in inspector_counts.items():
            inspector_df = df_insp[df_insp['inspector'] == inspector]
            en_plazo_insp = len(inspector_df[inspector_df['estado_plazo'].str.contains('En el Plazo', case=False, na=False)])
            tasa = round((en_plazo_insp / count * 100), 1) if count > 0 else 0
            por_inspector.append({
                "inspector": inspector,
                "cantidad": int(count),
                "en_plazo": int(en_plazo_insp),
                "tasa_cumplimiento": tasa
            })

    # Por Sector
    por_sector = {}
    if 'sector' in df.columns:
        sectores = df[df['sector'] != '']['sector'].value_counts()
        por_sector = {str(k): int(v) for k, v in sectores.items()}

    # Por Origen
    por_origen = {}
    if 'origen' in df.columns:
        origenes = df['origen'].value_counts()
        por_origen = {str(k): int(v) for k, v in origenes.items()}

    # Por Canal de Entrada
    por_canal = []
    if 'canal_entrada' in df.columns:
        canales = df[df['canal_entrada'] != '']['canal_entrada'].value_counts()
        for c, n in canales.items():
            por_canal.append({"canal": c, "cantidad": int(n)})

    # Por Submotivo
    por_submotivo = []
    if 'submotivo' in df.columns:
        submotivos = df[df['submotivo'] != '']['submotivo'].value_counts()
        for s, n in submotivos.items():
            por_submotivo.append({"submotivo": s, "cantidad": int(n)})

    # Por Gestion (solo SEC)
    por_gestion = []
    if 'gestion' in df.columns:
        gestiones = df[df['gestion'] != '']['gestion'].value_counts()
        for g, n in gestiones.items():
            por_gestion.append({"gestion": g, "cantidad": int(n)})

    # Evolucion diaria
    evolucion_diaria = []
    if 'fecha_ingreso' in df.columns:
        df_with_date = df[df['fecha_ingreso'].notna()].copy()
        if not df_with_date.empty:
            df_with_date['dia'] = df_with_date['fecha_ingreso'].dt.date
            daily = df_with_date.groupby('dia').agg({
                'id': 'count'
            }).reset_index()
            daily.columns = ['dia', 'total']

            # Calcular inspeccionadas por dia
            for idx, row in daily.iterrows():
                dia_df = df_with_date[df_with_date['dia'] == row['dia']]
                insp_dia = dia_df['fecha_inspeccion'].notna().sum() if 'fecha_inspeccion' in dia_df.columns else 0
                daily.at[idx, 'inspeccionadas'] = int(insp_dia)

            daily['dia'] = daily['dia'].astype(str)
            evolucion_diaria = daily.tail(30).to_dict(orient='records')

    # Comparativas (primera vs segunda mitad del periodo)
    comparativas = {
        "inspeccion": {"actual": 0, "anterior": 0, "diferencia": 0},
        "cumplimiento_plazo": {"actual": 0, "anterior": 0, "diferencia": 0},
    }

    if 'fecha_ingreso' in df.columns and len(df) > 10:
        df_sorted = df.sort_values('fecha_ingreso')
        mid = len(df_sorted) // 2
        primera_mitad = df_sorted.iloc[:mid]
        segunda_mitad = df_sorted.iloc[mid:]

        # Tasa de inspeccion
        if len(primera_mitad) > 0 and len(segunda_mitad) > 0:
            tasa_ant = (primera_mitad['fecha_inspeccion'].notna().sum() / len(primera_mitad) * 100) if 'fecha_inspeccion' in primera_mitad.columns else 0
            tasa_act = (segunda_mitad['fecha_inspeccion'].notna().sum() / len(segunda_mitad) * 100) if 'fecha_inspeccion' in segunda_mitad.columns else 0
            comparativas["inspeccion"] = {
                "actual": round(tasa_act, 1),
                "anterior": round(tasa_ant, 1),
                "diferencia": round(tasa_act - tasa_ant, 1)
            }

            # Tasa de cumplimiento de plazo
            if 'estado_plazo' in df.columns:
                plazo_ant = len(primera_mitad[primera_mitad['estado_plazo'].str.contains('En el Plazo', case=False, na=False)])
                plazo_act = len(segunda_mitad[segunda_mitad['estado_plazo'].str.contains('En el Plazo', case=False, na=False)])
                tasa_plazo_ant = (plazo_ant / len(primera_mitad) * 100)
                tasa_plazo_act = (plazo_act / len(segunda_mitad) * 100)
                comparativas["cumplimiento_plazo"] = {
                    "actual": round(tasa_plazo_act, 1),
                    "anterior": round(tasa_plazo_ant, 1),
                    "diferencia": round(tasa_plazo_act - tasa_plazo_ant, 1)
                }

    # Insights
    insights = []

    # Insight de cumplimiento de plazo
    if tasa_cumplimiento_plazo < META_CUMPLIMIENTO_PLAZO:
        insights.append({
            "tipo": "warning",
            "titulo": "Cumplimiento bajo meta",
            "mensaje": f"Solo {tasa_cumplimiento_plazo}% de las ordenes estan en plazo (meta: {META_CUMPLIMIENTO_PLAZO}%)"
        })

    # Insight de pendientes
    if pendientes > 0:
        pct_pendientes = round((pendientes / total * 100), 1)
        if pct_pendientes > 50:
            insights.append({
                "tipo": "warning",
                "titulo": "Alta cantidad de pendientes",
                "mensaje": f"{pendientes} ordenes ({pct_pendientes}%) aun no han sido inspeccionadas"
            })

    # Insight de hallazgo principal
    if por_hallazgo:
        top_hallazgo = por_hallazgo[0]
        if top_hallazgo["cantidad"] > 20:
            insights.append({
                "tipo": "info",
                "titulo": f"Hallazgo frecuente: {top_hallazgo['hallazgo']}",
                "mensaje": f"{top_hallazgo['cantidad']} casos con este hallazgo"
            })

    # Insight de dias de respuesta
    if dias_promedio > 5:
        insights.append({
            "tipo": "warning",
            "titulo": "Tiempo de respuesta alto",
            "mensaje": f"El promedio de dias de respuesta es {dias_promedio} dias"
        })
    elif dias_promedio > 0 and dias_promedio <= 3:
        insights.append({
            "tipo": "success",
            "titulo": "Buen tiempo de respuesta",
            "mensaje": f"Promedio de {dias_promedio} dias de respuesta"
        })

    return {
        "total": total,
        "inspeccionadas": inspeccionadas,
        "pendientes": pendientes,
        "tasa_inspeccion": tasa_inspeccion,
        "en_plazo": en_plazo,
        "fuera_plazo": fuera_plazo,
        "tasa_cumplimiento_plazo": tasa_cumplimiento_plazo,
        "dias_respuesta_promedio": dias_promedio,
        "dias_respuesta_min": dias_min,
        "dias_respuesta_max": dias_max,
        "por_hallazgo": por_hallazgo,
        "por_estado_general": por_estado_general,
        "por_inspector": por_inspector,
        "por_sector": por_sector,
        "por_origen": por_origen,
        "por_canal": por_canal,
        "por_submotivo": por_submotivo,
        "por_gestion": por_gestion,
        "evolucion_diaria": evolucion_diaria,
        "comparativas": comparativas,
        "insights": insights,
    }


def get_lecturas_sectores() -> List[str]:
    """Get list of unique sectores."""
    df = load_lecturas_data()
    if 'sector' in df.columns:
        return sorted([s for s in df['sector'].dropna().unique().tolist() if s])
    return []


def get_lecturas_inspectors() -> List[Dict[str, Any]]:
    """Get list of inspectors with their stats."""
    df = load_lecturas_data()
    if 'inspector' not in df.columns:
        return []

    inspectors = []
    df_insp = df[df['inspector'] != '']
    inspector_counts = df_insp['inspector'].value_counts()

    for inspector, count in inspector_counts.items():
        if inspector and inspector.strip():
            inspector_df = df_insp[df_insp['inspector'] == inspector]
            en_plazo = len(inspector_df[inspector_df['estado_plazo'].str.contains('En el Plazo', case=False, na=False)])
            tasa = round((en_plazo / count * 100), 1) if count > 0 else 0
            inspectors.append({
                "inspector": inspector,
                "cantidad": int(count),
                "tasa_cumplimiento": tasa
            })

    return inspectors


def get_lecturas_hallazgos() -> List[str]:
    """Get list of unique hallazgos."""
    df = load_lecturas_data()
    if 'hallazgo' in df.columns:
        return sorted([h for h in df['hallazgo'].dropna().unique().tolist() if h])
    return []


def get_lecturas_comunas() -> List[str]:
    """Get list of unique comunas."""
    df = load_lecturas_data()
    if 'comuna' in df.columns:
        return sorted([c for c in df['comuna'].dropna().unique().tolist() if c])
    return []
