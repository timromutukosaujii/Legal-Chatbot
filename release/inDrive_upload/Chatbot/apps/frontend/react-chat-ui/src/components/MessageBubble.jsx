import { useMemo, useState } from "react";

const TERM_GLOSSARY = {
  "Article 8": "Right to respect for private and family life.",
  "Article 10": "Right to freedom of expression.",
  "Human Rights Act": "UK law that gives effect to rights from the ECHR.",
  "Equality Act 2010": "UK law protecting people from discrimination.",
  ILR: "Indefinite Leave to Remain, permanent settlement status."
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

function simplifyText(text) {
  return text
    .replace(/therefore/gi, "so")
    .replace(/however/gi, "but")
    .replace(/notwithstanding/gi, "even if")
    .replace(/pursuant to/gi, "under")
    .replace(/general legal information/gi, "basic legal info");
}

function getSmartSuggestions(answer) {
  const lower = (answer || "").toLowerCase();
  if (lower.includes("article") || lower.includes("human rights")) {
    return ["What is Article 8?", "What does Article 14 cover?"];
  }
  if (lower.includes("tenant") || lower.includes("rent")) {
    return ["What repairs must landlords provide?", "How much notice must a landlord give?"];
  }
  if (lower.includes("visa") || lower.includes("immigration")) {
    return ["What is ILR?", "Can I switch visa type in the UK?"];
  }
  return ["What are my privacy rights?", "Where can I get official legal help?"];
}

export default function MessageBubble({
  role,
  text,
  time,
  citations = [],
  confidence = "Low",
  retrievedChunks = [],
  queryType,
  onSuggestionClick
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [eli5, setEli5] = useState(false);
  const isAssistant = role !== "user";
  const hasEvidence = citations.length > 0 || retrievedChunks.length > 0 || Boolean(queryType);
  const isIntroMessage = isAssistant && !hasEvidence;
  const viewText = eli5 ? simplifyText(text || "") : text;
  const suggestions = useMemo(() => getSmartSuggestions(text), [text]);

  const keyPoints = (viewText || "")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const showKeyPoints = keyPoints.length > 1 && (viewText || "").length > 140;
  const showEli5 = (text || "").length > 140;

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
          <p>{renderWithGlossary(viewText)}</p>

          {showEli5 ? (
            <button type="button" className="why-toggle" onClick={() => setEli5((prev) => !prev)}>
              {eli5 ? "Show standard explanation" : "Explain like I'm 5"}
            </button>
          ) : null}

          {showKeyPoints ? (
            <>
              <p className="section-label">Key points</p>
              <ul className="source-list">
                {keyPoints.map((point, idx) => (
                  <li key={`${idx}-${point.slice(0, 24)}`}>{renderWithGlossary(point)}</li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="meta-row">
            <span className={`confidence confidence-${(confidence || "Low").toLowerCase()}`}>Confidence: {confidence || "Low"}</span>
            {queryType ? <span className="query-type">Type: {queryType.replace("_", " ")}</span> : null}
          </div>

          {citations.length ? (
            <>
              <p className="section-label">Sources</p>
              <ul className="source-list">
                {citations.map((c, idx) => (
                  <li key={`${c.source || "source"}-${idx}`}>
                    <strong>{c.source || "Source"}</strong>
                    {c.snippet ? <span>{c.snippet}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {retrievedChunks.length ? (
            <>
              <button type="button" className="why-toggle" onClick={() => setShowWhy((prev) => !prev)}>
                {showWhy ? "Hide reasoning" : "Show reasoning"}
              </button>

              {showWhy ? (
                <div className="why-panel">
                  <p className="section-label">Retrieved chunks</p>
                  <ul className="chunk-list">
                    {retrievedChunks.map((chunk, idx) => (
                      <li key={`${chunk.source || "chunk"}-${idx}`}>
                        <div>
                          <strong>{chunk.source || "Chunk"}</strong>
                          <span className="chunk-score">score {(Number(chunk.score) || 0).toFixed(3)}</span>
                        </div>
                        <p>{chunk.snippet}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {onSuggestionClick ? (
            <>
              <p className="section-label">You might also ask</p>
              <div className="suggestions">
                {suggestions.map((item) => (
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
