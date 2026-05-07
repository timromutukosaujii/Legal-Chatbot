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
          <h1>UK Rights Assistant</h1>
          <p>Constitutional + Human Rights RAG</p>
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
          <button type="button" className="ghost sidebar-btn" onClick={onFeatures}>Features</button>
          <button type="button" className="ghost sidebar-btn" onClick={onLogout}>Logout</button>
        </div>
      </aside>
      {open ? <button type="button" className="sidebar-backdrop" onClick={onClose} aria-label="Close sidebar" /> : null}
    </>
  );
}
