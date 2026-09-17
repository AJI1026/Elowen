"""Load seed JSON into SQLite on first boot."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import SEED_DIR
from .db import Collection, Paper, PaperMetadata, PaperVersion
from .repository import _dumps

logger = logging.getLogger(__name__)


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def seed_if_empty(session: Session, seed_dir: Path | None = None) -> None:
    seed_dir = seed_dir or SEED_DIR
    count = session.scalar(select(func.count()).select_from(Collection)) or 0
    if count > 0:
        logger.info("Database already has collections; skip seed")
        return

    collections_path = seed_dir / "collections.json"
    if not collections_path.exists():
        logger.warning("No seed data at %s", seed_dir)
        return

    collections = json.loads(collections_path.read_text())
    for item in collections:
        cid = item.get("collectionId") or item.get("id")
        if not cid:
            continue
        # Stored order matches seed/export; API reverses for gallery
        paper_ids = item.get("paperIds") or item.get("paper_ids") or []
        session.merge(
            Collection(
                id=cid,
                title=item.get("title") or "",
                summary=item.get("summary") or "",
                paper_ids_json=_dumps(paper_ids),
                priority=int(item.get("priority") or 0),
            )
        )

    metadata_path = seed_dir / "metadata.json"
    if metadata_path.exists():
        for item in json.loads(metadata_path.read_text()):
            paper_id = item.get("_id") or (item.get("metadata") or {}).get("paperId")
            if not paper_id:
                continue
            meta = item.get("metadata") or {}
            featured = item.get("featuredImage")
            session.merge(
                PaperMetadata(
                    paper_id=paper_id,
                    metadata_json=_dumps(meta),
                    featured_image_json=_dumps(featured) if featured else None,
                )
            )

    papers_path = seed_dir / "papers.json"
    if papers_path.exists():
        for item in json.loads(papers_path.read_text()):
            paper_id = item.get("_id") or item.get("paperId")
            if not paper_id:
                continue
            session.merge(
                Paper(
                    paper_id=paper_id,
                    loading_status=item.get("loadingStatus") or "",
                    updated_at=_parse_ts(item.get("updatedTimestamp")),
                )
            )

    versions_path = seed_dir / "versions.json"
    if versions_path.exists():
        for item in json.loads(versions_path.read_text()):
            paper_id = item.get("_paper_id") or (item.get("metadata") or {}).get(
                "paperId"
            )
            version = str(
                item.get("_version")
                or (item.get("metadata") or {}).get("version")
                or "1"
            )
            if not paper_id:
                continue
            doc = {k: v for k, v in item.items() if not k.startswith("_")}
            # Upsert: PaperVersion PK is autoincrement, unique on (paper_id, version)
            existing = session.scalar(
                select(PaperVersion).where(
                    PaperVersion.paper_id == paper_id,
                    PaperVersion.version == version,
                )
            )
            if existing is None:
                session.add(
                    PaperVersion(
                        paper_id=paper_id,
                        version=version,
                        loading_status=doc.get("loadingStatus") or "",
                        loading_error=doc.get("loadingError"),
                        elowen_doc_json=_dumps(doc),
                        updated_at=_parse_ts(doc.get("updatedTimestamp")),
                    )
                )
            else:
                existing.loading_status = doc.get("loadingStatus") or ""
                existing.loading_error = doc.get("loadingError")
                existing.elowen_doc_json = _dumps(doc)
                existing.updated_at = _parse_ts(doc.get("updatedTimestamp"))

    session.commit()
    logger.info("Seeded database from %s", seed_dir)
