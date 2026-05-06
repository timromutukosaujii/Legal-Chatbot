import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import ChatPage from "./pages/Chat";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import { deleteConversation, fetchConversations, saveConversation } from "./services/api";
import { getMe, getStoredToken, setStoredToken, updatePlan } from "./services/auth";

const THEME_KEY = "legal_platform_theme_v1";
const MODEL_KEY = "legal_platform_model_v1";

function createConversation() {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [
      {
        role: "assistant",
        text: "Hello! I can help explain UK human rights, visas, and legal protections in simple terms.",
        citations: [],
        confidence: "Low",
        retrievedChunks: []
      }
    ]
  };
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState({ today: 0, limit: null, remaining: null });
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || "light");
  const [model, setModel] = useState(localStorage.getItem(MODEL_KEY) || "basic");

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(MODEL_KEY, model);
  }, [model]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setConversations([]);
      setActiveId("");
      return;
    }

    const loadAccount = async () => {
      const me = await getMe(token);
      setUser(me.user);
      setUsage(me.usage || { today: 0, limit: null, remaining: null });

      const remote = await fetchConversations(token);
      const list = Array.isArray(remote.conversations) && remote.conversations.length
        ? remote.conversations
        : [createConversation()];
      setConversations(list);
      setActiveId(list[0].id);
    };

    loadAccount().catch(() => {
      setStoredToken("");
      setToken("");
      setUser(null);
      navigate("/login", { replace: true });
    });
  }, [token, navigate]);

  useEffect(() => {
    if (!isAuthenticated && !["/login", "/register"].includes(location.pathname)) {
      navigate("/login", { replace: true });
    }
    if (isAuthenticated && ["/login", "/register", "/"].includes(location.pathname)) {
      navigate("/chat", { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  const onAuthed = (nextToken, authUser) => {
    setStoredToken(nextToken);
    setToken(nextToken);
    setUser(authUser || null);
    navigate("/chat", { replace: true });
  };

  const onLogout = () => {
    setStoredToken("");
    setToken("");
    setUser(null);
    setNotice("");
    navigate("/login", { replace: true });
  };

  const onConversationChange = (conversation) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversation.id);
      const next = [...prev];
      if (index >= 0) next[index] = conversation;
      else next.unshift(conversation);
      return next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    });
    saveConversation(token, conversation).catch(() => {});
  };

  const onNewChat = () => {
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    saveConversation(token, fresh).catch(() => {});
  };

  const onDeleteChat = async (id) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.length) {
        const fresh = createConversation();
        setActiveId(fresh.id);
        saveConversation(token, fresh).catch(() => {});
        return [fresh];
      }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
    try {
      await deleteConversation(token, id);
    } catch {
      // ignore
    }
  };

  const onSetPlan = async (plan) => {
    try {
      const data = await updatePlan(token, plan);
      if (data.token) {
        setStoredToken(data.token);
        setToken(data.token);
      }
      setUser(data.user);
      setNotice(`Plan updated to ${plan.toUpperCase()}.`);
    } catch (err) {
      setNotice(err.message || "Could not update plan.");
    }
  };

  const clearHistory = async () => {
    for (const conv of conversations) {
      await deleteConversation(token, conv.id).catch(() => {});
    }
    onNewChat();
  };

  const chatElement = isAuthenticated ? (
    <ChatPage
      token={token}
      user={user}
      usage={usage}
      conversations={conversations}
      activeId={activeId}
      notice={notice}
      setNotice={setNotice}
      onUsageUpdate={setUsage}
      onNewChat={onNewChat}
      onSelectChat={setActiveId}
      onDeleteChat={onDeleteChat}
      onConversationChange={onConversationChange}
      onOpenSettings={() => navigate("/settings")}
      onOpenSubscription={() => navigate("/subscription")}
      onUpgrade={() => onSetPlan("pro")}
      onLogout={onLogout}
    />
  ) : (
    <Navigate to="/login" replace />
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />} />
      <Route path="/login" element={<Login onAuthed={onAuthed} onNavigateRegister={() => navigate("/register")} />} />
      <Route path="/register" element={<Register onAuthed={onAuthed} onNavigateLogin={() => navigate("/login")} />} />
      <Route path="/chat" element={chatElement} />
      <Route
        path="/settings"
        element={
          isAuthenticated ? (
            <Settings
              user={user}
              usage={usage}
              theme={theme}
              model={model}
              onThemeChange={setTheme}
              onModelChange={setModel}
              onSetPlan={onSetPlan}
              onClearHistory={clearHistory}
              onNavigateSubscription={() => navigate("/subscription")}
              onNavigateChat={() => navigate("/chat")}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/subscription"
        element={
          isAuthenticated ? (
            <Subscription
              user={user}
              usage={usage}
              onSetPlan={onSetPlan}
              onNavigateChat={() => navigate("/chat")}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />} />
    </Routes>
  );
}
