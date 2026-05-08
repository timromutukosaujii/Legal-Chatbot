const FOLLOW_UP_PATTERNS = [
  /^(explain|elaborate|clarify|summar(?:ize|ise)|summary|short|brief|bullets?)$/i,
  /\b(summar(?:ize|ise|ized|ised|izing|ising)|summary)\b/i,
  /\b(bullet|bullet points|in points|list format)\b/i,
  /\b(explain it|explain more|tell me more|clarify)\b/i,
  /\b(simplify|simplfy|simple explanation|make it simple|make it shorter|shorter|brief)\b/i,
  /\b(examples?)\b/i,
  /\b(this|that|it)\b/i
];

export function detectFollowUpIntent(message) {
  const text = String(message || "").trim();
  if (!text) return { isFollowUp: false };
  const isFollowUp = FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(text));
  return { isFollowUp };
}
