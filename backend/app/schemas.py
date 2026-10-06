from datetime import datetime
from pydantic import BaseModel


class KeywordOut(BaseModel):
    id: int
    keyword: str
    active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class LatestResult(BaseModel):
    rank: int
    name: str
    domain: str | None = None
    url: str | None = None
    title: str | None = None


class TrendPoint(BaseModel):
    captured_at: datetime
    rank: int
    name: str
    domain: str | None = None


class CaptureSummary(BaseModel):
    id: int
    keyword: str
    captured_at: datetime
    result_count: int


class DashboardOut(BaseModel):
    keyword: str
    report_start: str | None = None
    report_end: str | None = None
    report_date: str | None = None
    resolution: str
    hour_filter: int | None = None
    capture_count: int
    daily_capture_count: int
    first_capture_at: datetime | None
    latest_capture: CaptureSummary | None
    latest_results: list[LatestResult]
    trend: list[TrendPoint]
    heatmap: list[TrendPoint]
    heatmap_date: str | None = None
    hollywoodbets_current_rank: int | None = None
    hollywoodbets_best_rank: int | None = None
    hollywoodbets_worst_rank: int | None = None
    hollywoodbets_average_rank: float | None = None
    competitors_tracked: int = 0
    top3_capture_count: int = 0
