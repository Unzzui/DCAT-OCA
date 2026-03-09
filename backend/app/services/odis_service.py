"""Servicio para consultar imágenes desde la API de ODIS."""

import json
import httpx

from ..core.config import settings

_client: httpx.AsyncClient | None = None
_token: str | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=30,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Origin": "https://odisdkp.com",
            },
        )
    return _client


async def _ensure_token() -> str:
    """Login a ODIS y cachea el token."""
    global _token
    if _token:
        return _token

    client = await _get_client()

    payload = {
        "email": settings.OCA_EMAIL,
        "password": settings.OCA_PASSWORD,
        "role_id": 1,
        "version": "a4a375",
        "platform": 1,
        "status": 1,
        "gps": 1,
        "project_id": 1,
        "departamento_id": 1,
        "verified": 0,
    }

    response = await client.post(
        f"{settings.OCA_API_URL}/logindkp2",
        data={"json": json.dumps(payload)},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    response.raise_for_status()
    result = response.json()

    if result.get("status") != "success":
        raise RuntimeError(f"ODIS login failed: {result.get('message', 'unknown')}")

    _token = result["token"]
    client.headers["Authorization"] = f"Bearer {_token}"
    return _token


async def obtener_imagenes(order_id: int) -> list[dict]:
    """Obtiene imágenes base64 de una orden desde ODIS.

    Returns:
        Lista de dicts: [{"id", "descripcion", "base64", "create_at"}, ...]
    """
    await _ensure_token()
    client = await _get_client()

    response = await client.get(f"{settings.OCA_API_URL}/order/{order_id}/listimage")

    if response.status_code != 200:
        return []

    result = response.json()

    # Extraer datos según estructura de respuesta
    datos = None
    if result.get("status") == "success" and result.get("datos"):
        datos = result["datos"]
    elif result.get("code") in [200, 201] and result.get("datos"):
        datos = result["datos"]
    elif result.get("data"):
        datos = result["data"]
    elif isinstance(result, list):
        datos = result

    if not datos or not isinstance(datos, list):
        return []

    # Normalizar respuesta
    fotos = []
    for img in datos:
        base64_raw = img.get("archivo", img.get("file", ""))

        # Limpiar prefijo data:image/... si existe
        if base64_raw and "," in base64_raw:
            base64_raw = base64_raw.split(",", 1)[1]

        fotos.append({
            "id": img.get("id", ""),
            "descripcion": img.get("descripcion", img.get("description", "")),
            "base64": base64_raw or None,
            "create_at": img.get("create_at", ""),
        })

    return fotos


async def invalidar_token():
    """Fuerza re-login en la próxima llamada."""
    global _token
    _token = None
