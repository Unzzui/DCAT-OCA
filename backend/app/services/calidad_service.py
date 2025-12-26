"""
Servicio de datos para el modulo de Control de Perdidas (Calidad).
Combina datos de inspecciones Monofasicas (CDP) y Trifasicas (TFS).
"""

import pandas as pd
import numpy as np
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

# Global dataframe caches
_df_calidad_mono_cache: Optional[pd.DataFrame] = None
_df_calidad_tri_cache: Optional[pd.DataFrame] = None
_df_inspecciones_mono_cache: Optional[pd.DataFrame] = None
_df_inspecciones_tri_cache: Optional[pd.DataFrame] = None


def get_data_path() -> str:
    """Get the data directory path."""
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data"
    )


def load_calidad_mono(force_reload: bool = False) -> pd.DataFrame:
    """Load BASE monofasico data."""
    global _df_calidad_mono_cache

    if _df_calidad_mono_cache is not None and not force_reload:
        return _df_calidad_mono_cache

    path = os.path.join(get_data_path(), "informe_calidad_mono_BASE.csv")

    if not os.path.exists(path):
        print(f"File not found: {path}")
        return pd.DataFrame()

    df = pd.read_csv(path, encoding='utf-8', low_memory=False)
    df['tipo_sistema'] = 'MONOFASICO'
    df['id'] = range(1, len(df) + 1)

    # Normalizar columnas
    df = normalize_columns(df)

    _df_calidad_mono_cache = df
    print(f"Loaded Calidad Mono BASE: {len(df)} records")
    return df


def load_calidad_tri(force_reload: bool = False) -> pd.DataFrame:
    """Load BASE trifasico data."""
    global _df_calidad_tri_cache

    if _df_calidad_tri_cache is not None and not force_reload:
        return _df_calidad_tri_cache

    path = os.path.join(get_data_path(), "informe_calidad_tri_BASE.csv")

    if not os.path.exists(path):
        print(f"File not found: {path}")
        return pd.DataFrame()

    df = pd.read_csv(path, encoding='utf-8', low_memory=False)
    df['tipo_sistema'] = 'TRIFASICO'
    df['id'] = range(1, len(df) + 1)

    # Normalizar columnas
    df = normalize_columns(df)

    _df_calidad_tri_cache = df
    print(f"Loaded Calidad Tri BASE: {len(df)} records")
    return df


def load_inspecciones_mono(force_reload: bool = False) -> pd.DataFrame:
    """Load inspecciones monofasico data."""
    global _df_inspecciones_mono_cache

    if _df_inspecciones_mono_cache is not None and not force_reload:
        return _df_inspecciones_mono_cache

    path = os.path.join(get_data_path(), "informe_calidad_mono_INSPECCIONES.csv")

    if not os.path.exists(path):
        return pd.DataFrame()

    df = pd.read_csv(path, encoding='utf-8', low_memory=False)
    df['tipo_sistema'] = 'MONOFASICO'

    _df_inspecciones_mono_cache = df
    print(f"Loaded Inspecciones Mono: {len(df)} records")
    return df


def load_inspecciones_tri(force_reload: bool = False) -> pd.DataFrame:
    """Load inspecciones trifasico data."""
    global _df_inspecciones_tri_cache

    if _df_inspecciones_tri_cache is not None and not force_reload:
        return _df_inspecciones_tri_cache

    path = os.path.join(get_data_path(), "informe_calidad_tri_INSPECCIONES.csv")

    if not os.path.exists(path):
        return pd.DataFrame()

    df = pd.read_csv(path, encoding='utf-8', low_memory=False)
    df['tipo_sistema'] = 'TRIFASICO'

    _df_inspecciones_tri_cache = df
    print(f"Loaded Inspecciones Tri: {len(df)} records")
    return df


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names and values."""
    # Mapeo de columnas comunes
    column_mapping = {
        'NUMERO DE INCIDENCIA': 'incidencia',
        'ASIGNADO A': 'inspector',
        'SERVICIO': 'servicio',
        'TIPO DE SERVICIO': 'tipo_servicio',
        'NUMERO DE CLIENTE': 'cliente',
        'NOMBRE DE CLIENTE': 'nombre_cliente',
        'CALLE': 'direccion',
        'COMUNA': 'comuna',
        'LATITUD': 'latitud',
        'LONGITUD': 'longitud',
        'MEDIDOR': 'medidor',
        'N. MEDIDOR': 'medidor',
        'TARIFA (1)': 'tarifa',
        'CONSTANTE (1)': 'constante',
        'RED': 'red',
        'ESTADO': 'estado_suministro',
        'EMPRESA': 'contratista',
        'TIPO RESULTADO': 'tipo_resultado',
        'ESTADO PROPIEDAD': 'estado_propiedad',
        'NORMALIZAR': 'requiere_normalizacion',
        'Requiere Trabajo': 'requiere_trabajo',
        'NOTIFICACION': 'notificacion',
        'VOLTS': 'voltaje',
        'VOLTAJE': 'voltaje',
        'AMP': 'amperaje',
        'E %': 'error_porcentaje',
        '% ERROR': 'error_porcentaje',
        'KC': 'kc',
        'ACOMETIDA': 'estado_acometida',
        'CAJA': 'estado_caja',
        'TAPA': 'estado_tapa',
        'PERNO ENCONTRADO': 'perno_encontrado',
        'PERNO NORMALIZADO': 'perno_normalizado',
        'GIRO (1)': 'giro',
        'MODELO EN TERRENO CORRESPONDE A SISTEMA': 'modelo_corresponde',
        'MEDIDOR EN TERRENO CORRESPONDE A SISTEMA': 'medidor_corresponde',
        'INSPECTOR': 'inspector',
        'FECHA': 'fecha_inspeccion',
        'FECHA DE ACTUALIZACIÓN': 'fecha_inspeccion',
        'FP MEDIDO': 'factor_potencia',
        'KWI': 'kwi',
        'KVA': 'kva',
    }

    rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns}
    df = df.rename(columns=rename_dict)

    # Normalizar valores de texto
    text_cols = ['tipo_resultado', 'estado_suministro', 'estado_propiedad',
                 'comuna', 'inspector', 'contratista', 'giro']
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].fillna('').astype(str).str.strip().str.upper()

    # Parsear fecha si existe y extraer mes/año
    if 'fecha_inspeccion' in df.columns:
        df['fecha_inspeccion'] = pd.to_datetime(df['fecha_inspeccion'], errors='coerce')
        df['mes'] = df['fecha_inspeccion'].dt.month
        df['anio'] = df['fecha_inspeccion'].dt.year

    return df


def load_all_calidad_data(force_reload: bool = False) -> pd.DataFrame:
    """Load and combine all calidad BASE data."""
    df_mono = load_calidad_mono(force_reload)
    df_tri = load_calidad_tri(force_reload)

    dfs = []
    if not df_mono.empty:
        dfs.append(df_mono)
    if not df_tri.empty:
        dfs.append(df_tri)

    if not dfs:
        return pd.DataFrame()

    # Combinar con columnas comunes
    df = pd.concat(dfs, ignore_index=True)
    df['id'] = range(1, len(df) + 1)

    return df


def get_calidad_stats(
    tipo_sistema: Optional[str] = None,
    comuna: Optional[str] = None,
    contratista: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
) -> Dict[str, Any]:
    """Get comprehensive statistics for Control de Perdidas."""

    # Cargar datos de BASE (inspecciones ejecutadas)
    df = load_all_calidad_data()

    # Cargar datos de INSPECCIONES (ordenes asignadas)
    df_insp_mono = load_inspecciones_mono()
    df_insp_tri = load_inspecciones_tri()

    empty_response = {
        "total_solicitadas": 0,
        "total_ejecutadas": 0,
        "pendientes": 0,
        "tasa_ejecucion": 0,
        "monofasico": {"solicitadas": 0, "ejecutadas": 0, "tasa": 0},
        "trifasico": {"solicitadas": 0, "ejecutadas": 0, "tasa": 0},
        "por_resultado": [],
        "por_estado_propiedad": [],
        "por_estado_suministro": [],
        "por_comuna": [],
        "por_inspector": [],
        "por_contratista": [],
        "por_giro": [],
        "anomalias": {
            "modelo_no_corresponde": 0,
            "medidor_no_corresponde": 0,
            "requiere_normalizacion": 0,
            "perno_no_normalizado": 0,
        },
        "calidad_instalacion": {
            "acometida_normal": 0,
            "acometida_anormal": 0,
            "caja_normal": 0,
            "caja_anormal": 0,
            "tapa_normal": 0,
            "tapa_anormal": 0,
        },
        "metricas_electricas": {
            "voltaje_promedio": 0,
            "amperaje_promedio": 0,
            "error_promedio": 0,
            "error_max": 0,
            "factor_potencia_promedio": 0,
        },
        "insights": [],
    }

    if df.empty:
        return empty_response

    # Aplicar filtros
    mask = pd.Series([True] * len(df))

    if tipo_sistema and 'tipo_sistema' in df.columns:
        mask &= df['tipo_sistema'].str.upper() == tipo_sistema.upper()

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if contratista and 'contratista' in df.columns:
        mask &= df['contratista'].str.upper() == contratista.upper()

    if mes and 'mes' in df.columns:
        mask &= df['mes'] == mes

    if anio and 'anio' in df.columns:
        mask &= df['anio'] == anio

    df_filtered = df[mask].copy()

    # Calcular totales
    insp_mono_total = len(df_insp_mono) if not df_insp_mono.empty else 0
    insp_tri_total = len(df_insp_tri) if not df_insp_tri.empty else 0
    total_solicitadas = insp_mono_total + insp_tri_total

    ejecutadas_mono = len(df_filtered[df_filtered['tipo_sistema'] == 'MONOFASICO'])
    ejecutadas_tri = len(df_filtered[df_filtered['tipo_sistema'] == 'TRIFASICO'])
    total_ejecutadas = len(df_filtered)

    pendientes = max(0, total_solicitadas - total_ejecutadas)
    tasa_ejecucion = round((total_ejecutadas / total_solicitadas * 100), 1) if total_solicitadas > 0 else 0

    tasa_mono = round((ejecutadas_mono / insp_mono_total * 100), 1) if insp_mono_total > 0 else 0
    tasa_tri = round((ejecutadas_tri / insp_tri_total * 100), 1) if insp_tri_total > 0 else 0

    # Por Tipo Resultado
    por_resultado = []
    if 'tipo_resultado' in df_filtered.columns:
        resultados = df_filtered[df_filtered['tipo_resultado'] != '']['tipo_resultado'].value_counts()
        for r, c in resultados.items():
            por_resultado.append({"resultado": r, "cantidad": int(c)})

    # Por Estado Propiedad
    por_estado_propiedad = []
    if 'estado_propiedad' in df_filtered.columns:
        estados = df_filtered[df_filtered['estado_propiedad'] != '']['estado_propiedad'].value_counts()
        for e, c in estados.items():
            por_estado_propiedad.append({"estado": e, "cantidad": int(c)})

    # Por Estado Suministro
    por_estado_suministro = []
    if 'estado_suministro' in df_filtered.columns:
        estados = df_filtered[df_filtered['estado_suministro'] != '']['estado_suministro'].value_counts()
        for e, c in estados.items():
            por_estado_suministro.append({"estado": e, "cantidad": int(c)})

    # Por Comuna
    por_comuna = []
    if 'comuna' in df_filtered.columns:
        comunas = df_filtered[df_filtered['comuna'] != '']['comuna'].value_counts()
        for com, c in comunas.items():
            por_comuna.append({"comuna": com, "cantidad": int(c)})

    # Por Inspector
    por_inspector = []
    if 'inspector' in df_filtered.columns:
        inspectores = df_filtered[df_filtered['inspector'] != '']['inspector'].value_counts()
        for insp, c in inspectores.items():
            # Calcular tasa de normalidad por inspector
            insp_df = df_filtered[df_filtered['inspector'] == insp]
            normales = len(insp_df[insp_df['tipo_resultado'].str.contains('NORMAL', case=False, na=False)])
            tasa_normal = round((normales / c * 100), 1) if c > 0 else 0
            por_inspector.append({
                "inspector": insp,
                "cantidad": int(c),
                "normales": int(normales),
                "tasa_normalidad": tasa_normal
            })

    # Por Contratista
    por_contratista = []
    if 'contratista' in df_filtered.columns:
        contratistas = df_filtered[df_filtered['contratista'] != '']['contratista'].value_counts()
        for cont, c in contratistas.items():
            cont_df = df_filtered[df_filtered['contratista'] == cont]
            normales = len(cont_df[cont_df['tipo_resultado'].str.contains('NORMAL', case=False, na=False)])
            tasa_normal = round((normales / c * 100), 1) if c > 0 else 0
            por_contratista.append({
                "contratista": cont,
                "cantidad": int(c),
                "normales": int(normales),
                "tasa_normalidad": tasa_normal
            })

    # Por Giro (tipo de cliente)
    por_giro = []
    if 'giro' in df_filtered.columns:
        giros = df_filtered[df_filtered['giro'] != '']['giro'].value_counts().head(10)
        for g, c in giros.items():
            por_giro.append({"giro": g, "cantidad": int(c)})

    # Deteccion de Anomalias
    anomalias = {
        "modelo_no_corresponde": 0,
        "medidor_no_corresponde": 0,
        "requiere_normalizacion": 0,
        "perno_no_normalizado": 0,
    }

    if 'modelo_corresponde' in df_filtered.columns:
        anomalias["modelo_no_corresponde"] = int(len(df_filtered[
            df_filtered['modelo_corresponde'].str.contains('NO', case=False, na=False)
        ]))

    if 'medidor_corresponde' in df_filtered.columns:
        anomalias["medidor_no_corresponde"] = int(len(df_filtered[
            df_filtered['medidor_corresponde'].str.contains('NO', case=False, na=False)
        ]))

    if 'requiere_normalizacion' in df_filtered.columns:
        anomalias["requiere_normalizacion"] = int(df_filtered['requiere_normalizacion'].notna().sum())

    if 'perno_normalizado' in df_filtered.columns:
        anomalias["perno_no_normalizado"] = int(len(df_filtered[
            df_filtered['perno_normalizado'].str.contains('NO', case=False, na=False)
        ]))

    # Calidad de Instalacion
    calidad_instalacion = {
        "acometida_normal": 0,
        "acometida_anormal": 0,
        "caja_normal": 0,
        "caja_anormal": 0,
        "tapa_normal": 0,
        "tapa_anormal": 0,
    }

    for campo, prefijo in [('estado_acometida', 'acometida'), ('estado_caja', 'caja'), ('estado_tapa', 'tapa')]:
        if campo in df_filtered.columns:
            calidad_instalacion[f"{prefijo}_normal"] = int(len(df_filtered[
                df_filtered[campo].str.contains('NORMAL', case=False, na=False)
            ]))
            calidad_instalacion[f"{prefijo}_anormal"] = int(len(df_filtered[
                ~df_filtered[campo].str.contains('NORMAL', case=False, na=True) &
                (df_filtered[campo] != '')
            ]))

    # Metricas Electricas
    metricas_electricas = {
        "voltaje_promedio": 0,
        "amperaje_promedio": 0,
        "error_promedio": 0,
        "error_max": 0,
        "factor_potencia_promedio": 0,
    }

    if 'voltaje' in df_filtered.columns:
        voltaje = pd.to_numeric(df_filtered['voltaje'], errors='coerce').dropna()
        if len(voltaje) > 0:
            metricas_electricas["voltaje_promedio"] = float(round(voltaje.mean(), 1))

    if 'amperaje' in df_filtered.columns:
        amperaje = pd.to_numeric(df_filtered['amperaje'], errors='coerce').dropna()
        if len(amperaje) > 0:
            metricas_electricas["amperaje_promedio"] = float(round(amperaje.mean(), 2))

    if 'error_porcentaje' in df_filtered.columns:
        error = pd.to_numeric(df_filtered['error_porcentaje'], errors='coerce').dropna()
        if len(error) > 0:
            metricas_electricas["error_promedio"] = float(round(error.mean(), 2))
            metricas_electricas["error_max"] = float(round(error.max(), 2))

    if 'factor_potencia' in df_filtered.columns:
        fp = pd.to_numeric(df_filtered['factor_potencia'], errors='coerce').dropna()
        if len(fp) > 0:
            metricas_electricas["factor_potencia_promedio"] = float(round(fp.mean(), 2))

    # Generar Insights
    insights = []

    # Insight de tasa de ejecucion
    if tasa_ejecucion < 50:
        insights.append({
            "tipo": "warning",
            "titulo": "Baja tasa de ejecucion",
            "mensaje": f"Solo se ha ejecutado el {tasa_ejecucion}% de las inspecciones solicitadas"
        })
    elif tasa_ejecucion >= 80:
        insights.append({
            "tipo": "success",
            "titulo": "Buena tasa de ejecucion",
            "mensaje": f"Se ha ejecutado el {tasa_ejecucion}% de las inspecciones"
        })

    # Insight de anomalias
    total_anomalias = sum(anomalias.values())
    if total_anomalias > 0:
        pct_anomalias = round((total_anomalias / total_ejecutadas * 100), 1) if total_ejecutadas > 0 else 0
        if pct_anomalias > 10:
            insights.append({
                "tipo": "warning",
                "titulo": "Alto indice de anomalias",
                "mensaje": f"{total_anomalias} casos ({pct_anomalias}%) presentan anomalias en equipos"
            })

    # Insight de resultados normales
    normales = len(df_filtered[df_filtered['tipo_resultado'].str.contains('NORMAL', case=False, na=False)])
    pct_normales = round((normales / total_ejecutadas * 100), 1) if total_ejecutadas > 0 else 0
    if pct_normales >= 90:
        insights.append({
            "tipo": "success",
            "titulo": "Alta tasa de normalidad",
            "mensaje": f"{pct_normales}% de las inspecciones resultaron normales"
        })
    elif pct_normales < 70:
        insights.append({
            "tipo": "info",
            "titulo": "Tasa de normalidad moderada",
            "mensaje": f"{pct_normales}% de las inspecciones resultaron normales"
        })

    # Insight de errores de medicion
    if metricas_electricas["error_max"] > 5:
        insights.append({
            "tipo": "warning",
            "titulo": "Error de medicion alto detectado",
            "mensaje": f"Se detectaron errores de hasta {metricas_electricas['error_max']}% en medidores"
        })

    return {
        "total_solicitadas": total_solicitadas,
        "total_ejecutadas": total_ejecutadas,
        "pendientes": pendientes,
        "tasa_ejecucion": tasa_ejecucion,
        "monofasico": {
            "solicitadas": insp_mono_total,
            "ejecutadas": ejecutadas_mono,
            "tasa": tasa_mono
        },
        "trifasico": {
            "solicitadas": insp_tri_total,
            "ejecutadas": ejecutadas_tri,
            "tasa": tasa_tri
        },
        "por_resultado": por_resultado,
        "por_estado_propiedad": por_estado_propiedad,
        "por_estado_suministro": por_estado_suministro,
        "por_comuna": por_comuna,
        "por_inspector": por_inspector,
        "por_contratista": por_contratista,
        "por_giro": por_giro,
        "anomalias": anomalias,
        "calidad_instalacion": calidad_instalacion,
        "metricas_electricas": metricas_electricas,
        "insights": insights,
    }


def get_calidad_filtered_data(
    search: Optional[str] = None,
    tipo_sistema: Optional[str] = None,
    tipo_resultado: Optional[str] = None,
    comuna: Optional[str] = None,
    contratista: Optional[str] = None,
    inspector: Optional[str] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "id",
    order: str = "desc"
) -> Dict[str, Any]:
    """Get filtered and paginated calidad data."""
    df = load_all_calidad_data()

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
        search_cols = ['cliente', 'nombre_cliente', 'direccion', 'comuna', 'medidor', 'inspector']
        for col in search_cols:
            if col in df.columns:
                search_mask |= df[col].astype(str).str.contains(search, case=False, na=False)
        mask &= search_mask

    if tipo_sistema and 'tipo_sistema' in df.columns:
        mask &= df['tipo_sistema'].str.upper() == tipo_sistema.upper()

    if tipo_resultado and 'tipo_resultado' in df.columns:
        mask &= df['tipo_resultado'].str.contains(tipo_resultado, case=False, na=False)

    if comuna and 'comuna' in df.columns:
        mask &= df['comuna'].str.upper() == comuna.upper()

    if contratista and 'contratista' in df.columns:
        mask &= df['contratista'].str.upper() == contratista.upper()

    if inspector and 'inspector' in df.columns:
        mask &= df['inspector'].str.contains(inspector, case=False, na=False)

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
    output_cols = ['id', 'tipo_sistema', 'cliente', 'nombre_cliente', 'direccion',
                   'comuna', 'medidor', 'tarifa', 'inspector', 'contratista',
                   'tipo_resultado', 'estado_propiedad', 'estado_suministro',
                   'voltaje', 'error_porcentaje', 'giro']
    output_cols = [c for c in output_cols if c in paginated_df.columns]

    items = paginated_df[output_cols].to_dict(orient='records')

    # Limpiar valores NaN
    for item in items:
        for key, value in item.items():
            if pd.isna(value):
                item[key] = None

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }


def get_calidad_comunas() -> List[str]:
    """Get list of unique comunas."""
    df = load_all_calidad_data()
    if 'comuna' in df.columns:
        return sorted([c for c in df['comuna'].dropna().unique().tolist() if c])
    return []


def get_calidad_inspectores() -> List[Dict[str, Any]]:
    """Get list of inspectors with stats."""
    df = load_all_calidad_data()
    if 'inspector' not in df.columns:
        return []

    inspectores = []
    df_insp = df[df['inspector'] != '']
    inspector_counts = df_insp['inspector'].value_counts()

    for insp, count in inspector_counts.items():
        if insp and insp.strip():
            insp_df = df_insp[df_insp['inspector'] == insp]
            normales = len(insp_df[insp_df['tipo_resultado'].str.contains('NORMAL', case=False, na=False)])
            tasa = round((normales / count * 100), 1) if count > 0 else 0
            inspectores.append({
                "inspector": insp,
                "cantidad": int(count),
                "tasa_normalidad": tasa
            })

    return inspectores


def get_calidad_contratistas() -> List[str]:
    """Get list of unique contratistas."""
    df = load_all_calidad_data()
    if 'contratista' in df.columns:
        return sorted([c for c in df['contratista'].dropna().unique().tolist() if c])
    return []


def get_calidad_resultados() -> List[str]:
    """Get list of unique tipo_resultado values."""
    df = load_all_calidad_data()
    if 'tipo_resultado' in df.columns:
        return sorted([r for r in df['tipo_resultado'].dropna().unique().tolist() if r])
    return []


def get_calidad_periodos() -> Dict[str, List[int]]:
    """Get available months and years."""
    df = load_all_calidad_data()
    result = {"meses": [], "anios": []}

    if 'mes' in df.columns:
        meses = df['mes'].dropna().unique().tolist()
        result["meses"] = sorted([int(m) for m in meses if m])

    if 'anio' in df.columns:
        anios = df['anio'].dropna().unique().tolist()
        result["anios"] = sorted([int(a) for a in anios if a])

    return result


def get_calidad_evolucion(
    tipo_sistema: Optional[str] = None,
    contratista: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Get monthly evolution of quality metrics."""
    df = load_all_calidad_data()

    if df.empty or 'mes' not in df.columns or 'anio' not in df.columns:
        return []

    # Aplicar filtros
    mask = pd.Series([True] * len(df))

    if tipo_sistema and 'tipo_sistema' in df.columns:
        mask &= df['tipo_sistema'].str.upper() == tipo_sistema.upper()

    if contratista and 'contratista' in df.columns:
        mask &= df['contratista'].str.upper() == contratista.upper()

    df_filtered = df[mask].copy()

    # Crear periodo (anio-mes)
    df_filtered['periodo'] = df_filtered['anio'].astype(str) + '-' + df_filtered['mes'].astype(str).str.zfill(2)

    # Agrupar por periodo
    evolucion = []
    periodos = sorted(df_filtered['periodo'].unique())

    for periodo in periodos:
        df_periodo = df_filtered[df_filtered['periodo'] == periodo]
        total = len(df_periodo)

        # Calcular normales
        normales = len(df_periodo[df_periodo['tipo_resultado'].str.contains('NORMAL', case=False, na=False)])
        tasa_normalidad = round((normales / total * 100), 1) if total > 0 else 0

        # Calcular anomalias
        anomalias = 0
        if 'modelo_corresponde' in df_periodo.columns:
            anomalias += len(df_periodo[df_periodo['modelo_corresponde'].str.contains('NO', case=False, na=False)])
        if 'medidor_corresponde' in df_periodo.columns:
            anomalias += len(df_periodo[df_periodo['medidor_corresponde'].str.contains('NO', case=False, na=False)])

        tasa_anomalias = round((anomalias / total * 100), 1) if total > 0 else 0

        # Nombre del mes
        partes = periodo.split('-')
        mes_num = int(partes[1])
        meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        periodo_label = f"{meses_nombres[mes_num]} {partes[0]}"

        evolucion.append({
            "periodo": periodo_label,
            "total": total,
            "normales": normales,
            "tasa_normalidad": tasa_normalidad,
            "anomalias": anomalias,
            "tasa_anomalias": tasa_anomalias
        })

    return evolucion
