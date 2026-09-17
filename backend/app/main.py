"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import repository as repo
from . import services
from . import session as db_session
from . import user_settings
from .config import AUTO_SEED, IMAGES_DIR, STATIC_DIR, ensure_data_dirs
from .functions_bootstrap import bootstrap_functions_path
from .seed import seed_if_empty
from .session import get_session, init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_data_dirs()
    init_db()
    bootstrap_functions_path()
    if AUTO_SEED:
        session = db_session.SessionLocal()
        try:
            seed_if_empty(session)
        finally:
            session.close()
    yield


app = FastAPI(title="Elowen API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImportRequest(BaseModel):
    arxiv_id: str = Field(..., min_length=1)
    modelConfig: dict[str, Any] | None = None
    apiKey: str | None = None


class AskRequest(BaseModel):
    doc: dict[str, Any]
    request: dict[str, Any]
    modelConfig: dict[str, Any] | None = None
    apiKey: str | None = None
    # Prior Q&A on this paper (oldest first), for multi-turn context.
    history: list[dict[str, Any]] = Field(default_factory=list)
    # Rolling summary of older turns (optional; produced by previous asks).
    conversationSummary: str | None = None


class PersonalSummaryRequest(BaseModel):
    doc: dict[str, Any]
    past_papers: list[dict[str, Any]] = Field(default_factory=list)
    modelConfig: dict[str, Any] | None = None
    apiKey: str | None = None


class FeedbackRequest(BaseModel):
    user_feedback_text: str
    arxiv_id: str | None = None


class SettingsUpdate(BaseModel):
    modelProvider: str | None = None
    providerSettings: dict[str, Any] | None = None
    responseLanguage: str | None = None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/settings")
def get_settings() -> dict[str, Any]:
    """Read model config from data/settings.json."""
    return user_settings.load_settings()


@app.put("/api/settings")
def put_settings(body: SettingsUpdate) -> dict[str, Any]:
    """Persist model config to data/settings.json."""
    payload = body.model_dump(exclude_none=True)
    return user_settings.save_settings(payload)


@app.get("/api/collections")
def get_collections(session: Session = Depends(get_session)) -> list[dict]:
    return repo.list_collections(session)


@app.get("/api/library")
def get_library(session: Session = Depends(get_session)) -> list[dict]:
    """User's loaded papers (PaperData), persisted in SQLite under data/."""
    return repo.list_library(session)


@app.put("/api/library/{paper_id}")
def put_library_paper(
    paper_id: str, body: dict[str, Any], session: Session = Depends(get_session)
) -> dict:
    try:
        return repo.upsert_library_paper(session, paper_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.delete("/api/library/{paper_id}")
def delete_library_paper(
    paper_id: str, session: Session = Depends(get_session)
) -> dict[str, str]:
    repo.delete_library_paper(session, paper_id)
    return {"status": "ok"}


@app.delete("/api/library")
def clear_library(session: Session = Depends(get_session)) -> dict[str, str]:
    repo.clear_library(session)
    return {"status": "ok"}


@app.get("/api/papers/{paper_id}/metadata-item")
def get_metadata_item(paper_id: str, session: Session = Depends(get_session)) -> dict:
    item = repo.get_metadata_item(session, paper_id)
    if not item:
        raise HTTPException(status_code=404, detail="Metadata not found")
    return item


@app.get("/api/papers/{paper_id}/metadata")
def get_metadata(paper_id: str, session: Session = Depends(get_session)) -> dict:
    metadata = repo.get_arxiv_metadata(session, paper_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="The request paper metadata was not found.")
    return metadata


@app.get("/api/papers/{paper_id}/versions/{version}")
def get_version(
    paper_id: str, version: str, session: Session = Depends(get_session)
) -> dict:
    doc = repo.get_version_doc(session, paper_id, version)
    if not doc:
        raise HTTPException(status_code=404, detail="Document version not found")
    return doc


@app.get("/api/papers/{paper_id}/status")
def get_status(paper_id: str, session: Session = Depends(get_session)) -> dict:
    status = repo.get_paper_status(session, paper_id)
    if not status:
        raise HTTPException(status_code=404, detail="Paper not found")
    return status


@app.post("/api/import")
def import_paper(
    body: ImportRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> dict:
    try:
        result = services.request_import(session, body.arxiv_id.strip())
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("import failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    metadata = result.get("metadata")
    if metadata and not result.get("error"):
        paper_id = metadata.get("paperId") or body.arxiv_id
        version = str(metadata.get("version") or "1")
        api_key = body.apiKey or (body.modelConfig or {}).get("apiKey")
        background_tasks.add_task(
            services.process_waiting_import,
            db_session.SessionLocal,
            paper_id,
            version,
            api_key,
            body.modelConfig,
        )
    return result


@app.post("/api/ask")
def ask(body: AskRequest) -> dict:
    try:
        return services.generate_answer(
            body.doc,
            body.request,
            body.modelConfig,
            body.apiKey,
            body.history,
            body.conversationSummary,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("ask failed")
        raise HTTPException(status_code=503, detail=f"Model call failed: {e}") from e


@app.post("/api/personal-summary")
def personal_summary(body: PersonalSummaryRequest) -> dict:
    try:
        return services.generate_personal_summary(
            body.doc, body.past_papers, body.modelConfig, body.apiKey
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("personal summary failed")
        raise HTTPException(status_code=503, detail=f"Model call failed: {e}") from e


@app.post("/api/feedback")
def feedback(body: FeedbackRequest, session: Session = Depends(get_session)) -> dict:
    if not body.user_feedback_text.strip():
        raise HTTPException(status_code=400, detail="user_feedback_text must not be empty.")
    max_len = 5000
    try:
        bootstrap_functions_path()
        from shared.constants import MAX_USER_FEEDBACK_LENGTH  # type: ignore

        max_len = MAX_USER_FEEDBACK_LENGTH
    except Exception:  # noqa: BLE001
        pass
    if len(body.user_feedback_text) > max_len:
        raise HTTPException(status_code=400, detail="Feedback text exceeds max length.")
    repo.add_feedback(session, body.user_feedback_text, body.arxiv_id)
    return {"status": "success"}


@app.get("/api/images/{image_path:path}")
def get_image(image_path: str):
    # Prevent path traversal
    root = IMAGES_DIR.resolve()
    target = (IMAGES_DIR / image_path).resolve()
    if not str(target).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(target)


# Serve packaged frontend (desktop / single-binary mode)
if STATIC_DIR is not None:
    from fastapi.staticfiles import StaticFiles

    # Mounted last so /api/* keeps precedence
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
    logger.info("Serving frontend from %s", STATIC_DIR)


def run() -> None:
    import uvicorn

    from .config import API_HOST, API_PORT

    uvicorn.run(app, host=API_HOST, port=API_PORT, reload=False)


if __name__ == "__main__":
    run()
