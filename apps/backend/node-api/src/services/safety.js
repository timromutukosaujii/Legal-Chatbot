const ADVICE_PATTERNS = [
  /\bshould i sue\b/i,
  /\bcan i win my case\b/i,
  /\bwhat should i do\b/i,
  /\bam i legally allowed to\b/i,
  /\bcan i claim compensation\b/i,
  /\bcan i sue\b/i,
  /\bcan i win\b/i,
  /\bshould i\b/i,
  /\bwhat should i do next\b/i
];

export const ADVICE_DISCLAIMER =
  "I can provide general legal information, but I cannot give personalised legal advice. Please contact a qualified solicitor, Citizens Advice, or an official legal support service.";

export function detectPersonalAdviceRequest(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}
