export default function SourceCitations({ citations }) {
  if (!citations.length) {
    return <p className="citations-empty">No references available for this response.</p>;
  }

  return (
    <aside className="citations">
      <h2>References</h2>
      <ul>
        {citations.map((c, idx) => (
          <li key={`${c.source}-${idx}`}>
            <span>{c.source}</span>
            {c.snippet ? <p>{c.snippet}</p> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
