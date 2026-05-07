const TERM_GLOSSARY = {
  "Article 8": "Right to respect for private and family life.",
  "Article 10": "Right to freedom of expression.",
  "Article 14": "Protection from discrimination in enjoyment of Convention rights.",
  "Human Rights Act": "UK law that gives effect to rights from the ECHR.",
  "Equality Act 2010": "UK law protecting people from discrimination.",
  ECHR: "European Convention on Human Rights.",
  UDHR: "Universal Declaration of Human Rights."
};

function renderWithGlossary(text) {
  if (!text) return null;
  const terms = Object.keys(TERM_GLOSSARY);
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    const key = terms.find((term) => term.toLowerCase() === part.toLowerCase());
    if (!key) return <span key={`${idx}-${part.slice(0, 12)}`}>{part}</span>;
    return (
      <abbr key={`${idx}-${key}`} title={TERM_GLOSSARY[key]} className="legal-term">
        {part}
      </abbr>
    );
  });
}

function renderStructuredText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const items = [];
  let bulletBuffer = [];

  const flushBullets = () => {
    if (!bulletBuffer.length) return;
    items.push(
      <ul key={`bullets-${items.length}`} className="assistant-bullets">
        {bulletBuffer.map((bullet, idx) => (
          <li key={`${bullet}-${idx}`}>{renderWithGlossary(bullet)}</li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const bulletMatch = line.match(/^(?:[-*•]\s+)(.+)$/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1].trim());
      continue;
    }
    flushBullets();
    items.push(<p key={`line-${items.length}`}>{renderWithGlossary(line)}</p>);
  }
  flushBullets();

  return items;
}

export default function MessageBubble({
  role,
  text,
  time,
  citations = [],
  confidence = "low",
  queryType,
  scope,
  safetyTriggered = false,
  suggestedFollowUps = [],
  onSuggestionClick
}) {
  const isAssistant = role !== "user";
  const hasEvidence = citations.length > 0 || Boolean(queryType);
  const isIntroMessage = isAssistant && !hasEvidence;
  const isCasual = String(queryType || "").toLowerCase() === "casual";
  const isOutOfScope = String(scope || "").toLowerCase() === "out_of_scope" || String(queryType || "").toLowerCase() === "out_of_scope";
  const confidenceValue = String(confidence || "low").toLowerCase();
  const showConfidence = isAssistant && !isOutOfScope && !safetyTriggered && ["medium", "high"].includes(confidenceValue);

  return (
    <article className={`bubble ${role === "user" ? "user" : "assistant"} ${safetyTriggered ? "safety-bubble" : ""}`}>
      <div className="bubble-header">
        <strong>{role === "user" ? "You" : "Assistant"}</strong>
        {time ? <span className="bubble-time">{time}</span> : null}
      </div>

      {isAssistant ? (
        isCasual ? (
          <p>{text}</p>
        ) : (
        isIntroMessage ? (
          <p>{text}</p>
        ) : (
          <div className="assistant-structured">
            <div className="assistant-text">{renderStructuredText(text)}</div>

            <div className="meta-row">
              {showConfidence ? (
                <span className={`confidence confidence-${confidenceValue}`}>
                  Confidence: {confidence}
                </span>
              ) : null}
              {isOutOfScope ? <span className="query-type">Out of scope</span> : null}
            </div>

            {safetyTriggered ? (
              <div className="safety-note">
                This response provides general legal information only and is not personalised legal advice.
              </div>
            ) : null}

            {citations.length ? (
              <>
                <p className="section-label">Sources</p>
                <ul className="source-list">
                  {citations.map((c, idx) => (
                    <li key={`${c.source || "source"}-${idx}`} className="source-card">
                      <strong>{c.title || "Source"}</strong>
                      {c.source ? <span className="source-domain">{c.source}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {Array.isArray(suggestedFollowUps) && suggestedFollowUps.length ? (
              <>
                <p className="section-label">You might also ask:</p>
                <div className="suggestions">
                  {suggestedFollowUps.slice(0, 3).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="suggestion"
                      onClick={() => onSuggestionClick?.(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )
        )
      ) : (
        <p>{text}</p>
      )}
    </article>
  );
}
