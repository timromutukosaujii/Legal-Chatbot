import { useEffect, useMemo, useState } from "react";
import ChatWindow from "../components/ChatWindow";

const officialLinks = [
  { label: "GOV.UK Visas and Immigration", url: "https://www.gov.uk/browse/visas-immigration" },
  { label: "GOV.UK Private Renting", url: "https://www.gov.uk/private-renting" },
  { label: "GOV.UK Employment Status", url: "https://www.gov.uk/employment-status" },
  { label: "Human Rights Act 1998", url: "https://www.legislation.gov.uk/ukpga/1998/42/contents" }
];

const PROFILE_KEY = "legal_chat_profile_v1";
const SESSIONS_KEY = "legal_chat_sessions_v1";
const THEME_KEY = "legal_chat_theme_v1";
const WELCOME_TEXT =
  "Hello! I can help explain UK human rights, visas, and legal protections in simple terms.\n\nTry asking:\n- What does Article 8 mean?\n- What are my rights at work?\n\nThis chatbot provides general legal information, not personalised legal advice.";

function classifyTitle(text = "") {
  const q = text.toLowerCase();
  if (q.includes("tenant") || q.includes("rent")) return "Tenant rights question";
  if (q.includes("visa") || q.includes("immigration") || q.includes("citizenship")) return "Visa question";
  if (q.includes("work") || q.includes("employee") || q.includes("employer")) return "Work rights question";
  if (q.includes("human rights") || q.includes("article")) return "Human rights question";
  return "General legal question";
}

function createSession() {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [{ role: "assistant", text: WELCOME_TEXT, citations: [], confidence: "Low", retrievedChunks: [] }]
  };
}

export default function Home() {
  const [profile, setProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      return stored ? JSON.parse(stored) : { name: "", email: "" };
    } catch {
      return { name: "", email: "" };
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "light";
    } catch {
      return "light";
    }
  });
  const [sessions, setSessions] = useState(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    const first = createSession();
    return { activeId: first.id, items: [first] };
  });
  const [loginForm, setLoginForm] = useState({ name: profile.name || "", email: profile.email || "" });
  const [password, setPassword] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions]);

  const activeSession = useMemo(
    () => sessions.items.find((s) => s.id === sessions.activeId),
    [sessions]
  );

  const updateSession = (updated) => {
    setSessions((prev) => {
      const items = prev.items.map((s) => (s.id === updated.id ? { ...s, ...updated, updatedAt: Date.now() } : s));
      return { ...prev, items };
    });
  };

  const newChat = () => {
    const fresh = createSession();
    setSessions((prev) => ({ activeId: fresh.id, items: [fresh, ...prev.items] }));
  };

  const selectChat = (id) => {
    setSessions((prev) => ({ ...prev, activeId: id }));
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setProfile({ name: loginForm.name.trim() || "User", email: loginForm.email.trim() });
    setPassword("");
  };

  const handleLogout = () => {
    setProfile({ name: "", email: "" });
    setLoginForm({ name: "", email: "" });
  };

  const handleCommand = (cmd) => {
    const parts = cmd.slice(1).trim().split(/\s+/);
    const action = parts[0]?.toLowerCase();
    if (!action) return;

    if (action === "new") {
      newChat();
      return;
    }
    if (action === "clear") {
      if (!activeSession) return;
      updateSession({
        ...activeSession,
        messages: [
          {
            role: "assistant",
            text: "Chat cleared. Ask me anything about UK legal information.",
            citations: []
          }
        ]
      });
      return;
    }
    if (action === "theme") {
      const mode = parts[1]?.toLowerCase();
      if (mode && ["light", "sand", "slate"].includes(mode)) {
        setTheme(mode);
      }
      return;
    }
    if (action === "help") {
      const help = createSession();
      help.title = "Commands";
      help.messages = [
        {
          role: "assistant",
          text:
            "Commands: /new (new chat), /clear (clear current), /theme light|sand|slate, /help.",
          citations: []
        }
      ];
      setSessions((prev) => ({ activeId: help.id, items: [help, ...prev.items] }));
      return;
    }
  };

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Lawyer GPT</p>
        <h1>Lawyer GPT</h1>
        <p>
          Fast, clear explanations with sources. Built for general knowledge,
          not personalised legal advice.
        </p>
        <div className="hero-note">
          This tool provides general legal information only. It does not replace
          a qualified professional or official advice service.
        </div>
      </header>

      <section className="app-shell">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" role="img" aria-label="Law scales">
                <path
                  d="M32 8c-1.1 0-2 .9-2 2v8h-9.5c-.8 0-1.5.5-1.8 1.2L12 32.5c-.2.5-.2 1.1.1 1.6l6 9.5c.4.6 1 .9 1.7.9h9.2c.7 0 1.3-.4 1.7-.9l6-9.5c.3-.5.4-1.1.1-1.6l-6.7-13.3c-.3-.7-1-1.1-1.8-1.1H32V10c0-1.1-.9-2-2-2zm-15 26 4.2-8.3 4.2 8.3H17zm30 0-4.2-8.3-4.2 8.3H47zM30 46h4v8h12c1.1 0 2 .9 2 2s-.9 2-2 2H18c-1.1 0-2-.9-2-2s.9-2 2-2h12v-8z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <strong>Lawyer GPT</strong>
              <span>Trusted legal summaries</span>
            </div>
          </div>

          <button className="new-chat" type="button" onClick={newChat}>
            + New chat
          </button>

          <div className="chat-history">
            <h3>Chat history</h3>
            <ul>
              {sessions.items.map((item) => (
                <li
                  key={item.id}
                  className={item.id === sessions.activeId ? "active" : ""}
                  onClick={() => selectChat(item.id)}
                >
                  <span>{item.title}</span>
                  <small>{new Date(item.updatedAt || Date.now()).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          </div>

          <div className="theme-toggle">
            <span>Colour theme</span>
            <div className="theme-buttons">
              {["light", "sand", "slate"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`theme-chip ${theme === mode ? "active" : ""}`}
                  onClick={() => setTheme(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="login-panel">
            <h3>{profile?.name ? "Signed in" : "Sign in"}</h3>
            {profile?.name ? (
              <div className="signed-in">
                <p className="login-note">Welcome back, {profile.name}.</p>
                <button type="button" className="primary" onClick={handleLogout}>
                  Sign out
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin}>
                <label>
                  Name
                  <input
                    type="text"
                    placeholder="Your name"
                    value={loginForm.name}
                    onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button type="submit" className="primary">Log in</button>
              </form>
            )}
            <p className="login-note">
              Local demo login only. Your info stays in this browser.
            </p>
          </div>
        </aside>

        <section className="main-panel">
          <ChatWindow
            session={activeSession}
            onUpdateSession={(updated) => {
              if (!updated) return;
              const hasTitle = updated.title && updated.title !== "New chat";
              const firstUser = updated.messages?.find((m) => m.role === "user");
              const title = hasTitle
                ? updated.title
                : firstUser
                ? classifyTitle(firstUser.text)
                : "New chat";
              updateSession({ ...updated, title });
            }}
            profile={profile}
            onCommand={handleCommand}
          />
          <section className="official-links">
            <h2>Official Sources</h2>
            <p>If you need full details, visit the official GOV.UK pages below.</p>
            <ul>
              {officialLinks.map((item) => (
                <li key={item.url}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </section>
      </section>
    </main>
  );
}
