import re
from .prompts import DISCLAIMER

ADVICE_PATTERNS = [
    r"\bwhat should i do\b",
    r"\bmy situation\b",
    r"\bcan i sue\b",
    r"\blegal advice\b",
    r"\bshould i take action\b",
    r"\bmy case\b",
    r"\bshould i\b",
]


def is_advice_query(query: str) -> bool:
    q = query.lower()
    return any(re.search(pattern, q) for pattern in ADVICE_PATTERNS)


def refusal_message() -> str:
    return (
        "I can provide general legal information, but I cannot advise on your specific case or actions. "
        "Please contact an official advice service or qualified legal professional for personalised support."
    )


def inject_disclaimer(answer: str) -> str:
    if DISCLAIMER.lower() in answer.lower():
        return answer
    return f"{answer} {DISCLAIMER}"
