"""Repository helpers for papers / collections."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import Collection, Paper, PaperMetadata, PaperVersion, UserFeedback


def _dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)


def _loads(raw: str | None, default: Any = None) -> Any:
    if not raw:
        return default
    return json.loads(raw)


def list_collections(session: Session, min_priority: int = 0) -> list[dict]:
    rows = session.scalars(
        select(Collection)
        .where(Collection.priority >= min_priority)
        .order_by(Collection.priority.desc())
    ).all()
    result = []
    for row in rows:
        paper_ids = _loads(row.paper_ids_json, [])
        # Match frontend: reverse for display order
        paper_ids = list(reversed(paper_ids)) if isinstance(paper_ids, list) else []
        result.append(
            {
                "collectionId": row.id,
                "title": row.title,
                "summary": row.summary,
                "paperIds": paper_ids,
                "priority": row.priority,
            }
        )
    return result


def get_metadata_item(session: Session, paper_id: str) -> dict | None:
    row = session.get(PaperMetadata, paper_id)
    if not row:
        return None
    item: dict[str, Any] = {"metadata": _loads(row.metadata_json, {})}
    featured = _loads(row.featured_image_json, None)
    if featured:
        item["featuredImage"] = featured
    return item


def get_arxiv_metadata(session: Session, paper_id: str) -> dict | None:
    item = get_metadata_item(session, paper_id)
    if not item:
        return None
    return item.get("metadata")


def upsert_metadata_item(
    session: Session,
    paper_id: str,
    metadata: dict,
    featured_image: dict | None = None,
) -> None:
    row = session.get(PaperMetadata, paper_id)
    if row is None:
        row = PaperMetadata(paper_id=paper_id)
        session.add(row)
    row.metadata_json = _dumps(metadata)
    if featured_image is not None:
        row.featured_image_json = _dumps(featured_image)
    session.commit()


def get_version_doc(session: Session, paper_id: str, version: str) -> dict | None:
    row = session.scalars(
        select(PaperVersion).where(
            PaperVersion.paper_id == paper_id,
            PaperVersion.version == str(version),
        )
    ).first()
    if not row:
        return None
    return _loads(row.elowen_doc_json, {})


def get_paper_status(session: Session, paper_id: str) -> dict | None:
    paper = session.get(Paper, paper_id)
    if not paper:
        # Fall back to newest version row
        row = session.scalars(
            select(PaperVersion)
            .where(PaperVersion.paper_id == paper_id)
            .order_by(PaperVersion.id.desc())
        ).first()
        if not row:
            return None
        return {
            "paperId": paper_id,
            "loadingStatus": row.loading_status,
            "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
            "version": row.version,
        }
    # Prefer latest version for version field
    row = session.scalars(
        select(PaperVersion)
        .where(PaperVersion.paper_id == paper_id)
        .order_by(PaperVersion.id.desc())
    ).first()
    return {
        "paperId": paper_id,
        "loadingStatus": paper.loading_status,
        "updatedAt": paper.updated_at.isoformat() if paper.updated_at else None,
        "version": row.version if row else None,
    }


def upsert_paper(
    session: Session,
    paper_id: str,
    loading_status: str,
    updated_at: datetime | None = None,
) -> None:
    row = session.get(Paper, paper_id)
    if row is None:
        row = Paper(paper_id=paper_id)
        session.add(row)
    row.loading_status = loading_status
    row.updated_at = updated_at or datetime.now(timezone.utc)
    session.commit()


def get_version_row(
    session: Session, paper_id: str, version: str
) -> PaperVersion | None:
    return session.scalars(
        select(PaperVersion).where(
            PaperVersion.paper_id == paper_id,
            PaperVersion.version == str(version),
        )
    ).first()


def write_version_doc(
    session: Session,
    paper_id: str,
    version: str,
    elowen_doc: dict,
    *,
    merge: bool = False,
) -> dict:
    """Write or merge a version document (camelCase ElowenDoc dict)."""
    row = get_version_row(session, paper_id, version)
    if row is None:
        row = PaperVersion(paper_id=paper_id, version=str(version))
        session.add(row)
        existing: dict = {}
    else:
        existing = _loads(row.elowen_doc_json, {}) if merge else {}

    if merge:
        existing.update(elowen_doc)
        doc = existing
    else:
        doc = elowen_doc

    status = doc.get("loadingStatus") or ""
    row.loading_status = status
    row.loading_error = doc.get("loadingError")
    row.elowen_doc_json = _dumps(doc)
    row.updated_at = datetime.now(timezone.utc)

    paper = session.get(Paper, paper_id)
    if paper is None:
        paper = Paper(paper_id=paper_id)
        session.add(paper)
    paper.loading_status = status
    paper.updated_at = row.updated_at

    session.commit()
    return doc


def add_feedback(session: Session, text: str, arxiv_id: str | None) -> None:
    session.add(UserFeedback(user_feedback_text=text, arxiv_id=arxiv_id))
    session.commit()
