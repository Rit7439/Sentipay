"""
Chat endpoint — PayBot AI Guide.
Uses Groq LLaMA 3.3 70B to answer questions about payment failures,
guide users through the app, and explain insights.
"""

import os
import logging
from groq import Groq
from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter()

GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are PayBot, an expert AI assistant for the Smart Payment Failure Analyzer.
You help business owners and developers understand payment failures, retry strategies, and how to use this tool.

You are knowledgeable about:
- Payment failure categories: bank issues, network issues, insufficient funds
- Retry timing strategies for each failure type
- Alternate payment methods (UPI, wallets, BNPL, net banking, cards)
- How to read transaction logs and error codes
- How to use this app (upload logs, analyze, read insights, view trends)
- Indian payment ecosystem (UPI, Paytm, PhonePe, GPay, NEFT, IMPS)
- Global payment codes (Visa, Mastercard, ISO 8583 codes)

Keep answers concise (2-4 sentences), helpful, and actionable. Use emojis sparingly for friendliness.
Never make up specific technical data. If unsure, say so and suggest checking with their payment gateway.
"""


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    powered_by: str = "Groq LLaMA 3.3 70B"


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """PayBot — AI guide for the payment failure analyzer."""
    api_key = os.getenv("GROQ_API_KEY", "")

    if not api_key or api_key == "your_groq_api_key_here":
        return ChatResponse(
            reply="I'm PayBot! 🤖 I need a Groq API key to answer your questions. "
                  "Add GROQ_API_KEY to your backend/.env file to enable me.",
            powered_by="fallback"
        )

    try:
        client = Groq(api_key=api_key)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in request.messages[-10:]:  # keep last 10 for context
            messages.append({"role": msg.role, "content": msg.content})

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=300,
            temperature=0.5,
            messages=messages,
        )
        reply = response.choices[0].message.content.strip()
        return ChatResponse(reply=reply)
    except Exception as exc:
        logger.error("PayBot chat error: %s", exc)
        return ChatResponse(
            reply="Sorry, I ran into an issue. Please try again in a moment! 🙏",
            powered_by="error"
        )
