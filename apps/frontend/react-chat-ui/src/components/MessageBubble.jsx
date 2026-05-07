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

  return (
    <article className={`bubble ${role === "user" ? "user" : "assistant"}`}>
      <div className="bubble-header">
        <strong>{role === "user" ? "You" : "Assistant"}</strong>
        {time ? <span className="bubble-time">{time}</span> : null}
      </div>

      {isAssistant ? (
        isIntroMessage ? (
          <p>{text}</p>
        ) : (
          <div className="assistant-structured">
            <p className="section-label">Answer</p>
            <p>{renderWithGlossary(text)}</p>

            <div className="meta-row">
              <span className={`confidence confidence-${String(confidence || "low").toLowerCase()}`}>
                Confidence: {confidence}
              </span>
              {safetyTriggered ? <span className="query-type">Safety: triggered</span> : null}
            </div>

            {citations.length ? (
              <>
                <p className="section-label">Sources</p>
                <ul className="source-list">
                  {citations.map((c, idx) => (
                    <li key={`${c.source || "source"}-${idx}`} className="source-card">
                      <strong>{c.title || c.source || "Source"}</strong>
                      {c.source ? <span>Source: {c.source}</span> : null}
                      {c.topic ? <span>Topic: {c.topic}</span> : null}
                      {typeof c.score === "number" ? <span>Relevance score: {c.score.toFixed(3)}</span> : null}
                      {c.whyUsed ? <span>Why used: {c.whyUsed}</span> : null}
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noreferrer">
                          View Source
                        </a>
                      ) : null}
                      {c.snippet ? <span>{c.snippet}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {Array.isArray(suggestedFollowUps) && suggestedFollowUps.length ? (
              <>
                <p className="section-label">You might also ask</p>
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
      ) : (
        <p>{text}</p>
      )}
    </article>
  );
}
