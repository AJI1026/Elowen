#!/usr/bin/env python3
"""Desktop / PyInstaller entrypoint for the Elowen API + static UI."""

from __future__ import annotations

import os
import sys


def _prepare_paths() -> None:
    # When frozen, ensure bundled modules are importable.
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        meipass = sys._MEIPASS  # type: ignore[attr-defined]
        for extra in (meipass, os.path.join(meipass, "functions")):
            if extra not in sys.path:
                sys.path.insert(0, extra)
    else:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        backend = os.path.join(root, "backend")
        functions = os.path.join(root, "functions")
        for p in (backend, functions):
            if p not in sys.path:
                sys.path.insert(0, p)


def main() -> None:
    _prepare_paths()
    # Default host for desktop: loopback only
    os.environ.setdefault("ELOWEN_API_HOST", "127.0.0.1")
    os.environ.setdefault("ELOWEN_API_PORT", "17832")

    import uvicorn

    from app.main import app
    from app.config import API_HOST, API_PORT, DATA_DIR, STATIC_DIR, ensure_data_dirs

    ensure_data_dirs()
    print(f"Elowen API on http://{API_HOST}:{API_PORT}", flush=True)
    print(f"Data dir: {DATA_DIR}", flush=True)
    if STATIC_DIR:
        print(f"Static UI: {STATIC_DIR}", flush=True)
    uvicorn.run(app, host=API_HOST, port=API_PORT, log_level="info")


if __name__ == "__main__":
    main()
