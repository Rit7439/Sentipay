"""
Suggestion Engine — Phase 3.

Maps failure categories → retry timing, retry count, and alternate payment methods.
"""

from models import FailureCategory, Suggestion


# ─── Suggestion Rule Table ────────────────────────────────────────────────────

_SUGGESTIONS: dict[str, Suggestion] = {
    "network_issue": Suggestion(
        retry_timing="Retry immediately (30-second intervals)",
        retry_attempts=3,
        alternate_methods=["Card (different network)", "UPI", "Net Banking"],
        action="Automatically retry up to 3 times at 30-second intervals. "
               "If all retries fail, prompt user to switch payment method.",
    ),
    "bank_issue": Suggestion(
        retry_timing="Retry next business day",
        retry_attempts=1,
        alternate_methods=["UPI", "Digital Wallet (Paytm/PhonePe/GPay)", "Net Banking"],
        action="Do not retry immediately. Contact the issuing bank or suggest "
               "the customer use a UPI wallet or alternative card.",
    ),
    "insufficient_funds": Suggestion(
        retry_timing="Retry after expected salary credit (1st or 15th of month)",
        retry_attempts=1,
        alternate_methods=["Split payment / EMI", "UPI with credit line", "Buy Now Pay Later (BNPL)"],
        action="Prompt user to use a split-payment option, BNPL, or a lower-value transaction. "
               "Remind them their salary may credit on the 1st.",
    ),
    "unknown": Suggestion(
        retry_timing="Retry after 5 minutes",
        retry_attempts=2,
        alternate_methods=["Any available alternate payment method"],
        action="Prompt user to retry with an alternative payment method or contact support.",
    ),
}


def get_suggestion(category: FailureCategory) -> Suggestion:
    """Return the canned suggestion for a given failure category."""
    return _SUGGESTIONS.get(category, _SUGGESTIONS["unknown"])
