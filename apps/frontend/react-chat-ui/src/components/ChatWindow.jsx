import { useEffect, useMemo, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import { sendChatMessage } from "../services/api";

const disclaimer =
  "This chatbot provides general legal information, not personalised legal advice.";
const welcomeMessage =
  "Hello! I can help explain UK human rights, visas, and legal protections in simple terms.\n\nTry asking:\n- What does Article 8 mean?\n- What are my rights at work?";
const suggestions = [
  "What is Article 10 of the Human Rights Act?",
  "What are tenant rights in the UK?",
  "What rights do workers have in the UK?",
  "Where can I get official legal advice services?"
];

export default function ChatWindow({ session, onUpdateSession, profile, onCommand }) {
  const [messages, setMessages] = useState(
    session?.messages || [{ role: "assistant", text: `${welcomeMessage}\n\n${disclaimer}`, citations: [], confidence: "Low", retrievedChunks: [] }]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    if (session?.messages) {
      setMessages(session.messages);
    }
  }, [session?.messages]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    if (question.startsWith("/")) {
      onCommand?.(question);
      setInput("");
      return;
    }

    const nextMessages = [
      ...messages,
      { role: "user", text: question, time: new Date().toLocaleTimeString() }
    ];
    setMessages(nextMessages);
    onUpdateSession?.({
      ...session,
      messages: nextMessages
    });
    setInput("");
    setLoading(true);

    try {
      const historyPayload = nextMessages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text
      }));
      const data = await sendChatMessage({
        token: profile?.token || null,
        question,
        history: historyPayload,
        sessionId: session?.id || null
      });
      const updated = [
        ...nextMessages,
        {
          role: "assistant",
          text: data.answer,
          citations: data.citations || [],
          confidence: data.confidence || "Low",
          retrievedChunks: data.retrievedChunks || data.retrieved_chunks || [],
          queryType: data.query_type || data.queryType || "legal_info",
          time: new Date().toLocaleTimeString()
        }
      ];
      setMessages(updated);
      onUpdateSession?.({
        ...session,
        messages: updated
      });
    } catch (err) {
      const updated = [
        ...nextMessages,
        {
          role: "assistant",
          text: "The service is unavailable right now. Please try again.",
          citations: [],
          confidence: "Low",
          retrievedChunks: [],
          queryType: "legal_info",
          time: new Date().toLocaleTimeString()
        }
      ];
      setMessages(updated);
      onUpdateSession?.({
        ...session,
        messages: updated
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="chat-card">
      <div className="warning-banner">
        <strong>Warning:</strong> This chatbot does NOT provide legal advice.
      </div>
      <p className="official-hint">
        For full details, visit the official GOV.UK links below.
      </p>

      <div className="status-bar">
        <span>
          {greeting}
          {profile?.name ? `, ${profile.name}` : ""}. Ask about UK rights, visas, or tenancy rules.
        </span>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const reset = [{ role: "assistant", text: `${welcomeMessage}\n\n${disclaimer}`, citations: [], confidence: "Low", retrievedChunks: [] }];
            setMessages(reset);
            onUpdateSession?.({ ...session, messages: reset });
          }}
        >
          Clear chat
        </button>
      </div>

      <div className="suggestions">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            className="suggestion"
            onClick={() => setInput(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="messages" ref={messagesRef}>
        {messages.map((m, idx) => (
          <MessageBubble
            key={idx}
            role={m.role}
            text={m.text}
            time={m.time}
            citations={m.citations || []}
            confidence={m.confidence || "Low"}
            retrievedChunks={m.retrievedChunks || []}
            queryType={m.queryType}
          />
        ))}
        {loading ? (
          <div className="bubble assistant typing">
            <div className="bubble-header">
              <strong>Assistant</strong>
              <span className="bubble-time">typing</span>
            </div>
            <div className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about UK law (e.g., 'What are my rights at work?')"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
    </section>
  );
}
