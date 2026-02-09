from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path

from ...schemas.user import User, UserCreate, UserUpdate
from ...services.user_service import (
    get_all_users, get_all_users_db,
    create_user, create_user_db,
    get_user_by_email, get_user_by_email_db,
    update_user, update_user_db,
    delete_user, delete_user_db,
)
from ...core.config import settings
from ...db import session as db_session
from ...services.cache import invalidate_all as invalidate_cache, cache_info
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])

_use_db = bool(settings.DATABASE_URL)


@router.get("/users")
async def list_users(
    current_user: User = Depends(require_admin),
):
    if _use_db and db_session.AsyncSessionLocal:
        async with db_session.AsyncSessionLocal() as db:
            users = await get_all_users_db(db)
    else:
        users = get_all_users()
    return [u.model_dump() for u in users]


@router.post("/users")
async def create_new_user(
    user_data: UserCreate,
    current_user: User = Depends(require_admin),
):
    if _use_db and db_session.AsyncSessionLocal:
        async with db_session.AsyncSessionLocal() as db:
            existing = await get_user_by_email_db(db, user_data.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ya existe un usuario con ese email",
                )
            user = await create_user_db(db, user_data)
    else:
        existing = get_user_by_email(user_data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un usuario con ese email",
            )
        user = create_user(user_data)

    return user.model_dump()


@router.put("/users/{user_id}")
async def update_existing_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_admin),
):
    data = user_data.model_dump(exclude_none=True)

    if _use_db and db_session.AsyncSessionLocal:
        async with db_session.AsyncSessionLocal() as db:
            user = await update_user_db(db, user_id, data)
    else:
        user = update_user(user_id, data)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return user.model_dump()


@router.delete("/users/{user_id}")
async def delete_existing_user(
    user_id: int,
    current_user: User = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propia cuenta",
        )

    if _use_db and db_session.AsyncSessionLocal:
        async with db_session.AsyncSessionLocal() as db:
            success = await delete_user_db(db, user_id)
    else:
        success = delete_user(user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return {"message": "Usuario eliminado exitosamente"}


@router.post("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    current_user: User = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta",
        )

    if _use_db and db_session.AsyncSessionLocal:
        async with db_session.AsyncSessionLocal() as db:
            users = await get_all_users_db(db)
            target = next((u for u in users if u.id == user_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            user = await update_user_db(db, user_id, {"is_active": not target.is_active})
    else:
        users = get_all_users()
        target = next((u for u in users if u.id == user_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        user = update_user(user_id, {"is_active": not target.is_active})

    return {"message": f"Usuario {'activado' if user.is_active else 'desactivado'}", "is_active": user.is_active}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    data: Dict[str, str],
    current_user: User = Depends(require_admin),
):
    new_password = data.get("password")
    if not new_password or len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena debe tener al menos 8 caracteres",
        )

    if _use_db and db_session.AsyncSessionLocal:
        async with db_session.AsyncSessionLocal() as db:
            user = await update_user_db(db, user_id, {"password": new_password})
    else:
        user = update_user(user_id, {"password": new_password})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return {"message": "Contrasena actualizada exitosamente"}


# ---------------------------------------------------------------------------
# Pipeline endpoints
# ---------------------------------------------------------------------------

_pipeline_status: Dict[str, Any] = {
    "running": False,
    "last_run": None,
    "last_result": None,
}

PIPELINE_SCRIPT = str(Path(__file__).parent.parent.parent.parent.parent / "scripts" / "pipeline.py")


def _run_pipeline_background(source: Optional[str] = None, force: bool = False):
    """Run pipeline script as subprocess (called in background)."""
    _pipeline_status["running"] = True
    _pipeline_status["last_run"] = datetime.now().isoformat()

    cmd = [sys.executable, PIPELINE_SCRIPT]
    if source:
        cmd.extend(["--source", source])
    if force:
        cmd.append("--force")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
            cwd=str(Path(PIPELINE_SCRIPT).parent.parent),
        )
        _pipeline_status["last_result"] = {
            "success": result.returncode == 0,
            "stdout": result.stdout[-2000:] if result.stdout else "",
            "stderr": result.stderr[-1000:] if result.stderr else "",
            "returncode": result.returncode,
            "timestamp": datetime.now().isoformat(),
        }
    except subprocess.TimeoutExpired:
        _pipeline_status["last_result"] = {
            "success": False,
            "stdout": "",
            "stderr": "Pipeline timed out after 10 minutes",
            "returncode": -1,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        _pipeline_status["last_result"] = {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1,
            "timestamp": datetime.now().isoformat(),
        }
    finally:
        _pipeline_status["running"] = False
        # Invalidate cache after pipeline completes so fresh data is served
        invalidate_cache()


@router.post("/pipeline/run")
async def run_pipeline(
    background_tasks: BackgroundTasks,
    source: Optional[str] = None,
    force: bool = False,
    current_user: User = Depends(require_admin),
):
    """Trigger the data pipeline in background. Admin only."""
    if _pipeline_status["running"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pipeline ya esta en ejecucion",
        )

    valid_sources = ["nncc", "medidores_cruzados", "calidad", "corte", "lecturas", "teleco"]
    if source and source not in valid_sources:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fuente invalida. Opciones: {', '.join(valid_sources)}",
        )

    background_tasks.add_task(_run_pipeline_background, source=source, force=force)
    return {
        "message": "Pipeline iniciado en segundo plano",
        "source": source or "todos",
        "force": force,
    }


@router.get("/pipeline/status")
async def get_pipeline_status(
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Get the status of the last pipeline run. Admin only."""
    return _pipeline_status


@router.post("/cache/clear")
async def clear_cache(
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Clear in-memory cache. Admin only."""
    info = cache_info()
    invalidate_cache()
    return {"message": "Cache limpiado", "entries_cleared": info["total_entries"]}
