from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Keyword(Base):
    __tablename__ = "keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    keyword: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    captures: Mapped[list["Capture"]] = relationship(back_populates="keyword", cascade="all, delete-orphan")
    results: Mapped[list["SerpResult"]] = relationship(back_populates="keyword", cascade="all, delete-orphan")


class Capture(Base):
    __tablename__ = "captures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    keyword_id: Mapped[int] = mapped_column(ForeignKey("keywords.id", ondelete="CASCADE"), nullable=False, index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="excel", server_default="excel")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    keyword: Mapped[Keyword] = relationship(back_populates="captures")
    results: Mapped[list["SerpResult"]] = relationship(back_populates="capture", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("keyword_id", "captured_at", name="uq_captures_keyword_time"),)


class SerpResult(Base):
    __tablename__ = "serp_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    capture_id: Mapped[int] = mapped_column(ForeignKey("captures.id", ondelete="CASCADE"), nullable=False, index=True)
    keyword_id: Mapped[int] = mapped_column(ForeignKey("keywords.id", ondelete="CASCADE"), nullable=False, index=True)
    rank: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)

    capture: Mapped[Capture] = relationship(back_populates="results")
    keyword: Mapped[Keyword] = relationship(back_populates="results")

    __table_args__ = (
        UniqueConstraint("capture_id", "rank", name="uq_serp_results_capture_rank"),
        Index("ix_serp_results_keyword_domain", "keyword_id", "domain"),
    )
