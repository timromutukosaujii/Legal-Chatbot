import os
import re
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


def _extractive_fallback(context: str) -> str:
    if not context or context.strip() == "No relevant context found.":
        return "I don't know"

    lines = [line.strip().lstrip("\ufeff") for line in context.splitlines() if line.strip()]
    points: list[str] = []

    def _clean_point(text: str) -> str:
        cleaned = text.lstrip("\ufeff").strip(" .;-")
        cleaned = re.sub(r"\s+", " ", cleaned)
        cleaned = re.sub(r"\bSummary \(general information\)\b", "", cleaned, flags=re.IGNORECASE).strip(" .;-")
        replacements = {
            r"\bunlawful wage deductions\b": "unfair pay deductions",
            r"\bstatutory minimum paid holiday\b": "minimum paid holiday",
            r"\bstatutory sick pay\b": "sick pay",
            r"\bstatutory redundancy pay\b": "redundancy pay",
            r"\bstatutory family[‑-]related pay/leave\b": "family leave and pay",
            r"\bprotections such as\b": "extra rights like",
        }
        for pattern, repl in replacements.items():
            cleaned = re.sub(pattern, repl, cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\badditional extra rights like\b", "extra rights like", cleaned, flags=re.IGNORECASE)
        if len(cleaned) > 180:
            cut = cleaned.rfind(",", 0, 170)
            if cut < 80:
                cut = cleaned.rfind(" ", 0, 170)
            if cut > 0:
                cleaned = cleaned[:cut].strip(" ,.;") + "."
        return cleaned

    for line in lines:
        snippet = line.split(": ", 1)[1].strip() if ": " in line else line
        if not snippet:
            continue

        # Prefer bullet-like facts from the source text, then fall back to sentence chunks.
        raw_parts = [part.strip() for part in snippet.split(" - ") if part.strip()]
        parts = raw_parts if len(raw_parts) > 1 else [part.strip() for part in re.split(r"(?<=[.!?])\s+", snippet) if part.strip()]

        for part in parts:
            clean = _clean_point(part)
            if len(clean) < 20:
                continue
            lower = clean.lower()
            if "employment status" in lower:
                continue
            if clean.endswith((" di", " ap", " r")):
                continue
            lower = clean.lower()
            if any(lower == existing.lower() for existing in points):
                continue
            points.append(clean)
            if len(points) >= 4:
                break
        if len(points) >= 4:
            break

    if not points:
        return "I don't know"

    priority = [
        p for p in points
        if any(term in p.lower() for term in ("entitled to", "have all worker rights", "additional protections"))
    ]
    ordered = priority + [p for p in points if p not in priority]
    formatted = "\n".join(f"- {p}" for p in ordered[:3])
    return f"Here is a simple summary from official UK sources:\n{formatted}"


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

    return _extractive_fallback(context)
