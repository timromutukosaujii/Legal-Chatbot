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
const GUEST_CONVERSATIONS_KEY = "legal_guest_conversations_v1";
const GUEST_ACTIVE_ID_KEY = "legal_guest_active_id_v1";
const GUEST_USER = { id: "guest", name: "Guest", email: "", plan: "free", authProvider: "guest" };

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

  const isAuthenticated = Boolean(token && user && user.authProvider !== "guest");
  const isGuest = !token;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(MODEL_KEY, model);
  }, [model]);

  useEffect(() => {
    if (!token) {
      setUser(GUEST_USER);
      setUsage({ today: 0, limit: null, remaining: null });

      try {
        const stored = localStorage.getItem(GUEST_CONVERSATIONS_KEY);
        const storedActive = localStorage.getItem(GUEST_ACTIVE_ID_KEY) || "";
        const list = stored ? JSON.parse(stored) : [];
        const nextList = Array.isArray(list) && list.length ? list : [createConversation()];
        setConversations(nextList);
        setActiveId(storedActive && nextList.some((c) => c.id === storedActive) ? storedActive : nextList[0].id);
      } catch {
        const fresh = createConversation();
        setConversations([fresh]);
        setActiveId(fresh.id);
      }
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
      navigate("/chat", { replace: true });
    });
  }, [token, navigate]);

  useEffect(() => {
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
    setUser(GUEST_USER);
    setNotice("");
    navigate("/chat", { replace: true });
  };

  const onConversationChange = (conversation) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversation.id);
      const next = [...prev];
      if (index >= 0) next[index] = conversation;
      else next.unshift(conversation);
      const sorted = next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      if (!token) {
        try {
          localStorage.setItem(GUEST_CONVERSATIONS_KEY, JSON.stringify(sorted));
          localStorage.setItem(GUEST_ACTIVE_ID_KEY, conversation.id);
        } catch {
          // ignore
        }
      }
      return sorted;
    });
    if (token) {
      saveConversation(token, conversation).catch(() => {});
    }
  };

  const onNewChat = () => {
    const fresh = createConversation();
    setConversations((prev) => {
      const next = [fresh, ...prev];
      if (!token) {
        try {
          localStorage.setItem(GUEST_CONVERSATIONS_KEY, JSON.stringify(next));
          localStorage.setItem(GUEST_ACTIVE_ID_KEY, fresh.id);
        } catch {
          // ignore
        }
      }
      return next;
    });
    setActiveId(fresh.id);
    if (token) {
      saveConversation(token, fresh).catch(() => {});
    }
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
      if (!token) {
        try {
          localStorage.setItem(GUEST_CONVERSATIONS_KEY, JSON.stringify(next));
          localStorage.setItem(GUEST_ACTIVE_ID_KEY, next[0]?.id || "");
        } catch {
          // ignore
        }
      }
      return next;
    });
    if (token) {
      try {
        await deleteConversation(token, id);
      } catch {
        // ignore
      }
    }
  };

  const onSetPlan = async (plan) => {
    if (!token) {
      setNotice("Guest mode: sign in to manage plans.");
      return;
    }
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
    if (token) {
      for (const conv of conversations) {
        await deleteConversation(token, conv.id).catch(() => {});
      }
      onNewChat();
      return;
    }

    try {
      localStorage.removeItem(GUEST_CONVERSATIONS_KEY);
      localStorage.removeItem(GUEST_ACTIVE_ID_KEY);
    } catch {
      // ignore
    }
    const fresh = createConversation();
    setConversations([fresh]);
    setActiveId(fresh.id);
  };

  const chatElement = (
    <ChatPage
      token={token}
      user={user || GUEST_USER}
      usage={usage}
      conversations={conversations}
      activeId={activeId}
      notice={notice}
      setNotice={setNotice}
      onUsageUpdate={setUsage}
      onNewChat={onNewChat}
      onSelectChat={(id) => {
        setActiveId(id);
        if (!token) {
          try {
            localStorage.setItem(GUEST_ACTIVE_ID_KEY, id);
          } catch {
            // ignore
          }
        }
      }}
      onDeleteChat={onDeleteChat}
      onConversationChange={onConversationChange}
      onOpenSettings={() => (token ? navigate("/settings") : navigate("/login"))}
      onOpenSubscription={() => (token ? navigate("/subscription") : navigate("/login"))}
      onUpgrade={() => onSetPlan("pro")}
      onLogout={onLogout}
      isGuest={isGuest}
      onLogin={() => navigate("/login")}
    />
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
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
            <Navigate to="/chat" replace />
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
            <Navigate to="/chat" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
