"""
Hybrid Classifier — Phase 1 (Rule-based) + Phase 2 (LLM fallback via Groq).

Lookup table maps known error codes / message keywords → failure category.
Ambiguous / free-text logs are escalated to the Groq LLM classifier.
Model: llama-3.3-70b-versatile (fast, accurate, free-tier friendly)
"""

import os
import json
import logging
from typing import Tuple
from groq import Groq
from dotenv import load_dotenv

from models import TransactionLog, FailureCategory, ConfidenceLevel

load_dotenv()
logger = logging.getLogger(__name__)

# ─── Rule Table ───────────────────────────────────────────────────────────────

BANK_ISSUE_CODES = {
    "do_not_honor", "card_declined", "restricted_card", "pickup_card",
    "invalid_account", "account_closed", "lost_card", "stolen_card",
    "expired_card", "invalid_pin", "blocked", "card_not_supported",
    "NSF_0041", "05", "14", "41", "43", "57", "62", "65", "78",
}

NETWORK_ISSUE_CODES = {
    "timeout", "connection_reset", "gateway_timeout", "connection_refused",
    "network_error", "service_unavailable", "bad_gateway", "request_timeout",
    "ssl_error", "dns_failure", "socket_error", "read_timeout",
    "96", "91", "99", "Z5", "Z3",
}

INSUFFICIENT_FUNDS_CODES = {
    "insufficient_funds", "insufficient_balance", "nsf", "not_sufficient_funds",
    "balance_too_low", "credit_limit_exceeded", "51", "61",
}

BANK_ISSUE_KEYWORDS = [
    "do not honor", "card declined", "card not accepted", "invalid card",
    "restricted", "card blocked", "bank declined", "issuer declined",
    "authorization failed", "card expired", "invalid pin",
]

NETWORK_ISSUE_KEYWORDS = [
    "timeout", "timed out", "connection", "network", "gateway", "unreachable",
    "service unavailable", "bad gateway", "request failed", "ssl", "socket",
]

INSUFFICIENT_FUNDS_KEYWORDS = [
    "insufficient funds", "insufficient balance", "not enough", "balance low",
    "credit limit", "over limit", "exceed", "no funds",
]


def _normalize(text: str) -> str:
    return text.lower().replace("-", "_").replace(" ", "_").strip()


def rule_based_classify(log: TransactionLog) -> Tuple[FailureCategory, ConfidenceLevel, str]:
    """
    Returns (category, confidence, matched_rule).
    Confidence is 'high' when an exact error code matches, 'medium' for keyword hits.
    """
    # Collect text fields for keyword scanning
    searchable = " ".join(filter(None, [
        log.error_code or "",
        log.error_message or "",
        log.raw_log or "",
    ])).lower()

    # 1. Exact error code match (highest priority)
    if log.error_code:
        norm = _normalize(log.error_code)
        if norm in INSUFFICIENT_FUNDS_CODES:
            return "insufficient_funds", "high", f"Exact code match: {log.error_code}"
        if norm in BANK_ISSUE_CODES:
            return "bank_issue", "high", f"Exact code match: {log.error_code}"
        if norm in NETWORK_ISSUE_CODES:
            return "network_issue", "high", f"Exact code match: {log.error_code}"

    # 2. Keyword scan (medium confidence)
    candidates = []
    for kw in INSUFFICIENT_FUNDS_KEYWORDS:
        if kw in searchable:
            candidates.append(("insufficient_funds", "medium", f"Keyword match: '{kw}'"))
            break
    for kw in NETWORK_ISSUE_KEYWORDS:
        if kw in searchable:
            candidates.append(("network_issue", "medium", f"Keyword match: '{kw}'"))
            break
    for kw in BANK_ISSUE_KEYWORDS:
        if kw in searchable:
            candidates.append(("bank_issue", "medium", f"Keyword match: '{kw}'"))
            break

    if len(candidates) == 1:
        return candidates[0]

    # 3. Ambiguous or no match → escalate to LLM
    return "unknown", "low", "No rule matched"


# ─── Groq LLM Classifier ──────────────────────────────────────────────────────

LLM_CLASSIFY_PROMPT = """You are an expert payment systems analyst.
Classify the following payment failure log into EXACTLY one of these categories:
- bank_issue
- network_issue
- insufficient_funds
- unknown

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "category": "<category>",
  "confidence": "high|medium|low",
  "reason": "<one sentence reason>"
}}

Payment failure log:
{log_text}
"""

GROQ_MODEL = "llama-3.3-70b-versatile"


def llm_classify(log: TransactionLog) -> Tuple[FailureCategory, ConfidenceLevel, str]:
    """Call Groq (LLaMA 3.3 70B) to classify an ambiguous log."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        logger.warning("No Groq API key — falling back to 'unknown'")
        return "unknown", "low", "LLM unavailable (no API key)"

    log_text = "\n".join(filter(None, [
        f"Error Code: {log.error_code}" if log.error_code else "",
        f"Error Message: {log.error_message}" if log.error_message else "",
        f"Payment Method: {log.payment_method}" if log.payment_method else "",
        f"Bank: {log.bank_name}" if log.bank_name else "",
        f"Raw Log: {log.raw_log}" if log.raw_log else "",
    ]))

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=256,
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": "You are a payment failure classifier. Always respond with valid JSON only.",
                },
                {
                    "role": "user",
                    "content": LLM_CLASSIFY_PROMPT.format(log_text=log_text),
                },
            ],
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if model wraps JSON
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        category = data.get("category", "unknown")
        if category not in ("bank_issue", "network_issue", "insufficient_funds", "unknown"):
            category = "unknown"
        confidence = data.get("confidence", "low")
        reason = data.get("reason", "LLM classification")
        return category, confidence, f"LLM ({GROQ_MODEL}): {reason}"
    except Exception as exc:
        logger.error("Groq LLM classification error: %s", exc)
        return "unknown", "low", f"LLM error: {exc}"


def classify(log: TransactionLog, use_llm: bool = True) -> Tuple[FailureCategory, ConfidenceLevel, str, str]:
    """
    Master classifier. Returns (category, confidence, matched_rule, classifier_used).
    Tries rule-based first; falls back to Groq LLM if result is 'unknown' and use_llm=True.
    """
    category, confidence, matched_rule = rule_based_classify(log)

    if category != "unknown":
        return category, confidence, matched_rule, "rule_based"

    if use_llm:
        category, confidence, matched_rule = llm_classify(log)
        return category, confidence, matched_rule, "llm"

    return category, confidence, matched_rule, "rule_based"
