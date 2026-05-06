export default function Navbar({ user, usage, onOpenProfile, onUpgrade }) {
  return (
    <header className="topbar">
      <div>
        <h2>Lawyer GPT Pro</h2>
        <p>AI-powered legal assistant</p>
      </div>
      <div className="topbar-actions">
        <span className="plan-chip">{(user?.plan || "free").toUpperCase()}</span>
        {usage?.limit ? <span className="usage-chip">{usage.today}/{usage.limit} today</span> : <span className="usage-chip">Unlimited</span>}
        <button type="button" className="ghost" onClick={onUpgrade}>Upgrade Plan</button>
        <button type="button" className="ghost" onClick={onOpenProfile}>Profile</button>
      </div>
    </header>
  );
}
