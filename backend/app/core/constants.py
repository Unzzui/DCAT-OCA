"""
Constants for NNCC (Nuevas Conexiones) module.
Includes zona-comuna mappings extracted from database analysis.
"""

# Zona-Comuna mapping based on NNCC data analysis (43,210 records)
# Last updated: 2026-03-02
ZONA_COMUNA_MAPPING = {
    "CHACABUCO": [
        "CERRO NAVIA",
        "COLINA",
        "CONCHALI",
        "CONCHALÍ",
        "HUECHURABA",
        "INDEPENDENCIA",
        "LAMPA",
        "QUILICURA",
        "QUINTA NORMAL",
        "RECOLETA",
        "RENCA",
        "TIL TIL",
        "TILTIL",
    ],
    "CORDILLERA": [
        "INDEPENDENCIA",
        "LAS CONDES",
        "LO BARNECHEA",
        "PROVIDENCIA",
        "RECOLETA",
        "SANTIAGO",
        "VITACURA",
    ],
    "FLORIDA": [
        "LA CISTERNA",
        "LA FLORIDA",
        "LA GRANJA",
        "LA REINA",
        "MACUL",
        "NUNOA",
        "PENALOLEN",
        "PEÑALOLEN",
        "PEÑALOLÉN",
        "SAN JOAQUIN",
        "SAN RAMON",
        "ÑUÑOA",
    ],
    "PACIFICO": [
        "CERRILLOS",
        "ESTACION CENTRAL",
        "LO ESPEJO",
        "LO PRADO",
        "MAIPU",
        "MAIPÚ",
        "PEDRO AGUIRRE CERDA",
        "PUDAHUEL",
        "SAN MIGUEL",
    ],
}

# All valid zonas
VALID_ZONAS = list(ZONA_COMUNA_MAPPING.keys())

# All valid comunas (deduplicated)
VALID_COMUNAS = sorted(set(
    comuna
    for comunas in ZONA_COMUNA_MAPPING.values()
    for comuna in comunas
))

# Reverse mapping: Comuna -> List of Zonas (for disambiguation)
COMUNA_ZONA_MAPPING = {}
for zona, comunas in ZONA_COMUNA_MAPPING.items():
    for comuna in comunas:
        if comuna not in COMUNA_ZONA_MAPPING:
            COMUNA_ZONA_MAPPING[comuna] = []
        COMUNA_ZONA_MAPPING[comuna].append(zona)


def get_comunas_for_zona(zona: str) -> list:
    """Get list of comunas for a given zona."""
    return ZONA_COMUNAS_MAPPING.get(zona.upper(), [])


def get_zonas_for_comuna(comuna: str) -> list:
    """Get list of zonas for a given comuna (may have multiple)."""
    return COMUNA_ZONA_MAPPING.get(comuna.upper(), [])


def is_valid_zona(zona: str) -> bool:
    """Check if a zona is valid."""
    return zona.upper() in VALID_ZONAS


def is_valid_comuna(comuna: str) -> bool:
    """Check if a comuna is valid."""
    return comuna.upper() in VALID_COMUNAS


def is_valid_zona_comuna_pair(zona: str, comuna: str) -> bool:
    """Check if a zona-comuna pair is valid."""
    zona_upper = zona.upper()
    comuna_upper = comuna.upper()
    if zona_upper not in ZONA_COMUNAS_MAPPING:
        return False
    return comuna_upper in ZONA_COMUNAS_MAPPING[zona_upper]
