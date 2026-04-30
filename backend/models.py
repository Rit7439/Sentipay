"""
Pydantic models for the Smart Payment Failure Analyzer.
Defines request/response schemas for the API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid


# ─── Enums / Literals ────────────────────────────────────────────────────────

FailureCategory = Literal["bank_issue", "network_issue", "insufficient_funds", "unknown"]
ConfidenceLevel = Literal["high", "medium", "low"]


# ─── Input Models ─────────────────────────────────────────────────────────────

class TransactionLog(BaseModel):
    """A single raw payment failure log entry."""
    transaction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: Optional[str] = Field(default_factory=lambda: datetime.now().isoformat())
    amount: Optional[float] = None
    currency: Optional[str] = "USD"
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    payment_method: Optional[str] = None   # card, upi, wallet, net_banking
    bank_name: Optional[str] = None
    merchant: Optional[str] = None
    raw_log: Optional[str] = None          # free-text raw log line


class BatchLogRequest(BaseModel):
    """Request body for analyzing multiple transaction logs."""
    logs: List[TransactionLog]
    use_llm: bool = Field(default=True, description="Enable LLM classification for ambiguous logs")


# ─── Output Models ────────────────────────────────────────────────────────────

class Suggestion(BaseModel):
    """Retry and alternate payment suggestions."""
    retry_timing: str
    retry_attempts: int
    alternate_methods: List[str]
    action: str


class ClassificationResult(BaseModel):
    """Result for a single transaction classification."""
    transaction_id: str
    failure_category: FailureCategory
    confidence: ConfidenceLevel
    classifier_used: Literal["rule_based", "llm"]
    matched_rule: Optional[str] = None
    suggestion: Suggestion
    human_insight: str            # LLM-generated plain English explanation
    technical_detail: str         # Short technical summary


class BatchAnalysisResponse(BaseModel):
    """Response for a batch of analyzed logs."""
    total_processed: int
    results: List[ClassificationResult]
    summary: dict                 # category counts, confidence breakdown


class SampleLogsResponse(BaseModel):
    """Sample logs for demo / testing."""
    logs: List[TransactionLog]
