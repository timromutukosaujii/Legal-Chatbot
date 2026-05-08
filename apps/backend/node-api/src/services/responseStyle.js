export function detectResponseStyle(message) {
  const text = String(message || "").toLowerCase().trim();
  if (!text) return "concise";

  if (/^(human rights|human right|rights|uk rights|constitutional rights)$/i.test(text)) {
    return "overview";
  }

  if (/\b(bullet|bullet points|points|list format|in points)\b/.test(text)) {
    return "bullet";
  }

  if (/^(explain|clarify|elaborate)$/i.test(text) || /\b(explain it|explain more|simplify|simple explanation|easier version|tell me more)\b/.test(text)) {
    return "simple_explain";
  }

  if (/\b(detailed|in detail|full explanation|deep dive|elaborate)\b/.test(text)) {
    return "detailed";
  }

  if (/\b(summary in points|summarise in points|summarize in points|short bullet|bullet summary)\b/.test(text)) {
    return "bullet";
  }

  if (/\b(summarise|summarize|summary|short answer|brief|make it short|in short|concise)\b/.test(text)) {
    return "concise";
  }

  return "concise";
}
