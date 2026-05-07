export default function Navbar({ onOpenProfile }) {
  return (
    <header className="topbar">
      <div>
        <h2>UK Constitutional + Human Rights Assistant</h2>
        <p>Citation-grounded legal information prototype</p>
      </div>
      <div className="topbar-actions">
        <span className="plan-chip">Prototype</span>
        <span className="usage-chip">RAG Enabled</span>
        <span className="usage-chip">Source-Grounded</span>
        <span className="usage-chip">Legal Info Only</span>
        <button type="button" className="ghost" onClick={onOpenProfile}>Profile</button>
      </div>
    </header>
  );
}
