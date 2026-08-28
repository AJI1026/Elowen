"""Frozen / desktop-aware runtime paths for the local backend."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _default_data_dir() -> Path:
    """Prefer explicit env, else repo ./data in dev, else platform user data when frozen."""
    if os.environ.get("ELOWEN_DATA_DIR"):
        return Path(os.environ["ELOWEN_DATA_DIR"]).expanduser().resolve()

    if getattr(sys, "frozen", False):
        if sys.platform == "darwin":
            return Path.home() / "Library" / "Application Support" / "Elowen"
        if sys.platform == "win32":
            base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
            return Path(base) / "Elowen"
        xdg = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
        return Path(xdg) / "elowen"

    # Local development default
    return Path(__file__).resolve().parent.parent.parent / "data"


def _bundle_root() -> Path:
    """Root of packaged resources (PyInstaller) or repo."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    # backend/
    return Path(__file__).resolve().parent.parent


def _repo_or_bundle() -> Path:
    if getattr(sys, "frozen", False):
        # Prefer directory next to the executable for seed/static overrides
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent.parent


BUNDLE_ROOT = _bundle_root()
REPO_ROOT = _repo_or_bundle()

# Development: functions next to backend. Frozen: functions copied into bundle.
if getattr(sys, "frozen", False):
    FUNCTIONS_DIR = BUNDLE_ROOT / "functions"
    BACKEND_DIR = BUNDLE_ROOT
else:
    BACKEND_DIR = Path(__file__).resolve().parent.parent
    FUNCTIONS_DIR = REPO_ROOT / "functions"

DATA_DIR = _default_data_dir()
DB_PATH = Path(os.environ.get("ELOWEN_DB_PATH", DATA_DIR / "elowen.sqlite3")).resolve()
IMAGES_DIR = Path(os.environ.get("ELOWEN_IMAGES_DIR", DATA_DIR / "images")).resolve()

_seed_default = BUNDLE_ROOT / "seed"
if not _seed_default.is_dir() and not getattr(sys, "frozen", False):
    _seed_default = BACKEND_DIR / "seed"
SEED_DIR = Path(os.environ.get("ELOWEN_SEED_DIR", _seed_default)).resolve()

# Frontend dist for packaged / desktop mode (opt-in outside frozen builds)
_static_env = os.environ.get("ELOWEN_STATIC_DIR", "").strip()
_serve_static = os.environ.get("ELOWEN_SERVE_STATIC", "").strip() in ("1", "true", "yes")
if _static_env:
    STATIC_DIR: Path | None = Path(_static_env).resolve()
elif getattr(sys, "frozen", False) or _serve_static:
    candidates = []
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        candidates.extend([exe_dir / "static", BUNDLE_ROOT / "static"])
    else:
        candidates.extend([REPO_ROOT / "frontend" / "dist", BACKEND_DIR / "static"])
    STATIC_DIR = next((p for p in candidates if p.is_dir()), None)
else:
    STATIC_DIR = None

AUTO_SEED = os.environ.get("ELOWEN_AUTO_SEED", "1") != "0"
API_HOST = os.environ.get("ELOWEN_API_HOST", "127.0.0.1")
API_PORT = int(os.environ.get("ELOWEN_API_PORT", "8000"))


def ensure_data_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
