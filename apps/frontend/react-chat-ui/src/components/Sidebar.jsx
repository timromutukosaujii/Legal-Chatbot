const KB_ITEMS = [
  "Human Rights Act 1998",
  "ECHR",
  "Equality Act 2010",
  "Data Protection Act 2018",
  "UDHR",
  "EHRC Guidance"
];

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onOpenSettings,
  onLogout
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>UK Rights Assistant</h1>
        <p>Constitutional + Human Rights RAG</p>
      </div>

      <button className="new-chat" type="button" onClick={onNewChat}>+ New Chat</button>

      <div className="kb-panel">
        <h3>Knowledge Base</h3>
        <ul>
          {KB_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="chat-history">
        <h3>Chat History</h3>
        <ul>
          {conversations.map((item) => (
            <li key={item.id} className={item.id === activeId ? "active" : ""}>
              <button type="button" className="history-link" onClick={() => onSelect(item.id)}>
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
        <button type="button" className="ghost sidebar-btn" onClick={onOpenSettings}>Settings</button>
        <button type="button" className="ghost sidebar-btn" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}
