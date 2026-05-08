const ASSISTANCE_PATTERNS = [
  /^\s*help\s*[\?\!\.]*\s*$/i,
  /\bi need (your )?help\b/i,
  /\bi need assistance\b/i,
  /\bcan you help me\b/i,
  /\bcould you help me\b/i,
  /\bassist me\b/i,
  /\bwhat can you help with\b/i,
  /\bplease help\b/i
];

export function isAssistanceRequest(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  return ASSISTANCE_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildAssistanceResponse() {
  return [
    "Of course - what would you like help with?",
    "",
    "I can explain:",
    "- human rights",
    "- the Human Rights Act",
    "- Equality Act protections",
    "- privacy and Article 8 rights",
    "- constitutional law concepts"
  ].join("\n");
}
