const CASUAL_PATTERNS = [
  /^(hi|hello|hey|yo)\b/i,
  /\bhow are you\b/i,
  /\bhow are u\b/i,
  /\bgood (morning|afternoon|evening)\b/i,
  /\bthanks?\b/i,
  /\bthank you\b/i
];

const UNSAFE_ADVICE_PATTERNS = [
  /\bhelp me sue\b/i,
  /\bsue my\b/i,
  /\bshould i sue\b/i,
  /\bwill i win\b/i,
  /\bwin my case\b/i,
  /\bchances of winning\b/i,
  /\bcan i win\b/i,
  /\bwhat should i do\b/i,
  /\bcan i claim compensation\b/i,
  /\bwhat should i say in court\b/i,
  /\bwrite a legal letter\b/i,
  /\bfor my case\b/i,
  /\bcan you draft\b/i,
  /\bcan i sue\b/i
];

const ASSISTANT_META_PHRASES = [
  "what can you do",
  "what can u do",
  "what do you do",
  "how can you help me",
  "how can you help",
  "what are your features",
  "show me your features",
  "features",
  "capabilities",
  "tell me about your features",
  "tell me about features",
  "what are your capabilities",
  "how does this work",
  "how does this chatbot work",
  "how does this assistant work",
  "how do you work",
  "what sources do you use",
  "what laws do you cover",
  "are you based on chatgpt",
  "who are you"
];

function normalizeForIntent(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\bsould\b/g, "should")
    .replace(/\btp\b/g, "to")
    .replace(/\bsue my employee\b/g, "sue my employer")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyIntent(message) {
  const text = normalizeForIntent(message);
  if (!text) return { intent: "casual" };

  if (CASUAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return { intent: "casual" };
  }

  if (UNSAFE_ADVICE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { intent: "unsafe_advice" };
  }

  if (
    /^(help)$/i.test(text) ||
    /\bi need (your )?help\b/i.test(text) ||
    /\bi need assistance\b/i.test(text) ||
    /\bcan you help me\b/i.test(text) ||
    /\bcould you help me\b/i.test(text) ||
    /\bassist me\b/i.test(text) ||
    /\bwhat can you help with\b/i.test(text) ||
    /\bplease help\b/i.test(text)
  ) {
    return { intent: "assistance_request" };
  }

  if (ASSISTANT_META_PHRASES.some((phrase) => text.includes(phrase))) {
    return { intent: "assistant_meta" };
  }

  return { intent: "legal_question" };
}
