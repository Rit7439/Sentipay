"""
FastAPI main application — Smart Payment Failure Analyzer backend.

Endpoints:
  POST /analyze        — analyze a batch of transaction logs
  GET  /sample-logs    — return sample logs for demo / testing
  GET  /health         — health check
  POST /chat           — PayBot AI guide chatbot
"""

import logging
from collections import Counter
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    TransactionLog,
    BatchLogRequest,
    BatchAnalysisResponse,
    ClassificationResult,
    SampleLogsResponse,
)
from classifier import classify
from suggester import get_suggestion
from insights import generate_insight, generate_technical_detail
from chatbot import router as chatbot_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Payment Failure Analyzer",
    description="AI-powered payment failure classification, suggestion, and insight engine.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chatbot_router)


# ─── Sample Logs ──────────────────────────────────────────────────────────────

SAMPLE_LOGS = [
    TransactionLog(
        transaction_id="TXN-001",
        timestamp="2024-01-15T09:23:11",
        amount=249.99,
        currency="USD",
        error_code="insufficient_funds",
        error_message="Customer account balance too low to complete transaction",
        payment_method="card",
        bank_name="Chase Bank",
        merchant="TechStore Pro",
    ),
    TransactionLog(
        transaction_id="TXN-002",
        timestamp="2024-01-15T09:45:02",
        amount=89.00,
        currency="USD",
        error_code="timeout",
        error_message="Gateway connection timed out after 30 seconds",
        payment_method="net_banking",
        bank_name="Wells Fargo",
        merchant="FastShop",
    ),
    TransactionLog(
        transaction_id="TXN-003",
        timestamp="2024-01-15T10:02:17",
        amount=1200.00,
        currency="USD",
        error_code="do_not_honor",
        error_message="Transaction declined by issuing bank",
        payment_method="card",
        bank_name="Bank of America",
        merchant="LuxuryMart",
    ),
    TransactionLog(
        transaction_id="TXN-004",
        timestamp="2024-01-15T10:15:33",
        amount=45.50,
        currency="USD",
        error_code="connection_reset",
        error_message="Network connection was reset during payment processing",
        payment_method="upi",
        bank_name="SBI",
        merchant="QuickEats",
    ),
    TransactionLog(
        transaction_id="TXN-005",
        timestamp="2024-01-15T10:30:55",
        amount=500.00,
        currency="USD",
        error_code="card_declined",
        error_message="Card has been blocked by the issuing bank",
        payment_method="card",
        bank_name="HDFC",
        merchant="TravelBooker",
    ),
    TransactionLog(
        transaction_id="TXN-006",
        timestamp="2024-01-15T11:05:42",
        amount=199.99,
        currency="USD",
        error_code=None,
        error_message=None,
        payment_method="wallet",
        bank_name=None,
        merchant="GameZone",
        raw_log="[ERROR] Payment wallet returned status: BALANCE_INSUFFICIENT. "
                "User wallet balance: $12.30. Transaction amount: $199.99.",
    ),
    TransactionLog(
        transaction_id="TXN-007",
        timestamp="2024-01-15T11:22:18",
        amount=75.00,
        currency="USD",
        error_code="service_unavailable",
        error_message="Payment gateway returned HTTP 503 Service Unavailable",
        payment_method="card",
        bank_name="Citibank",
        merchant="HealthPlus",
    ),
    TransactionLog(
        transaction_id="TXN-008",
        timestamp="2024-01-15T11:45:09",
        amount=320.00,
        currency="USD",
        error_code=None,
        error_message=None,
        payment_method="card",
        bank_name="ICICI",
        merchant="MegaMart",
        raw_log="[WARN] Unusual transaction pattern detected. Fraud score: 87/100. "
                "Transaction blocked by risk engine. Customer flagged for review.",
    ),
]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Smart Payment Failure Analyzer"}


@app.get("/sample-logs", response_model=SampleLogsResponse)
async def get_sample_logs():
    """Return demo transaction logs for frontend testing."""
    return SampleLogsResponse(logs=SAMPLE_LOGS)


@app.post("/analyze", response_model=BatchAnalysisResponse)
async def analyze_logs(request: BatchLogRequest):
    """
    Analyze a batch of failed transaction logs.
    Returns classification, suggestion, and LLM-generated human insight for each.
    """
    if not request.logs:
        raise HTTPException(status_code=400, detail="No logs provided")
    if len(request.logs) > 100:
        raise HTTPException(status_code=400, detail="Max 100 logs per batch")

    results = []
    category_counter: Counter = Counter()
    confidence_counter: Counter = Counter()

    for log in request.logs:
        try:
            # Phase 1 + 2: Classify
            category, confidence, matched_rule, classifier_used = classify(
                log, use_llm=request.use_llm
            )

            # Phase 3: Suggest
            suggestion = get_suggestion(category)

            # Phase 4: Technical detail (fast, no LLM)
            tech_detail = generate_technical_detail(log, category, classifier_used)

            # Build partial result (needed by insight generator)
            partial = ClassificationResult(
                transaction_id=log.transaction_id,
                failure_category=category,
                confidence=confidence,
                classifier_used=classifier_used,
                matched_rule=matched_rule,
                suggestion=suggestion,
                human_insight="",       # filled below
                technical_detail=tech_detail,
            )

            # Phase 4: Human-readable LLM insight
            human_insight = generate_insight(log, partial)

            result = ClassificationResult(
                transaction_id=log.transaction_id,
                failure_category=category,
                confidence=confidence,
                classifier_used=classifier_used,
                matched_rule=matched_rule,
                suggestion=suggestion,
                human_insight=human_insight,
                technical_detail=tech_detail,
            )

            results.append(result)
            category_counter[category] += 1
            confidence_counter[confidence] += 1

        except Exception as exc:
            logger.error("Error processing log %s: %s", log.transaction_id, exc)
            # Return a graceful error entry rather than crashing
            results.append(ClassificationResult(
                transaction_id=log.transaction_id,
                failure_category="unknown",
                confidence="low",
                classifier_used="rule_based",
                matched_rule=f"Error: {exc}",
                suggestion=get_suggestion("unknown"),
                human_insight="An error occurred while analyzing this transaction. Please retry.",
                technical_detail=f"[ERROR] {exc}",
            ))
            category_counter["unknown"] += 1

    summary = {
        "categories": dict(category_counter),
        "confidence_levels": dict(confidence_counter),
        "llm_used": request.use_llm,
    }

    logger.info("Processed %d logs: %s", len(results), dict(category_counter))
    return BatchAnalysisResponse(
        total_processed=len(results),
        results=results,
        summary=summary,
    )
