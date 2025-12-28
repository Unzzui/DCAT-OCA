"""
Servicio de datos para el modulo de Corte y Reposicion.
Analiza inspecciones de calidad de cortes y reposiciones.
"""

import pandas as pd
import numpy as np
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

# Global dataframe cache
_df_corte_cache: Optional[pd.DataFrame] = None


def get_data_path() -> str:
    """Get the data directory path."""
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data"
    )


def load_corte_data(force_reload: bool = False) -> pd.DataFrame:
    """Load corte data from CSV."""
    global _df_corte_cache

    if _df_corte_cache is not None and not force_reload:
        return _df_corte_cache

    path = os.path.join(get_data_path(), "informe_corte.csv")

    if not os.path.exists(path):
        print(f"File not found: {path}")
        return pd.DataFrame()

    df = pd.read_csv(path, encoding='utf-8', low_memory=False)
    df['id'] = range(1, len(df) + 1)

    # Normalizar columnas
    df = normalize_columns(df)

    _df_corte_cache = df
    print(f"Loaded Corte data: {len(df)} records")
    return df


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names and values."""
    # Mapeo de columnas
    column_mapping = {
        'N': 'numero',
        'ASIGNADO': 'fecha_asignado',
        'VENCE': 'fecha_vence',
        'MES': 'mes_texto',
        'ESTADO': 'estado',
        'ACCION COBRO': 'accion_cobro',
        'EMPRESA': 'empresa',
        'CEN OPERATIVO': 'centro_operativo',
        'NRO SUMINISTRO': 'suministro',
        'NOMBRE': 'nombre_cliente',
        'DIRECCION': 'direccion',
        'COMUNA': 'comuna',
        'NRO APARATO': 'nro_medidor',
        'TIPO DE ORDEN': 'tipo_orden',
        'SITUACION A INSPECCIONAR': 'situacion_a_inspeccionar',
        'GIRO PROPIEDAD': 'giro',
        'ZONA': 'zona',
        'EMPRESA COLABORADORA': 'empresa_colaboradora',
        'SITUACION ENCONTRADA': 'situacion_encontrada',
        'SITUACIÓN DEJADA': 'situacion_dejada',
        'SI NO FUE CORTADO ¿ES FACTIBLE CORTAR?': 'es_factible_cortar',
        'SI LA ANTERIOR ES SI: ¿Dónde?': 'donde_factible',
        'NUMERO DE MEDIDOR': 'numero_medidor',
        'LECTURA': 'lectura',
        'TIPO EMPALME': 'tipo_empalme',
        'SI FUE CORTADO   ¿EJECUCIÓN DE CORTE?': 'ejecucion_corte',
        '¿HAY EVIDENCIA DE CORTE?': 'evidencia_corte',
        'MOTIVO MULTA': 'motivo_multa',
        'MULTA ': 'multa',
        'MULTA': 'multa',
        'DETALLE DE LA SITUACION ENCONTRADA O DEL RECLAMO': 'detalle',
        'RESPUESTA GESTION': 'respuesta_gestion',
        'NOMBRE DEL INSPECTOR': 'inspector',
        'FECHA INSPECCION': 'fecha_inspeccion',
        'EMPRESA COLABORADORA.1': 'empresa_oca',
        'NOMBRE ENCARGADO': 'encargado',
    }

    rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Normalizar valores de texto
    text_cols = ['estado', 'situacion_a_inspeccionar', 'situacion_encontrada',
                 'situacion_dejada', 'motivo_multa', 'multa', 'zona',
                 'centro_operativo', 'comuna', 'inspector', 'giro',
                 'tipo_empalme', 'es_factible_cortar', 'evidencia_corte',
                 'accion_cobro', 'respuesta_gestion']
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].fillna('').astype(str).str.strip().str.upper()

    # Parsear fechas
    date_cols = ['fecha_asignado', 'fecha_vence', 'fecha_inspeccion']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')

    # Extraer mes y anio de fecha_inspeccion
    if 'fecha_inspeccion' in df.columns:
        df['mes'] = df['fecha_inspeccion'].dt.month
        df['anio'] = df['fecha_inspeccion'].dt.year

    return df


def get_corte_stats(
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Get comprehensive statistics for Corte y Reposicion."""

    df = load_corte_data()

    empty_response = {
        "total": 0,
        "realizadas": 0,
        "pendientes": 0,
        "tasa_ejecucion": 0,
        "bien_ejecutados": 0,
        "no_ejecutados": 0,
        "tasa_calidad": 0,
        "con_multa": 0,
        "sin_multa": 0,
        "tasa_multa": 0,
        "factible_cortar": 0,
        "no_factible_cortar": 0,
        "por_situacion_encontrada": [],
        "por_situacion_a_inspeccionar": [],
        "por_zona": [],
        "por_centro_operativo": [],
        "por_comuna": [],
        "por_inspector": [],
        "por_giro": [],
        "por_tipo_empalme": [],
        "por_accion_cobro": [],
        "por_mes": [],
        "insights": [],
    }

    if df.empty:
        return empty_response

    # Aplicar filtros
    mask = pd.Series([True] * len(df))

    if zona and 'zona' in df.columns:
        mask &= df['zona'].str.upper() == zona.upper()

    if centro_operativo and 'centro_operativo' in df.columns:
        mask &= df['centro_operativo'].str.upper() == centro_operativo.upper()

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if inspector and 'inspector' in df.columns:
        mask &= df['inspector'].str.contains(inspector, case=False, na=False)

    if mes and 'mes' in df.columns:
        mask &= df['mes'] == mes

    if anio and 'anio' in df.columns:
        mask &= df['anio'] == anio

    df_filtered = df[mask].copy()

    if df_filtered.empty:
        return empty_response

    # Calcular totales
    total = len(df_filtered)

    # Realizadas vs Pendientes
    realizadas = len(df_filtered[df_filtered['estado'].str.contains('REALIZADA', case=False, na=False)])
    pendientes = total - realizadas
    tasa_ejecucion = round((realizadas / total * 100), 1) if total > 0 else 0

    # Bien ejecutados vs No ejecutados
    bien_ejecutados = len(df_filtered[df_filtered['motivo_multa'].str.contains('BIEN EJECUTADO', case=False, na=False)])
    no_ejecutados = len(df_filtered[df_filtered['motivo_multa'].str.contains('NO EJECUTADO', case=False, na=False)])
    tasa_calidad = round((bien_ejecutados / total * 100), 1) if total > 0 else 0

    # Multas
    con_multa = len(df_filtered[df_filtered['multa'].str.upper() == 'SI'])
    sin_multa = len(df_filtered[df_filtered['multa'].str.upper() == 'NO'])
    tasa_multa = round((con_multa / total * 100), 1) if total > 0 else 0

    # Factibilidad de corte
    factible_cortar = len(df_filtered[df_filtered['es_factible_cortar'].str.upper() == 'SI'])
    no_factible_cortar = len(df_filtered[df_filtered['es_factible_cortar'].str.upper() == 'NO'])

    # Por Situacion Encontrada
    por_situacion_encontrada = []
    if 'situacion_encontrada' in df_filtered.columns:
        situaciones = df_filtered[df_filtered['situacion_encontrada'] != '']['situacion_encontrada'].value_counts()
        for s, c in situaciones.items():
            por_situacion_encontrada.append({"situacion": s, "cantidad": int(c)})

    # Por Situacion a Inspeccionar
    por_situacion_a_inspeccionar = []
    if 'situacion_a_inspeccionar' in df_filtered.columns:
        situaciones = df_filtered[df_filtered['situacion_a_inspeccionar'] != '']['situacion_a_inspeccionar'].value_counts()
        for s, c in situaciones.items():
            por_situacion_a_inspeccionar.append({"situacion": s, "cantidad": int(c)})

    # Por Zona
    por_zona = []
    if 'zona' in df_filtered.columns:
        zonas = df_filtered[df_filtered['zona'] != '']['zona'].value_counts()
        for z, c in zonas.items():
            # Calcular tasa de calidad por zona
            zona_df = df_filtered[df_filtered['zona'] == z]
            zona_bien = len(zona_df[zona_df['motivo_multa'].str.contains('BIEN EJECUTADO', case=False, na=False)])
            zona_tasa = round((zona_bien / c * 100), 1) if c > 0 else 0
            por_zona.append({
                "zona": z,
                "cantidad": int(c),
                "bien_ejecutados": int(zona_bien),
                "tasa_calidad": zona_tasa
            })

    # Por Centro Operativo
    por_centro_operativo = []
    if 'centro_operativo' in df_filtered.columns:
        centros = df_filtered[df_filtered['centro_operativo'] != '']['centro_operativo'].value_counts()
        for centro, c in centros.items():
            centro_df = df_filtered[df_filtered['centro_operativo'] == centro]
            centro_bien = len(centro_df[centro_df['motivo_multa'].str.contains('BIEN EJECUTADO', case=False, na=False)])
            centro_tasa = round((centro_bien / c * 100), 1) if c > 0 else 0
            por_centro_operativo.append({
                "centro": centro,
                "cantidad": int(c),
                "bien_ejecutados": int(centro_bien),
                "tasa_calidad": centro_tasa
            })

    # Por Comuna
    por_comuna = []
    if 'comuna' in df_filtered.columns:
        comunas = df_filtered[df_filtered['comuna'] != '']['comuna'].value_counts().head(15)
        for com, c in comunas.items():
            por_comuna.append({"comuna": com, "cantidad": int(c)})

    # Por Inspector
    por_inspector = []
    if 'inspector' in df_filtered.columns:
        inspectores = df_filtered[df_filtered['inspector'] != '']['inspector'].value_counts()
        for insp, c in inspectores.items():
            insp_df = df_filtered[df_filtered['inspector'] == insp]
            insp_bien = len(insp_df[insp_df['motivo_multa'].str.contains('BIEN EJECUTADO', case=False, na=False)])
            insp_multa = len(insp_df[insp_df['multa'].str.upper() == 'SI'])
            insp_tasa = round((insp_bien / c * 100), 1) if c > 0 else 0
            por_inspector.append({
                "inspector": insp,
                "cantidad": int(c),
                "bien_ejecutados": int(insp_bien),
                "con_multa": int(insp_multa),
                "tasa_calidad": insp_tasa
            })

    # Por Giro
    por_giro = []
    if 'giro' in df_filtered.columns:
        giros = df_filtered[df_filtered['giro'] != '']['giro'].value_counts().head(10)
        for g, c in giros.items():
            por_giro.append({"giro": g, "cantidad": int(c)})

    # Por Tipo Empalme
    por_tipo_empalme = []
    if 'tipo_empalme' in df_filtered.columns:
        empalmes = df_filtered[df_filtered['tipo_empalme'] != '']['tipo_empalme'].value_counts()
        for e, c in empalmes.items():
            por_tipo_empalme.append({"tipo": e, "cantidad": int(c)})

    # Por Accion Cobro (Tipo de inspeccion)
    por_accion_cobro = []
    if 'accion_cobro' in df_filtered.columns:
        acciones = df_filtered[df_filtered['accion_cobro'] != '']['accion_cobro'].value_counts()
        for a, c in acciones.items():
            # Simplificar el nombre
            nombre = a
            if 'EFECTIVA Y NO EFECTIVA' in a.upper():
                nombre = 'Efectiva/No Efectiva'
            elif 'NO PERMITE' in a.upper():
                nombre = 'Casos No Permite'
            por_accion_cobro.append({"accion": nombre, "accion_original": a, "cantidad": int(c)})

    # Por Mes (evolucion)
    por_mes = []
    if 'mes' in df_filtered.columns and 'anio' in df_filtered.columns:
        df_filtered['periodo'] = df_filtered['anio'].astype(str) + '-' + df_filtered['mes'].astype(str).str.zfill(2)
        periodos = sorted(df_filtered['periodo'].dropna().unique())
        meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

        for periodo in periodos[-12:]:  # Ultimos 12 meses
            df_periodo = df_filtered[df_filtered['periodo'] == periodo]
            total_periodo = len(df_periodo)
            bien_periodo = len(df_periodo[df_periodo['motivo_multa'].str.contains('BIEN EJECUTADO', case=False, na=False)])
            tasa_periodo = round((bien_periodo / total_periodo * 100), 1) if total_periodo > 0 else 0

            partes = periodo.split('-')
            mes_num = int(partes[1])
            periodo_label = f"{meses_nombres[mes_num]} {partes[0]}"

            por_mes.append({
                "periodo": periodo_label,
                "total": total_periodo,
                "bien_ejecutados": bien_periodo,
                "tasa_calidad": tasa_periodo
            })

    # Generar Insights
    insights = []

    # Insight de tasa de calidad
    if tasa_calidad < 80:
        insights.append({
            "tipo": "warning",
            "titulo": "Tasa de calidad baja",
            "mensaje": f"Solo el {tasa_calidad}% de las inspecciones fueron bien ejecutadas"
        })
    elif tasa_calidad >= 95:
        insights.append({
            "tipo": "success",
            "titulo": "Excelente calidad de ejecucion",
            "mensaje": f"El {tasa_calidad}% de las inspecciones fueron bien ejecutadas"
        })

    # Insight de multas
    if tasa_multa > 5:
        insights.append({
            "tipo": "warning",
            "titulo": "Alto porcentaje de multas",
            "mensaje": f"{con_multa} casos ({tasa_multa}%) presentan multa"
        })

    # Insight de zonas peligrosas
    zonas_peligrosas = len(df_filtered[df_filtered['situacion_encontrada'].str.contains('ZONA PELIGROSA', case=False, na=False)])
    if zonas_peligrosas > 0:
        pct_peligrosas = round((zonas_peligrosas / total * 100), 1)
        if pct_peligrosas > 10:
            insights.append({
                "tipo": "info",
                "titulo": "Zonas peligrosas detectadas",
                "mensaje": f"{zonas_peligrosas} casos ({pct_peligrosas}%) en zonas peligrosas"
            })

    # Insight de no ubicados
    no_ubicados = len(df_filtered[df_filtered['situacion_encontrada'].str.contains('NO UBICADO', case=False, na=False)])
    if no_ubicados > 0:
        pct_no_ubicados = round((no_ubicados / total * 100), 1)
        if pct_no_ubicados > 15:
            insights.append({
                "tipo": "warning",
                "titulo": "Alto porcentaje de no ubicados",
                "mensaje": f"{no_ubicados} casos ({pct_no_ubicados}%) no fueron ubicados"
            })

    # Insight de factibilidad
    if factible_cortar > 0:
        pct_factible = round((factible_cortar / (factible_cortar + no_factible_cortar) * 100), 1) if (factible_cortar + no_factible_cortar) > 0 else 0
        if pct_factible < 50:
            insights.append({
                "tipo": "info",
                "titulo": "Baja factibilidad de corte",
                "mensaje": f"Solo el {pct_factible}% de los casos es factible cortar"
            })

    return {
        "total": total,
        "realizadas": realizadas,
        "pendientes": pendientes,
        "tasa_ejecucion": tasa_ejecucion,
        "bien_ejecutados": bien_ejecutados,
        "no_ejecutados": no_ejecutados,
        "tasa_calidad": tasa_calidad,
        "con_multa": con_multa,
        "sin_multa": sin_multa,
        "tasa_multa": tasa_multa,
        "factible_cortar": factible_cortar,
        "no_factible_cortar": no_factible_cortar,
        "por_situacion_encontrada": por_situacion_encontrada,
        "por_situacion_a_inspeccionar": por_situacion_a_inspeccionar,
        "por_zona": por_zona,
        "por_centro_operativo": por_centro_operativo,
        "por_comuna": por_comuna,
        "por_inspector": por_inspector,
        "por_giro": por_giro,
        "por_tipo_empalme": por_tipo_empalme,
        "por_accion_cobro": por_accion_cobro,
        "por_mes": por_mes,
        "insights": insights,
    }


def get_corte_filtered_data(
    search: Optional[str] = None,
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
    comuna: Optional[str] = None,
    inspector: Optional[str] = None,
    situacion_encontrada: Optional[str] = None,
    motivo_multa: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "id",
    order: str = "desc"
) -> Dict[str, Any]:
    """Get filtered and paginated corte data."""
    df = load_corte_data()

    if df.empty:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "pages": 0
        }

    # Aplicar filtros
    mask = pd.Series([True] * len(df))

    if search:
        search_mask = pd.Series([False] * len(df))
        search_cols = ['suministro', 'nombre_cliente', 'direccion', 'comuna', 'inspector', 'nro_medidor']
        for col in search_cols:
            if col in df.columns:
                search_mask |= df[col].astype(str).str.contains(search, case=False, na=False)
        mask &= search_mask

    if zona and 'zona' in df.columns:
        mask &= df['zona'].str.upper() == zona.upper()

    if centro_operativo and 'centro_operativo' in df.columns:
        mask &= df['centro_operativo'].str.upper() == centro_operativo.upper()

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if inspector and 'inspector' in df.columns:
        mask &= df['inspector'].str.contains(inspector, case=False, na=False)

    if situacion_encontrada and 'situacion_encontrada' in df.columns:
        mask &= df['situacion_encontrada'].str.contains(situacion_encontrada, case=False, na=False)

    if motivo_multa and 'motivo_multa' in df.columns:
        mask &= df['motivo_multa'].str.contains(motivo_multa, case=False, na=False)

    if mes and 'mes' in df.columns:
        mask &= df['mes'] == mes

    if anio and 'anio' in df.columns:
        mask &= df['anio'] == anio

    filtered_df = df[mask].copy()

    # Ordenar
    if sort_by in filtered_df.columns:
        filtered_df = filtered_df.sort_values(
            by=sort_by,
            ascending=(order == "asc"),
            na_position='last'
        )

    # Paginar
    total = len(filtered_df)
    pages = (total + limit - 1) // limit
    start = (page - 1) * limit
    end = start + limit

    paginated_df = filtered_df.iloc[start:end]

    # Seleccionar columnas para respuesta
    output_cols = ['id', 'suministro', 'nombre_cliente', 'direccion', 'comuna',
                   'zona', 'centro_operativo', 'situacion_encontrada', 'situacion_dejada',
                   'motivo_multa', 'multa', 'inspector', 'giro', 'tipo_empalme',
                   'es_factible_cortar', 'fecha_inspeccion']
    output_cols = [c for c in output_cols if c in paginated_df.columns]

    items = paginated_df[output_cols].to_dict(orient='records')

    # Limpiar valores NaN y formatear fechas
    for item in items:
        for key, value in item.items():
            if pd.isna(value):
                item[key] = None
            elif isinstance(value, pd.Timestamp):
                item[key] = value.strftime('%Y-%m-%d')

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


def get_corte_zonas() -> List[str]:
    """Get list of unique zonas."""
    df = load_corte_data()
    if 'zona' in df.columns:
        return sorted([z for z in df['zona'].dropna().unique().tolist() if z and z.strip()])
    return []


def get_corte_centros_operativos() -> List[str]:
    """Get list of unique centros operativos."""
    df = load_corte_data()
    if 'centro_operativo' in df.columns:
        return sorted([c for c in df['centro_operativo'].dropna().unique().tolist() if c and c.strip()])
    return []


def get_corte_comunas() -> List[str]:
    """Get list of unique comunas."""
    df = load_corte_data()
    if 'comuna' in df.columns:
        return sorted([c for c in df['comuna'].dropna().unique().tolist() if c and c.strip()])
    return []


def get_corte_inspectores() -> List[Dict[str, Any]]:
    """Get list of inspectors with stats."""
    df = load_corte_data()
    if 'inspector' not in df.columns:
        return []

    inspectores = []
    df_insp = df[df['inspector'] != '']
    inspector_counts = df_insp['inspector'].value_counts()

    for insp, count in inspector_counts.items():
        if insp and insp.strip():
            insp_df = df_insp[df_insp['inspector'] == insp]
            bien_ejecutados = len(insp_df[insp_df['motivo_multa'].str.contains('BIEN EJECUTADO', case=False, na=False)])
            con_multa = len(insp_df[insp_df['multa'].str.upper() == 'SI'])
            tasa = round((bien_ejecutados / count * 100), 1) if count > 0 else 0
            inspectores.append({
                "inspector": insp,
                "cantidad": int(count),
                "bien_ejecutados": int(bien_ejecutados),
                "con_multa": int(con_multa),
                "tasa_calidad": tasa
            })

    return inspectores


def get_corte_situaciones() -> List[str]:
    """Get list of unique situacion_encontrada values."""
    df = load_corte_data()
    if 'situacion_encontrada' in df.columns:
        return sorted([s for s in df['situacion_encontrada'].dropna().unique().tolist() if s and s.strip()])
    return []


def get_corte_periodos() -> Dict[str, List[int]]:
    """Get available months and years."""
    df = load_corte_data()
    result = {"meses": [], "anios": []}

    if 'mes' in df.columns:
        meses = df['mes'].dropna().unique().tolist()
        result["meses"] = sorted([int(m) for m in meses if m and not pd.isna(m)])

    if 'anio' in df.columns:
        anios = df['anio'].dropna().unique().tolist()
        result["anios"] = sorted([int(a) for a in anios if a and not pd.isna(a)])

    return result


def get_corte_evolucion(
    zona: Optional[str] = None,
    centro_operativo: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Get monthly evolution of corte metrics."""
    df = load_corte_data()

    if df.empty or 'mes' not in df.columns or 'anio' not in df.columns:
        return []

    # Aplicar filtros
    mask = pd.Series([True] * len(df))

    if zona and 'zona' in df.columns:
        mask &= df['zona'].str.upper() == zona.upper()

    if centro_operativo and 'centro_operativo' in df.columns:
        mask &= df['centro_operativo'].str.upper() == centro_operativo.upper()

    df_filtered = df[mask].copy()

    # Crear periodo (anio-mes)
    df_filtered['periodo'] = df_filtered['anio'].astype(str) + '-' + df_filtered['mes'].astype(str).str.zfill(2)

    # Agrupar por periodo
    evolucion = []
    periodos = sorted(df_filtered['periodo'].dropna().unique())

    meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for periodo in periodos:
        df_periodo = df_filtered[df_filtered['periodo'] == periodo]
        total = len(df_periodo)

        # Calcular bien ejecutados
        bien_ejecutados = len(df_periodo[df_periodo['motivo_multa'].str.contains('BIEN EJECUTADO', case=False, na=False)])
        tasa_calidad = round((bien_ejecutados / total * 100), 1) if total > 0 else 0

        # Calcular multas
        con_multa = len(df_periodo[df_periodo['multa'].str.upper() == 'SI'])
        tasa_multa = round((con_multa / total * 100), 1) if total > 0 else 0

        # Nombre del mes
        partes = periodo.split('-')
        mes_num = int(partes[1])
        periodo_label = f"{meses_nombres[mes_num]} {partes[0]}"

        evolucion.append({
            "periodo": periodo_label,
            "total": total,
            "bien_ejecutados": bien_ejecutados,
            "tasa_calidad": tasa_calidad,
            "con_multa": con_multa,
            "tasa_multa": tasa_multa
        })

    return evolucion
