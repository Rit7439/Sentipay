"""
LLM Insight Layer — Phase 4 (powered by Groq / LLaMA 3.3 70B).

Takes the classified log + suggestion and produces:
  1. A plain-English 2-sentence summary for business users.
  2. A concise technical detail line for developers.
"""

import os
import logging
from groq import Groq
from dotenv import load_dotenv

from models import TransactionLog, ClassificationResult

load_dotenv()
logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"

INSIGHT_PROMPT = """You are a payment systems expert writing for a non-technical business owner.

Given the following payment failure analysis, write exactly 2 plain-English sentences that explain:
1. Why the payment failed.
2. What the business should do next.

Keep the language simple, friendly, and actionable. Do NOT use technical codes or jargon.

--- Analysis ---
Transaction ID: {transaction_id}
Failure Category: {category}
Error Code: {error_code}
Error Message: {error_message}
Amount: {amount} {currency}
Payment Method: {payment_method}
Suggested Action: {action}
Alternate Methods: {alternates}
---

Respond with just the 2 sentences, nothing else."""

# ─── Fallback messages when Groq is unavailable ───────────────────────────────

FALLBACK_INSIGHTS = {
    "bank_issue": (
        "This payment was declined by the customer's bank. "
        "We recommend asking the customer to contact their bank or use an alternative payment method like UPI."
    ),
    "network_issue": (
        "This payment failed due to a temporary network or connectivity issue. "
        "The system will automatically retry — no action is needed from the customer right now."
    ),
    "insufficient_funds": (
        "This payment failed because the customer did not have enough funds in their account. "
        "Consider offering a split-payment or Buy Now Pay Later option to complete the sale."
    ),
    "unknown": (
        "This payment failed for an unidentified reason. "
        "Please prompt the customer to try again with a different payment method or contact support."
    ),
}


def generate_insight(log: TransactionLog, result: ClassificationResult) -> str:
    """Generate a plain-English 2-sentence insight via Groq LLaMA 3.3 70B."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        return FALLBACK_INSIGHTS.get(result.failure_category, FALLBACK_INSIGHTS["unknown"])

    prompt = INSIGHT_PROMPT.format(
        transaction_id=log.transaction_id,
        category=result.failure_category.replace("_", " ").title(),
        error_code=log.error_code or "N/A",
        error_message=log.error_message or "N/A",
        amount=log.amount or "N/A",
        currency=log.currency or "USD",
        payment_method=log.payment_method or "N/A",
        action=result.suggestion.action,
        alternates=", ".join(result.suggestion.alternate_methods),
    )

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=200,
            temperature=0.3,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful payment analyst. Write clear, concise business insights.",
                },
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("Groq insight generation error: %s", exc)
        return FALLBACK_INSIGHTS.get(result.failure_category, FALLBACK_INSIGHTS["unknown"])


def generate_technical_detail(log: TransactionLog, category: str, classifier: str) -> str:
    """One-line technical summary — always deterministic, no LLM call."""
    parts = []
    if log.error_code:
        parts.append(f"code={log.error_code}")
    if log.error_message:
        parts.append(f"msg='{log.error_message[:60]}'")
    if log.payment_method:
        parts.append(f"method={log.payment_method}")
    parts.append(f"classifier={classifier}")
    return f"[{category.upper()}] " + " | ".join(parts)
