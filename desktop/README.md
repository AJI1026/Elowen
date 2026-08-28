# Elowen desktop app

Packaged as **Electron shell + PyInstaller `elowen-api` sidecar**.

The window loads `http://127.0.0.1:<port>/` where the sidecar serves both the
REST API (`/api/...`) and the built frontend (`frontend/dist`).

User data (SQLite + images) goes to the OS app data folder, e.g.
`~/Library/Application Support/Elowen` on macOS.

## Build installer

From the **repo root**:

```bash
chmod +x scripts/build-desktop.sh
./scripts/build-desktop.sh
```

Outputs land in `desktop/release/` (`.dmg` / `.zip` on macOS, etc.).

Requirements:

- Node 20+
- Python 3.10 or 3.11 (not 3.14)
- On macOS: Xcode CLT

## Dev-run Electron against an existing sidecar

```bash
# Build API binary once
./scripts/build-desktop.sh   # or only the pyinstaller step

cd desktop && npm install && npm start
```

## Notes

- First launch may take a few seconds while the API boots and seeds the DB.
- Server-side import still needs `ELOWEN_API_KEY` / `functions/models/api_config.py`
  available to the sidecar environment if you use that feature.
