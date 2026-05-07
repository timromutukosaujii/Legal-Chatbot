const IN_SCOPE_PATTERNS = [
  /\buk human rights\b/i,
  /\bhuman rights act\b/i,
  /\b(?:hra\s*1998|hra)\b/i,
  /\bechr\b/i,
  /\budhr\b/i,
  /\bequality act\b/i,
  /\bconstitutional\b/i,
  /\bmagna carta\b/i,
  /\bconstitutional reform act\b/i,
  /\bdata protection\b/i,
  /\bprivacy\b/i,
  /\bfreedom of expression\b/i,
  /\bfair trial\b/i,
  /\bdiscrimination\b/i,
  /\bpublic authorit(y|ies)\b/i,
  /\barticle\s*\d+\b/i,
  /\bartic(?:le|al)\s*\d+\b/i,
  /\bdeclaration of incompatibilit(y|ies)\b/i,
  /\bjudicial review\b/i,
  /\brule of law\b/i,
  /\bparliament\b/i,
  /\bpublic law\b/i
];

const LEGAL_CONTEXT_PATTERNS = [
  /\buk law\b/i,
  /\blegal\b/i,
  /\bcourt(s)?\b/i,
  /\brights?\b/i,
  /\bconstitution(al)?\b/i
];

const OUT_SCOPE_PATTERNS = [
  /\bcrypto\b/i,
  /\bfootball\b/i,
  /\brecipe\b/i,
  /\bweather\b/i,
  /\bstock market\b/i
];

export function checkScope(message) {
  const text = String(message || "").trim();
  if (!text) {
    return {
      scope: "out_of_scope",
      inScope: false,
      reason: "empty"
    };
  }

  if (OUT_SCOPE_PATTERNS.some((p) => p.test(text))) {
    return {
      scope: "out_of_scope",
      inScope: false,
      reason: "known_out_scope_pattern"
    };
  }

  const inScope =
    IN_SCOPE_PATTERNS.some((p) => p.test(text)) ||
    LEGAL_CONTEXT_PATTERNS.some((p) => p.test(text));

  return {
    scope: inScope ? "in_scope" : "out_of_scope",
    inScope,
    reason: inScope ? "matched_domain_pattern" : "no_domain_match"
  };
}

export const OUT_OF_SCOPE_MESSAGE =
  "This chatbot is designed for general UK legal and human-rights information only. I cannot answer questions outside that scope.";
