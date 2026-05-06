import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChatBox from "../components/ChatBox";

export default function Chat({
  user,
  usage,
  conversations,
  activeId,
  notice,
  setNotice,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onConversationChange,
  onUsageUpdate,
  onOpenSettings,
  onOpenSubscription,
  onUpgrade,
  onLogout,
  token
}) {
  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];

  return (
    <main className="page">
      <Navbar user={user} usage={usage} onOpenProfile={onOpenSettings} onUpgrade={onUpgrade} />
      <section className="app-shell">
        <Sidebar
          conversations={conversations}
          activeId={activeConversation?.id}
          onSelect={onSelectChat}
          onNewChat={onNewChat}
          onDelete={onDeleteChat}
          onOpenSubscription={onOpenSubscription}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
        <section className="main-panel">
          {activeConversation ? (
            <ChatBox
              token={token}
              conversation={activeConversation}
              onConversationChange={onConversationChange}
              onUsageUpdate={onUsageUpdate}
              notice={notice}
              setNotice={setNotice}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}
