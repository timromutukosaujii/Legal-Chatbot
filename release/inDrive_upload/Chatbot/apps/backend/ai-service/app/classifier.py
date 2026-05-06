import re

GREETING_PATTERNS = [
    r"^hi(\b|\s)",
    r"^hello(\b|\s)",
    r"^hey(\b|\s)",
    r"^good\s+(morning|afternoon|evening)\b",
    r"\bhow are you\b",
]

ADVICE_PATTERNS = [
    r"\bwhat should i do\b",
    r"\bmy situation\b",
    r"\bcan i sue\b",
    r"\blegal advice\b",
    r"\bshould i take action\b",
    r"\bmy case\b",
    r"\bshould i\b",
]


def classify_query(query: str) -> str:
    q = query.strip().lower()
    if not q:
        return "legal_info"
    if any(re.search(pattern, q) for pattern in GREETING_PATTERNS):
        return "greeting"
    if any(re.search(pattern, q) for pattern in ADVICE_PATTERNS):
        return "advice_seeking"
    return "legal_info"
