import { useState } from "react";

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
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"));
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

function compactSourceTitle(title) {
  const raw = String(title || "Source").trim();
  return raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s*-\s*.*$/, "").replace(/\s{2,}/g, " ").trim();
}

function sourceLabel(citation) {
  const url = String(citation?.url || "").trim();
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, "");
    } catch {
      // fall through
    }
  }
  return String(citation?.source || "").trim() || "Legal source";
}

export default function MessageBubble({
  role,
  text,
  time,
  citations = [],
  queryType,
  scope,
  safetyTriggered = false,
  suggestedFollowUps = [],
  onSuggestionClick
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");

  const isAssistant = role !== "user";
  const hasEvidence = citations.length > 0 || Boolean(queryType);
  const isIntroMessage = isAssistant && !hasEvidence;
  const isCasual = String(queryType || "").toLowerCase() === "casual";
  const isOutOfScope = String(scope || "").toLowerCase() === "out_of_scope" || String(queryType || "").toLowerCase() === "out_of_scope";
  const isSafety = safetyTriggered || String(queryType || "").toLowerCase() === "safety_refusal";
  const isAssistance = String(queryType || "").toLowerCase() === "assistance_request";

  const defaultAssistanceChips = [
    "Human Rights Act",
    "Article 8 privacy",
    "Equality Act",
    "Constitutional law",
    "Public authority duties"
  ];
  const suggestionChips = Array.isArray(suggestedFollowUps) && suggestedFollowUps.length
    ? suggestedFollowUps
    : isAssistance
      ? defaultAssistanceChips
      : [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const handleFeedback = (value) => {
    setFeedback(value);
    try {
      const key = "adhikar_feedback";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push({
        value,
        queryType: String(queryType || "unknown"),
        textPreview: String(text || "").slice(0, 160),
        ts: new Date().toISOString()
      });
      localStorage.setItem(key, JSON.stringify(existing.slice(-200)));
    } catch {
      // non-blocking
    }
  };

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

            {isOutOfScope ? <div className="meta-row"><span className="query-type">Out of scope</span></div> : null}

            {isSafety ? (
              <div className="safety-note" role="status" aria-live="polite">
                General legal information only - not personalised legal advice.
              </div>
            ) : null}

            {citations.length ? (
              <>
                <p className="section-label">Sources</p>
                <ul className="source-list">
                  {citations.map((c, idx) => (
                    <li key={`${c.source || "source"}-${idx}`} className="source-card">
                      <strong>{compactSourceTitle(c.title)}</strong>
                      <span className="source-domain">{sourceLabel(c)}</span>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noreferrer" className="source-link">
                          View Source
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {suggestionChips.length ? (
              <>
                <p className="section-label">You might also ask:</p>
                <div className="suggestions">
                  {suggestionChips.slice(0, 5).map((item) => (
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

            <div className="answer-tools">
              <button type="button" className="ghost" onClick={handleCopy}>Copy answer</button>
              {copied ? <span className="copied-note">Copied</span> : null}
              <button type="button" className={`ghost feedback-btn ${feedback === "helpful" ? "active" : ""}`} onClick={() => handleFeedback("helpful")}>Helpful</button>
              <button type="button" className={`ghost feedback-btn ${feedback === "not_helpful" ? "active" : ""}`} onClick={() => handleFeedback("not_helpful")}>Not helpful</button>
            </div>

            {citations.length ? (
              <details className="evidence-details">
                <summary>Evidence details</summary>
                <p className="evidence-note">Technical retrieval fields are hidden in normal view.</p>
              </details>
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
