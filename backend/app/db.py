"""SQLAlchemy models for Elowen local SQLite store."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    title: Mapped[str] = mapped_column(String(512), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    paper_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    priority: Mapped[int] = mapped_column(Integer, default=0, index=True)


class Paper(Base):
    __tablename__ = "papers"

    paper_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    loading_status: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PaperMetadata(Base):
    __tablename__ = "paper_metadata"

    paper_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    featured_image_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class PaperVersion(Base):
    __tablename__ = "paper_versions"
    __table_args__ = (UniqueConstraint("paper_id", "version", name="uq_paper_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    paper_id: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[str] = mapped_column(String(32))
    loading_status: Mapped[str] = mapped_column(String(64), default="", index=True)
    loading_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    elowen_doc_json: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_feedback_text: Mapped[str] = mapped_column(Text)
    arxiv_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    arxiv_id: Mapped[str] = mapped_column(String(64), default="")
    version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answer_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ImportAttempt(Base):
    __tablename__ = "import_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
