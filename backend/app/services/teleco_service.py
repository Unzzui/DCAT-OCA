"""
Servicio de datos para el modulo de Telecomunicaciones.
Inspecciones de factibilidad para instalaciones en postes.
"""

import pandas as pd
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

# Global dataframe cache
_df_teleco_cache: Optional[pd.DataFrame] = None

# Meta de aprobacion
META_APROBACION = 50


def load_teleco_data(force_reload: bool = False) -> pd.DataFrame:
    """Load CSV data for Telecomunicaciones into a pandas DataFrame with caching."""
    global _df_teleco_cache

    if _df_teleco_cache is not None and not force_reload:
        return _df_teleco_cache

    base_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data"
    )

    csv_path = os.path.join(base_path, "informe_teleco.csv")

    if not os.path.exists(csv_path):
        print(f"Teleco CSV not found: {csv_path}")
        _df_teleco_cache = pd.DataFrame()
        return _df_teleco_cache

    df = pd.read_csv(csv_path, encoding='utf-8-sig', low_memory=False)
    print(f"Loaded Teleco: {len(df)} records")

    # Mapeo de columnas
    column_mapping = {
        'ID': 'id',
        'PAGO ERICK': 'pago',
        'Family Case Number': 'family_case',
        'Estado del Caso': 'estado_caso',
        'Cantidad de Postes': 'cantidad_postes',
        'Nombre de empresa / Cliente': 'empresa',
        'Comuna': 'comuna',
        'Fecha 1ra. Inspección': 'fecha_primera_inspeccion',
        'Fecha que se asignó': 'fecha_asignacion',
        'Fecha de inspección': 'fecha_inspeccion',
        'TIENE PLANO?': 'tiene_plano',
        'X': 'coord_x',
        'Y': 'coord_y',
        'RESULTADO (ERICK)': 'resultado',
        'Observación TERRENO': 'observacion',
        'INSPECTOR': 'inspector',
        'E. DE P.': 'etapa',
    }

    # Renombrar columnas que existen
    rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Buscar columna de numero de caso (tiene caracteres especiales)
    for col in df.columns:
        if 'mero de caso' in str(col).lower() or 'número' in str(col).lower():
            df = df.rename(columns={col: 'numero_caso'})
            break

    # Limpiar y normalizar datos
    if 'empresa' in df.columns:
        df['empresa'] = df['empresa'].fillna('').str.strip()
        # Simplificar nombres de empresas largas
        df['empresa_corta'] = df['empresa'].apply(lambda x:
            'ENTEL' if 'Telecomunicaciones' in str(x) else
            'UFINET' if 'Ufinet' in str(x) else
            'WOM' if 'WOM' in str(x) else
            'QMC' if 'QMC' in str(x) else
            'ATP' if 'ATP' in str(x) else
            'CIRION' if 'CIRION' in str(x) else
            str(x)[:20] if len(str(x)) > 20 else str(x)
        )

    if 'comuna' in df.columns:
        df['comuna'] = df['comuna'].fillna('').str.strip().str.upper()

    if 'inspector' in df.columns:
        df['inspector'] = df['inspector'].fillna('').str.strip().str.upper()

    if 'resultado' in df.columns:
        df['resultado'] = df['resultado'].fillna('').str.strip().str.upper()

    if 'tiene_plano' in df.columns:
        df['tiene_plano'] = df['tiene_plano'].fillna('').str.strip().str.upper()
        # Normalizar valores de tiene_plano
        df['tiene_plano_norm'] = df['tiene_plano'].apply(lambda x:
            'SI' if str(x).upper() == 'SI' else
            'NO' if str(x).upper() == 'NO' else
            'INCOMPLETO' if 'INCOMPLETO' in str(x).upper() else
            'PARCIAL' if 'DE' in str(x) else  # "2 de 6", "1 de 7", etc.
            'OTRO'
        )

    if 'estado_caso' in df.columns:
        df['estado_caso'] = df['estado_caso'].fillna('').str.strip()
        # Simplificar estados
        df['estado_simple'] = df['estado_caso'].apply(lambda x:
            'NEW FEASIBILITY' if 'New Feasibility' in str(x) else
            'IN PROGRESS' if 'In Progress' in str(x) else
            'OTRO'
        )

    # Limpiar cantidad de postes
    if 'cantidad_postes' in df.columns:
        df['cantidad_postes'] = pd.to_numeric(df['cantidad_postes'], errors='coerce').fillna(0).astype(int)

    # Parsear fechas
    date_cols = ['fecha_primera_inspeccion', 'fecha_asignacion', 'fecha_inspeccion']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')

    # Calcular dias desde asignacion hasta inspeccion
    if 'fecha_asignacion' in df.columns and 'fecha_inspeccion' in df.columns:
        df['dias_inspeccion'] = (df['fecha_inspeccion'] - df['fecha_asignacion']).dt.days

    # Agregar mes para agrupacion
    if 'fecha_inspeccion' in df.columns:
        df['mes'] = df['fecha_inspeccion'].dt.to_period('M').astype(str)

    _df_teleco_cache = df
    print(f"Total Teleco loaded: {len(df)} records")
    return df


def get_teleco_filtered_data(
    search: Optional[str] = None,
    empresa: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    resultado: Optional[str] = None,
    tiene_plano: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "fecha_inspeccion",
    order: str = "desc"
) -> Dict[str, Any]:
    """Get filtered and paginated Teleco data."""
    df = load_teleco_data()

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
        search_cols = ['empresa', 'comuna', 'inspector', 'observacion', 'numero_caso']
        for col in search_cols:
            if col in df.columns:
                search_mask |= df[col].astype(str).str.contains(search, case=False, na=False)
        mask &= search_mask

    if empresa and 'empresa_corta' in df.columns:
        mask &= df['empresa_corta'].str.upper() == empresa.upper()

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if inspector and 'inspector' in df.columns:
        mask &= df['inspector'].str.contains(inspector, case=False, na=False)

    if resultado and 'resultado' in df.columns:
        mask &= df['resultado'].str.upper() == resultado.upper()

    if tiene_plano and 'tiene_plano_norm' in df.columns:
        mask &= df['tiene_plano_norm'].str.upper() == tiene_plano.upper()

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

    # Seleccionar columnas para la respuesta
    output_cols = ['id', 'numero_caso', 'family_case', 'empresa_corta', 'comuna',
                   'cantidad_postes', 'fecha_inspeccion', 'resultado', 'tiene_plano_norm',
                   'inspector', 'observacion', 'estado_simple']
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


def get_teleco_stats(
    empresa: Optional[str] = None,
    comuna: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
) -> Dict[str, Any]:
    """Get aggregated statistics for Telecomunicaciones."""
    df = load_teleco_data()

    empty_response = {
        "total": 0,
        "aprobados": 0,
        "rechazados": 0,
        "tasa_aprobacion": 0,
        "total_postes": 0,
        "promedio_postes": 0,
        "con_plano": 0,
        "sin_plano": 0,
        "plano_incompleto": 0,
        "por_empresa": [],
        "por_comuna": [],
        "por_inspector": [],
        "por_resultado": {},
        "por_mes": [],
        "por_tiene_plano": [],
        "evolucion_mensual": [],
        "comparativas": {
            "aprobacion": {"actual": 0, "anterior": 0, "diferencia": 0},
        },
        "insights": [],
    }

    if df.empty:
        return empty_response

    # Apply filters
    mask = pd.Series([True] * len(df))

    if empresa and 'empresa_corta' in df.columns:
        mask &= df['empresa_corta'].str.upper() == empresa.upper()

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if fecha_desde and 'fecha_inspeccion' in df.columns:
        mask &= df['fecha_inspeccion'] >= pd.to_datetime(fecha_desde)

    if fecha_hasta and 'fecha_inspeccion' in df.columns:
        mask &= df['fecha_inspeccion'] <= pd.to_datetime(fecha_hasta)

    df = df[mask].copy()

    if df.empty:
        return empty_response

    total = len(df)

    # Aprobados vs Rechazados
    aprobados = 0
    rechazados = 0
    if 'resultado' in df.columns:
        aprobados = int(len(df[df['resultado'] == 'APROBADO']))
        rechazados = int(len(df[df['resultado'] == 'RECHAZADO']))

    total_con_resultado = aprobados + rechazados
    tasa_aprobacion = round((aprobados / total_con_resultado * 100), 1) if total_con_resultado > 0 else 0

    # Postes
    total_postes = 0
    promedio_postes = 0
    if 'cantidad_postes' in df.columns:
        total_postes = int(df['cantidad_postes'].sum())
        promedio_postes = round(df['cantidad_postes'].mean(), 1)

    # Tiene Plano
    con_plano = 0
    sin_plano = 0
    plano_incompleto = 0
    if 'tiene_plano_norm' in df.columns:
        con_plano = int(len(df[df['tiene_plano_norm'] == 'SI']))
        sin_plano = int(len(df[df['tiene_plano_norm'] == 'NO']))
        plano_incompleto = int(len(df[df['tiene_plano_norm'].isin(['INCOMPLETO', 'PARCIAL'])]))

    # Por Empresa
    por_empresa = []
    if 'empresa_corta' in df.columns:
        empresas = df['empresa_corta'].value_counts().head(10)
        for emp, count in empresas.items():
            if emp and emp.strip():
                emp_df = df[df['empresa_corta'] == emp]
                aprobados_emp = len(emp_df[emp_df['resultado'] == 'APROBADO'])
                tasa = round((aprobados_emp / count * 100), 1) if count > 0 else 0
                postes_emp = int(emp_df['cantidad_postes'].sum()) if 'cantidad_postes' in emp_df.columns else 0
                por_empresa.append({
                    "empresa": emp,
                    "cantidad": int(count),
                    "aprobados": int(aprobados_emp),
                    "tasa_aprobacion": tasa,
                    "postes": postes_emp
                })

    # Por Comuna
    por_comuna = []
    if 'comuna' in df.columns:
        comunas = df[df['comuna'] != '']['comuna'].value_counts().head(15)
        for com, count in comunas.items():
            por_comuna.append({"comuna": com, "cantidad": int(count)})

    # Por Inspector
    por_inspector = []
    if 'inspector' in df.columns:
        df_insp = df[df['inspector'] != '']
        inspector_counts = df_insp['inspector'].value_counts()
        for inspector, count in inspector_counts.items():
            if inspector and inspector.strip():
                inspector_df = df_insp[df_insp['inspector'] == inspector]
                aprobados_insp = len(inspector_df[inspector_df['resultado'] == 'APROBADO'])
                tasa = round((aprobados_insp / count * 100), 1) if count > 0 else 0
                postes_insp = int(inspector_df['cantidad_postes'].sum()) if 'cantidad_postes' in inspector_df.columns else 0
                por_inspector.append({
                    "inspector": inspector,
                    "cantidad": int(count),
                    "aprobados": int(aprobados_insp),
                    "tasa_aprobacion": tasa,
                    "postes": postes_insp
                })

    # Por Resultado
    por_resultado = {}
    if 'resultado' in df.columns:
        resultados = df['resultado'].value_counts()
        por_resultado = {str(k): int(v) for k, v in resultados.items() if k}

    # Por Tiene Plano
    por_tiene_plano = []
    if 'tiene_plano_norm' in df.columns:
        planos = df['tiene_plano_norm'].value_counts()
        for p, c in planos.items():
            if p:
                por_tiene_plano.append({"tipo": p, "cantidad": int(c)})

    # Por Mes
    por_mes = []
    if 'mes' in df.columns:
        meses = df[df['mes'].notna()]['mes'].value_counts().sort_index()
        for mes, count in meses.items():
            mes_df = df[df['mes'] == mes]
            aprobados_mes = len(mes_df[mes_df['resultado'] == 'APROBADO'])
            tasa_mes = round((aprobados_mes / count * 100), 1) if count > 0 else 0
            por_mes.append({
                "mes": str(mes),
                "cantidad": int(count),
                "aprobados": int(aprobados_mes),
                "tasa_aprobacion": tasa_mes
            })

    # Evolucion mensual (para grafico)
    evolucion_mensual = []
    if 'fecha_inspeccion' in df.columns:
        df_with_date = df[df['fecha_inspeccion'].notna()].copy()
        if not df_with_date.empty:
            df_with_date['periodo'] = df_with_date['fecha_inspeccion'].dt.to_period('M')
            monthly = df_with_date.groupby('periodo').agg({
                'id': 'count',
                'cantidad_postes': 'sum'
            }).reset_index()
            monthly.columns = ['periodo', 'casos', 'postes']

            for idx, row in monthly.iterrows():
                periodo_df = df_with_date[df_with_date['periodo'] == row['periodo']]
                aprobados_periodo = len(periodo_df[periodo_df['resultado'] == 'APROBADO'])
                monthly.at[idx, 'aprobados'] = int(aprobados_periodo)

            monthly['periodo'] = monthly['periodo'].astype(str)
            evolucion_mensual = monthly.tail(12).to_dict(orient='records')

    # Comparativas (primera vs segunda mitad del periodo)
    comparativas = {
        "aprobacion": {"actual": 0, "anterior": 0, "diferencia": 0},
    }

    if 'fecha_inspeccion' in df.columns and len(df) > 10:
        df_sorted = df[df['fecha_inspeccion'].notna()].sort_values('fecha_inspeccion')
        if len(df_sorted) > 10:
            mid = len(df_sorted) // 2
            primera_mitad = df_sorted.iloc[:mid]
            segunda_mitad = df_sorted.iloc[mid:]

            # Tasa de aprobacion
            if len(primera_mitad) > 0 and len(segunda_mitad) > 0:
                aprobados_ant = len(primera_mitad[primera_mitad['resultado'] == 'APROBADO'])
                aprobados_act = len(segunda_mitad[segunda_mitad['resultado'] == 'APROBADO'])
                tasa_ant = (aprobados_ant / len(primera_mitad) * 100) if len(primera_mitad) > 0 else 0
                tasa_act = (aprobados_act / len(segunda_mitad) * 100) if len(segunda_mitad) > 0 else 0
                comparativas["aprobacion"] = {
                    "actual": round(tasa_act, 1),
                    "anterior": round(tasa_ant, 1),
                    "diferencia": round(tasa_act - tasa_ant, 1)
                }

    # Insights
    insights = []

    # Insight de tasa de aprobacion
    if tasa_aprobacion < META_APROBACION:
        insights.append({
            "tipo": "warning",
            "titulo": "Tasa de aprobacion baja",
            "mensaje": f"Solo {tasa_aprobacion}% de los casos fueron aprobados (meta: {META_APROBACION}%)"
        })
    elif tasa_aprobacion >= 60:
        insights.append({
            "tipo": "success",
            "titulo": "Buena tasa de aprobacion",
            "mensaje": f"{tasa_aprobacion}% de los casos fueron aprobados"
        })

    # Insight de rechazados
    if rechazados > aprobados:
        insights.append({
            "tipo": "warning",
            "titulo": "Mas rechazos que aprobaciones",
            "mensaje": f"{rechazados} rechazados vs {aprobados} aprobados"
        })

    # Insight de planos
    if sin_plano + plano_incompleto > con_plano * 0.2:
        insights.append({
            "tipo": "info",
            "titulo": "Casos sin plano completo",
            "mensaje": f"{sin_plano + plano_incompleto} casos sin plano o con plano incompleto"
        })

    # Insight de empresa principal
    if por_empresa:
        top_empresa = por_empresa[0]
        insights.append({
            "tipo": "info",
            "titulo": f"Principal cliente: {top_empresa['empresa']}",
            "mensaje": f"{top_empresa['cantidad']} casos ({top_empresa['postes']} postes)"
        })

    # Insight de postes
    if total_postes > 0:
        insights.append({
            "tipo": "info",
            "titulo": f"Total postes evaluados: {total_postes:,}",
            "mensaje": f"Promedio de {promedio_postes} postes por caso"
        })

    return {
        "total": total,
        "aprobados": aprobados,
        "rechazados": rechazados,
        "tasa_aprobacion": tasa_aprobacion,
        "total_postes": total_postes,
        "promedio_postes": promedio_postes,
        "con_plano": con_plano,
        "sin_plano": sin_plano,
        "plano_incompleto": plano_incompleto,
        "por_empresa": por_empresa,
        "por_comuna": por_comuna,
        "por_inspector": por_inspector,
        "por_resultado": por_resultado,
        "por_mes": por_mes,
        "por_tiene_plano": por_tiene_plano,
        "evolucion_mensual": evolucion_mensual,
        "comparativas": comparativas,
        "insights": insights,
    }


def get_teleco_empresas() -> List[str]:
    """Get list of unique empresas."""
    df = load_teleco_data()
    if 'empresa_corta' in df.columns:
        return sorted([e for e in df['empresa_corta'].dropna().unique().tolist() if e and e.strip()])
    return []


def get_teleco_comunas() -> List[str]:
    """Get list of unique comunas."""
    df = load_teleco_data()
    if 'comuna' in df.columns:
        return sorted([c for c in df['comuna'].dropna().unique().tolist() if c and c.strip()])
    return []


def get_teleco_inspectors() -> List[Dict[str, Any]]:
    """Get list of inspectors with their stats."""
    df = load_teleco_data()
    if 'inspector' not in df.columns:
        return []

    inspectors = []
    df_insp = df[df['inspector'] != '']
    inspector_counts = df_insp['inspector'].value_counts()

    for inspector, count in inspector_counts.items():
        if inspector and inspector.strip():
            inspector_df = df_insp[df_insp['inspector'] == inspector]
            aprobados = len(inspector_df[inspector_df['resultado'] == 'APROBADO'])
            tasa = round((aprobados / count * 100), 1) if count > 0 else 0
            postes = int(inspector_df['cantidad_postes'].sum()) if 'cantidad_postes' in inspector_df.columns else 0
            inspectors.append({
                "inspector": inspector,
                "cantidad": int(count),
                "aprobados": int(aprobados),
                "tasa_aprobacion": tasa,
                "postes": postes
            })

    return inspectors
