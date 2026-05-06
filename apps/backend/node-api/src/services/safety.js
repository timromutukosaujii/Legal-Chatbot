const ADVICE_PATTERNS = [
  /\bshould i sue\b/i,
  /\bwill i win\b/i,
  /\bcan i win\b/i,
  /\bwhat should i do\b/i,
  /\bcan i claim compensation\b/i,
  /\bwhat should i say in court\b/i,
  /\bwrite a legal letter\b/i,
  /\bfor my case\b/i,
  /\bcan you draft\b/i,
  /\bcan i sue\b/i
];

export const ADVICE_DISCLAIMER =
  "I can provide general legal information, but I cannot give personalised legal advice. Please contact a qualified solicitor, Citizens Advice, or an official legal support service.";

export function detectPersonalAdviceRequest(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

export function toGeneralInfoStyle(answer) {
  let text = String(answer || "").trim();
  if (!text) return text;

  // Reduce solicitor-like directive tone.
  text = text.replace(/\bYou should\b/g, "In general, people should");
  text = text.replace(/\bYou must\b/g, "In general, people may need to");
  text = text.replace(/\bI recommend\b/g, "In general, official guidance often recommends");
  return text;
}
