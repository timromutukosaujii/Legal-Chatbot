import os
import requests

from .prompts import PROMPT_TEMPLATE

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip()
OLLAMA_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "llama3.1:8b").strip()
USE_OLLAMA = os.getenv("CHAT_PROVIDER", "").lower() == "ollama"


def build_prompt(query: str, context: str) -> str:
    return PROMPT_TEMPLATE.format(context=context or "No relevant context found.", query=query)


def _with_history(prompt: str, history: list[dict]) -> str:
    recent = []
    for msg in (history or [])[-6:]:
        role = msg.get("role")
        text = msg.get("text", "").strip()
        if role in ("user", "assistant") and text:
            recent.append(f"{role.title()}: {text}")
    if not recent:
        return prompt
    return f"Conversation history:\n" + "\n".join(recent) + f"\n\n{prompt}"


def generate_answer(query: str, context: str, history: list[dict] | None = None) -> str:
    prompt = _with_history(build_prompt(query, context), history or [])

    if USE_OLLAMA:
        try:
            res = requests.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                },
                timeout=60,
            )
            res.raise_for_status()
            data = res.json()
            answer = (data.get("message", {}).get("content") or "").strip()
            if answer:
                return answer
        except Exception:
            pass

    if OPENAI_API_KEY:
        try:
            from openai import OpenAI

            client = OpenAI()
            response = client.responses.create(
                model=OPENAI_MODEL,
                input=[{"role": "user", "content": prompt}],
            )
            answer = (response.output_text or "").strip()
            if answer:
                return answer
        except Exception:
            pass

    return "I don't know"
