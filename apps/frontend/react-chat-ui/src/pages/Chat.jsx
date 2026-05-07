import { useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ChatBox from "../components/ChatBox";

export default function Chat({
  theme,
  conversations,
  activeId,
  notice,
  setNotice,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onConversationChange,
  onUsageUpdate,
  onToggleTheme,
  onLogout,
  token
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [featurePromptToken, setFeaturePromptToken] = useState(0);
  const activeConversation = conversations.find((c) => c.id === activeId) || conversations[0];

  return (
    <main className="page">
      <Navbar
        theme={theme}
        onToggleTheme={onToggleTheme}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <section className="app-shell">
        <Sidebar
          open={sidebarOpen}
          conversations={conversations}
          activeId={activeConversation?.id}
          onSelect={onSelectChat}
          onNewChat={onNewChat}
          onFeatures={() => {
            setFeaturePromptToken(Date.now());
            setSidebarOpen(false);
          }}
          onDelete={onDeleteChat}
          onLogout={onLogout}
          onClose={() => setSidebarOpen(false)}
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
              featurePromptToken={featurePromptToken}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}


