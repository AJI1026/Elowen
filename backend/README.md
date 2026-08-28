# Elowen local backend

FastAPI + SQLite + filesystem images. Replaces Firebase emulators for local
development and is shaped for a future downloadable desktop app.

## Run (without Docker)

```bash
# From repo root — prefer Python 3.10 or 3.11
python3.10 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

export PYTHONPATH="$PWD/backend:$PWD/functions"
export ELOWEN_DATA_DIR="$PWD/data"
cd backend && uvicorn app.main:app --reload --port 8000
```

## Run (Docker)

```bash
docker compose up --build
```

## Endpoints

- `GET /api/health`
- `GET /api/collections`
- `GET /api/papers/{id}/metadata`
- `GET /api/papers/{id}/versions/{v}`
- `GET /api/papers/{id}/status`
- `POST /api/import` `{ "arxiv_id": "..." }`
- `POST /api/ask`
- `POST /api/personal-summary`
- `POST /api/feedback`
- `GET /api/images/{path}`
