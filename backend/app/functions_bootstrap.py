"""Bootstrap functions/ package path and local image storage."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from .config import FUNCTIONS_DIR, IMAGES_DIR

logger = logging.getLogger(__name__)
_bootstrapped = False


def bootstrap_functions_path() -> None:
    """Add functions/ to sys.path and point image_utils at the local image dir."""
    global _bootstrapped
    if _bootstrapped:
        return

    functions_path = str(FUNCTIONS_DIR)
    if functions_path not in sys.path:
        sys.path.insert(0, functions_path)

    try:
        from import_pipeline import image_utils  # type: ignore

        image_utils.LOCAL_IMAGE_BUCKET_BASE = str(IMAGES_DIR) + "/"
        logger.info("Configured image_utils to use %s", IMAGES_DIR)
    except Exception as e:  # noqa: BLE001
        logger.warning("Could not configure image_utils yet: %s", e)

    _bootstrapped = True


def ensure_functions_available() -> Path:
    bootstrap_functions_path()
    if not FUNCTIONS_DIR.is_dir():
        raise RuntimeError(f"functions/ not found at {FUNCTIONS_DIR}")
    return FUNCTIONS_DIR
