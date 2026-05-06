export default function Subscription({ user, usage, onSetPlan, onNavigateChat }) {
  return (
    <main className="auth-page">
      <section className="auth-card settings-card">
        <h1>Choose Your Plan</h1>
        <p>Upgrade for unlimited legal assistant access.</p>

        <div className="plan-grid">
          <div className="plan-card">
            <strong>Free</strong>
            <span>10 questions/day</span>
            <span>General responses</span>
            <span>Current: {(user?.plan || "free") === "free" ? "Active" : "Available"}</span>
            <button type="button" className="ghost" onClick={() => onSetPlan("free")}>Use Free</button>
          </div>

          <div className="plan-card pro">
            <strong>Pro (£5/month)</strong>
            <span>Unlimited access</span>
            <span>Priority AI and richer explanations</span>
            <span>{usage?.limit ? `You used ${usage.today}/${usage.limit} today` : "Unlimited usage enabled"}</span>
            <button type="button" className="primary" onClick={() => onSetPlan("pro")}>Upgrade</button>
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" className="primary" onClick={onNavigateChat}>Back to chat</button>
        </div>
      </section>
    </main>
  );
}
