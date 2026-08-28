"""Import pipeline orchestration (replaces Firestore triggers)."""

from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from dacite import Config, from_dict
from sqlalchemy.orm import Session

from . import repository as repo
from .functions_bootstrap import bootstrap_functions_path

logger = logging.getLogger(__name__)

RELOAD_ERROR_STATES = {
    "ERROR_DOCUMENT_LOAD",
    "ERROR_DOCUMENT_LOAD_INVALID_RESPONSE",
    "ERROR_DOCUMENT_LOAD_QUOTA_EXCEEDED",
    "ERROR_SUMMARIZING",
    "ERROR_SUMMARIZING_INVALID_RESPONSE",
    "ERROR_SUMMARIZING_QUOTA_EXCEEDED",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def request_import(session: Session, arxiv_id: str) -> dict[str, Any]:
    """Start an arXiv import; returns {metadata?, error?}."""
    bootstrap_functions_path()
    from import_pipeline import fetch_utils  # type: ignore
    from shared.constants import ARXIV_ID_MAX_LENGTH  # type: ignore
    from shared.json_utils import convert_keys  # type: ignore

    if not arxiv_id or len(arxiv_id) > ARXIV_ID_MAX_LENGTH:
        raise ValueError("Invalid arxiv_id")

    try:
        fetch_utils.check_arxiv_license(arxiv_id)
    except ValueError as e:
        return {"error": str(e)}

    arxiv_metadata_list = fetch_utils.fetch_arxiv_metadata(arxiv_ids=[arxiv_id])
    if len(arxiv_metadata_list) != 1:
        raise RuntimeError("Arxiv returned invalid metadata")

    metadata = arxiv_metadata_list[0]
    metadata_camel = convert_keys(asdict(metadata), "snake_to_camel")
    version = str(metadata.version)
    paper_id = metadata.paper_id

    existing = repo.get_version_doc(session, paper_id, version)
    if existing:
        status = existing.get("loadingStatus")
        sections = existing.get("sections") or []
        is_empty_success = status == "SUCCESS" and not sections
        is_stuck_waiting = status == "WAITING"
        if (
            status not in RELOAD_ERROR_STATES
            and not is_empty_success
            and not is_stuck_waiting
            and status != "TIMEOUT"
        ):
            return {"metadata": metadata_camel}
        if status == "TIMEOUT":
            raise TimeoutError("This paper cannot be loaded (time limit exceeded)")

    doc = {
        "loadingStatus": "WAITING",
        "updatedTimestamp": _now_iso(),
        "metadata": metadata_camel,
    }
    repo.write_version_doc(session, paper_id, version, doc, merge=False)
    repo.upsert_metadata_item(session, paper_id, metadata_camel)
    return {"metadata": metadata_camel}


def process_waiting_import(
    session_factory,
    paper_id: str,
    version: str,
    api_key: str | None = None,
    model_config: dict | None = None,
) -> None:
    """Background: WAITING -> import -> SUMMARIZING -> SUCCESS."""
    bootstrap_functions_path()
    from dataclasses import asdict as dc_asdict

    from dacite import Config as DaciteConfig
    from dacite import from_dict as dacite_from_dict
    from import_pipeline import import_pipeline, summaries  # type: ignore
    from models import extract_concepts  # type: ignore
    from models.request_context import use_model_credentials  # type: ignore
    from shared.elowen_doc import ElowenDoc  # type: ignore
    from shared.json_utils import convert_keys  # type: ignore
    from shared.types import ArxivMetadata, FeaturedImage  # type: ignore

    session = session_factory()
    try:
        doc = repo.get_version_doc(session, paper_id, version)
        if not doc or doc.get("loadingStatus") != "WAITING":
            return

        metadata_dict = doc.get("metadata") or {}
        metadata = ArxivMetadata(**convert_keys(metadata_dict, "camel_to_snake"))

        with use_model_credentials(api_key=api_key, model_config=model_config):
            concepts = extract_concepts.extract_concepts(metadata.summary)

            try:
                elowen_doc, first_image_path = import_pipeline.import_arxiv_latex_and_pdf(
                    arxiv_id=metadata.paper_id,
                    version=metadata.version,
                    concepts=concepts,
                    metadata=metadata,
                    run_locally=True,
                )
                elowen_doc.loading_status = "SUMMARIZING"
                elowen_doc.updated_timestamp = _now_iso()
                elowen_json = convert_keys(dc_asdict(elowen_doc), "snake_to_camel")
                # Enum values may need string coercion
                if hasattr(elowen_doc.loading_status, "value"):
                    elowen_json["loadingStatus"] = elowen_doc.loading_status.value
                else:
                    elowen_json["loadingStatus"] = "SUMMARIZING"

                repo.write_version_doc(
                    session, paper_id, version, elowen_json, merge=False
                )
                featured = None
                if first_image_path:
                    featured = convert_keys(
                        dc_asdict(FeaturedImage(image_storage_path=first_image_path)),
                        "snake_to_camel",
                    )
                repo.upsert_metadata_item(
                    session,
                    paper_id,
                    convert_keys(dc_asdict(metadata), "snake_to_camel"),
                    featured_image=featured,
                )
            except Exception as e:  # noqa: BLE001
                logger.exception("Document import failed for %s", paper_id)
                repo.write_version_doc(
                    session,
                    paper_id,
                    version,
                    {
                        **doc,
                        "loadingStatus": "ERROR_DOCUMENT_LOAD",
                        "loadingError": f"Error loading document: {e}",
                        "updatedTimestamp": _now_iso(),
                    },
                    merge=False,
                )
                return

            # Summarize
            doc = repo.get_version_doc(session, paper_id, version) or {}
            try:
                parsed = dacite_from_dict(
                    data_class=ElowenDoc,
                    data=convert_keys(doc, "camel_to_snake"),
                    config=DaciteConfig(check_types=False),
                )
                parsed.summaries = summaries.generate_elowen_summaries(parsed)
                parsed.loading_status = "SUCCESS"
                parsed.updated_timestamp = _now_iso()
                out = convert_keys(dc_asdict(parsed), "snake_to_camel")
                out["loadingStatus"] = "SUCCESS"
                repo.write_version_doc(session, paper_id, version, out, merge=False)
            except Exception as e:  # noqa: BLE001
                logger.exception("Summarizing failed for %s", paper_id)
                repo.write_version_doc(
                    session,
                    paper_id,
                    version,
                    {
                        **doc,
                        "loadingStatus": "ERROR_SUMMARIZING",
                        "loadingError": f"Error summarizing document: {e}",
                        "updatedTimestamp": _now_iso(),
                    },
                    merge=False,
                )
    finally:
        session.close()


def generate_answer(
    doc_dict: dict, request_dict: dict, model_config: dict | None, api_key: str | None
) -> dict:
    bootstrap_functions_path()
    from dataclasses import asdict as dc_asdict

    from answers import answers  # type: ignore
    from models.request_context import use_model_credentials  # type: ignore
    from shared.api import ElowenAnswerRequest  # type: ignore
    from shared.constants import MAX_HIGHLIGHT_LENGTH, MAX_QUERY_LENGTH  # type: ignore
    from shared.elowen_doc import ElowenDoc  # type: ignore
    from shared.json_utils import convert_keys  # type: ignore

    doc = from_dict(
        data_class=ElowenDoc,
        data=convert_keys(doc_dict, "camel_to_snake"),
        config=Config(check_types=False),
    )
    elowen_request = from_dict(
        data_class=ElowenAnswerRequest,
        data=convert_keys(request_dict, "camel_to_snake"),
        config=Config(check_types=False),
    )
    if elowen_request.query and len(elowen_request.query) > MAX_QUERY_LENGTH:
        raise ValueError("Query exceeds max length.")
    if elowen_request.highlight and len(elowen_request.highlight) > MAX_HIGHLIGHT_LENGTH:
        raise ValueError("Highlight exceeds max length.")

    effective_key = api_key or (model_config or {}).get("apiKey")
    with use_model_credentials(api_key=effective_key, model_config=model_config):
        elowen_answer = answers.generate_elowen_answer(
            doc, elowen_request, effective_key, model_config
        )
    return convert_keys(dc_asdict(elowen_answer), "snake_to_camel")


def generate_personal_summary(
    doc_dict: dict,
    past_papers_dict: list,
    model_config: dict | None,
    api_key: str | None,
) -> dict:
    bootstrap_functions_path()
    from dataclasses import asdict as dc_asdict

    from import_pipeline import personal_summary  # type: ignore
    from models.request_context import use_model_credentials  # type: ignore
    from shared.elowen_doc import ElowenDoc  # type: ignore
    from shared.json_utils import convert_keys  # type: ignore
    from shared.types_local_storage import PaperData  # type: ignore

    doc = from_dict(
        data_class=ElowenDoc,
        data=convert_keys(doc_dict, "camel_to_snake"),
        config=Config(check_types=False),
    )
    past_papers = [
        from_dict(
            data_class=PaperData,
            data=convert_keys(p, "camel_to_snake"),
            config=Config(check_types=False),
        )
        for p in past_papers_dict
    ]
    effective_key = api_key or (model_config or {}).get("apiKey")
    with use_model_credentials(api_key=effective_key, model_config=model_config):
        summary = personal_summary.get_personal_summary(
            doc, past_papers, effective_key, model_config
        )
    return convert_keys(dc_asdict(summary), "snake_to_camel")
