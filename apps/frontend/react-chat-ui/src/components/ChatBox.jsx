import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import NoticeCard from "./NoticeCard";
import { sendChatMessage } from "../services/api";

const QUICK_PROMPTS = [
  "What does Article 8 protect?",
  "What rights are protected by the Human Rights Act?",
  "What is a declaration of incompatibility?",
  "What does Article 14 cover?",
  "How does the Equality Act protect against discrimination?",
  "What is judicial independence?"
];

function classifyTitle(text = "") {
  const q = text.toLowerCase();
  if (q.includes("article") || q.includes("human rights") || q.includes("echr")) return "Human rights question";
  if (q.includes("equality") || q.includes("discrimination")) return "Equality question";
  if (q.includes("constitutional") || q.includes("magna carta") || q.includes("supreme court") || q.includes("judicial")) return "Constitutional question";
  if (q.includes("privacy") || q.includes("data protection")) return "Privacy question";
  return "UK legal information";
}

function makeAssistantIntro() {
  return {
    role: "assistant",
    text: "Hello. I can help explain UK constitutional and human-rights law using source-grounded information. I do not provide personalised legal advice.",
    citations: [],
    confidence: "Low",
    retrievedChunks: [],
    time: new Date().toLocaleTimeString()
  };
}

export default function ChatBox({ token, conversation, onConversationChange, onUsageUpdate, notice, setNotice, featurePromptToken = 0 }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("Checking legal sources...");
  const [confirmClear, setConfirmClear] = useState(false);
  const messagesRef = useRef(null);

  const messages = conversation?.messages || [];
  const hasStartedChat = useMemo(
    () => messages.some((message) => message.role === "user" && String(message.text || "").trim()),
    [messages]
  );

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!featurePromptToken || loading) return;
    submit("What can you do?");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featurePromptToken]);

  useEffect(() => {
    if (!loading) return undefined;
    setLoadingPhase("Checking legal sources...");
    const timer = setInterval(() => {
      setLoadingPhase((prev) =>
        prev === "Checking legal sources..." ? "Generating source-grounded answer..." : "Checking legal sources..."
      );
    }, 1300);
    return () => clearInterval(timer);
  }, [loading]);

  const updateConversation = (nextMessages) => {
    const firstUser = nextMessages.find((m) => m.role === "user");
    const title = firstUser ? classifyTitle(firstUser.text) : "New chat";
    onConversationChange({ ...conversation, title, messages: nextMessages, updatedAt: Date.now() });
  };

  const submit = async (question) => {
    const cleanQuestion = String(question || "").trim();
    if (!cleanQuestion || loading) return;
    setNotice("");
    const next = [...messages, { role: "user", text: cleanQuestion, time: new Date().toLocaleTimeString() }];
    updateConversation(next);
    setInput("");
    setLoading(true);

    try {
      const data = await sendChatMessage({
        token,
        question: cleanQuestion,
        conversationId: conversation.id
      });
      const updated = [
        ...next,
        {
          role: "assistant",
          text: data.answer,
          citations: data.citations || [],
          confidence: data.confidence || "low",
          retrievedChunks: data.retrievedChunks || data.retrieved_chunks || [],
          queryType: data.answerType || data.query_type || "legal_information",
          scope: data.scope || "in_scope",
          safetyTriggered: Boolean(data.safetyTriggered),
          suggestedFollowUps: data.suggestedFollowUps || [],
          reasoning: data.reasoning || null,
          time: new Date().toLocaleTimeString()
        }
      ];
      updateConversation(updated);
      if (data.usage) onUsageUpdate?.(data.usage);
    } catch (err) {
      const msg = err?.message || "The service is unavailable right now. Please try again.";
      setNotice(msg);
      const updated = [...next, { role: "assistant", text: msg, citations: [], confidence: "low", retrievedChunks: [], queryType: "error", scope: "in_scope", safetyTriggered: false, suggestedFollowUps: [], reasoning: null, time: new Date().toLocaleTimeString() }];
      updateConversation(updated);
    } finally {
      setLoading(false);
    }
  };

  const clearCurrentChat = () => {
    updateConversation([makeAssistantIntro()]);
    setConfirmClear(false);
  };

  return (
    <section className="chat-card">
      <div className="status-bar">
        <span />
        <div className="status-actions">
          <button type="button" className="ghost" onClick={() => setConfirmClear(true)}>Clear Chat</button>
        </div>
      </div>

      <NoticeCard />
      {notice ? <p className="error-banner">{notice}</p> : null}

      <AnimatePresence mode="wait">
        {!hasStartedChat ? (
          <motion.div key="pre-chat-panel" className="prechat-panel" initial={{ opacity: 1, y: 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.24, ease: "easeOut" }}>
            <div className="welcome-panel">
              <h3>Ask clear legal questions, get grounded answers</h3>
              <p>Responses are based on your loaded UK legal documents and include citations.</p>
            </div>
            <div className="suggestions">
              {QUICK_PROMPTS.map((item) => (
                <button key={item} type="button" className="suggestion" onClick={() => setInput(item)}>{item}</button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="messages" ref={messagesRef}>
        {messages.map((m, idx) => (
          <MessageBubble key={idx} role={m.role} text={m.text} time={m.time} citations={m.citations || []} confidence={m.confidence || "low"} retrievedChunks={m.retrievedChunks || []} queryType={m.queryType} scope={m.scope} safetyTriggered={m.safetyTriggered} suggestedFollowUps={m.suggestedFollowUps || []} reasoning={m.reasoning || null} onSuggestionClick={(s) => setInput(s)} />
        ))}
        {loading ? (
          <div className="bubble assistant typing"><div className="bubble-header"><strong>Assistant</strong><span className="bubble-time">now</span></div><p>{loadingPhase}</p><div className="typing-dots" aria-hidden="true"><span /><span /><span /></div></div>
        ) : null}
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(input.trim()); }}>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input.trim());
            }
          }}
          placeholder="Ask about UK human rights or constitutional law..."
        />
        <button type="submit" className="send-btn" disabled={loading || !input.trim()} aria-label="Send">
          {loading ? "..." : "Send"}
        </button>
      </form>
      <p className="composer-helper">General legal information only</p>

      {confirmClear ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Clear chat confirmation">
          <div className="modal-card">
            <h3>Clear current chat?</h3>
            <p>This will remove messages from the current chat window.</p>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button type="button" className="primary danger" onClick={clearCurrentChat}>Clear</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

