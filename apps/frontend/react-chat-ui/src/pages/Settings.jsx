export default function Settings({
  user,
  usage,
  theme,
  model,
  onThemeChange,
  onModelChange,
  onSetPlan,
  onClearHistory,
  onNavigateChat,
  onNavigateSubscription
}) {
  return (
    <main className="auth-page">
      <section className="auth-card settings-card">
        <h1>Settings</h1>
        <p>Manage your preferences and account controls.</p>

        <div className="settings-row">
          <strong>Account</strong>
          <span>{user?.name} ({user?.email})</span>
        </div>
        <div className="settings-row">
          <strong>Current Plan</strong>
          <span>{(user?.plan || "free").toUpperCase()}</span>
        </div>
        <div className="settings-row">
          <strong>Usage Today</strong>
          <span>{usage?.limit ? `${usage.today}/${usage.limit}` : "Unlimited"}</span>
        </div>
        <div className="settings-row">
          <strong>Theme</strong>
          <select value={theme} onChange={(e) => onThemeChange(e.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="settings-row">
          <strong>Model</strong>
          <select value={model} onChange={(e) => onModelChange(e.target.value)}>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div className="settings-actions">
          <button type="button" className="ghost" onClick={onClearHistory}>Clear history</button>
          <button type="button" className="ghost" onClick={onNavigateSubscription}>Subscription</button>
          <button type="button" className="primary" onClick={onNavigateChat}>Back to chat</button>
        </div>
      </section>
    </main>
  );
}
