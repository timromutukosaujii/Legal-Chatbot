function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\bemploye\b/g, "employee")
    .replace(/\bemployr\b/g, "employer")
    .replace(/\bprivcy\b/g, "privacy")
    .replace(/\bhumn rights\b/g, "human rights")
    .replace(/\s+/g, " ")
    .trim();
}

const TOPIC_PATTERNS = [
  { topic: "employment", pattern: /\b(employ|employee|employer|work|job|dismiss|redund|salary|wage|contract|workplace|acas)\b/ },
  { topic: "discrimination", pattern: /\b(discriminat|equality act|protected characteristic|harassment|victimisation)\b/ },
  { topic: "privacy", pattern: /\b(privacy|private life|data protection|uk gdpr|ico|surveillance)\b/ },
  { topic: "housing", pattern: /\b(rent|landlord|tenant|evict|housing|deposit|tenancy|shelter)\b/ },
  { topic: "constitutional_rights", pattern: /\b(constitution|constitutional|judicial review|rule of law|parliament|public authority)\b/ },
  { topic: "human_rights", pattern: /\b(human rights|echr|hra|article\s*\d+)\b/ },
  { topic: "public_authority", pattern: /\b(council|police|nhs|public body|public authority)\b/ }
];

export function classifyLegalTopic(message) {
  const text = normalize(message);
  for (const item of TOPIC_PATTERNS) {
    if (item.pattern.test(text)) return { topic: item.topic };
  }
  return { topic: "general" };
}

