"""Utilidades del backend."""
from .excel_formatter import (
    create_formatted_excel,
    get_column_config_nncc,
    get_column_config_lecturas,
    get_column_config_teleco,
    get_column_config_calidad,
)

__all__ = [
    "create_formatted_excel",
    "get_column_config_nncc",
    "get_column_config_lecturas",
    "get_column_config_teleco",
    "get_column_config_calidad",
]
