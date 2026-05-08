export default function Sidebar({
  open,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onFeatures,
  onDelete,
  onLogout,
  onClose
}) {
  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/adhikar-logo.svg" alt="Adhikar logo" className="brand-logo sidebar-logo" />
          <h1>Adhikar</h1>
          <small className="brand-meaning">right / entitlement</small>
          <p>UK Legal and Human Rights Assistant</p>
        </div>

        <button className="new-chat" type="button" onClick={onNewChat}>+ New Chat</button>

        <div className="chat-history">
          <h3>Chat History</h3>
          <ul>
            {conversations.map((item) => (
              <li key={item.id} className={item.id === activeId ? "active" : ""}>
                <button type="button" className="history-link" onClick={() => { onSelect(item.id); onClose?.(); }}>
                  <span>{item.title}</span>
                  <small>{new Date(item.updatedAt || Date.now()).toLocaleString()}</small>
                </button>
                <button type="button" className="delete-chat" onClick={() => onDelete(item.id)}>x</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-actions">
          <button type="button" className="ghost sidebar-btn" onClick={onFeatures}>About Assistant</button>
          <button type="button" className="ghost sidebar-btn" onClick={onLogout}>Logout</button>
        </div>
      </aside>
      {open ? <button type="button" className="sidebar-backdrop" onClick={onClose} aria-label="Close sidebar" /> : null}
    </>
  );
}
