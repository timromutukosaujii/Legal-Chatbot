import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import NoticeCard from "./NoticeCard";
import TopicCards from "./TopicCards";
import { sendChatMessage } from "../services/api";

const QUICK_PROMPTS = [
  "Summarise Article 8 in simple terms",
  "What should I do before speaking to a solicitor?",
  "Explain unfair dismissal basics",
  "Can my landlord evict me without notice?"
];

function classifyTitle(text = "") {
  const q = text.toLowerCase();
  if (q.includes("tenant") || q.includes("rent")) return "Tenant rights question";
  if (q.includes("visa") || q.includes("immigration") || q.includes("citizenship")) return "Visa question";
  if (q.includes("work") || q.includes("employee") || q.includes("employer")) return "Work rights question";
  if (q.includes("human rights") || q.includes("article")) return "Human rights question";
  return "General legal question";
}

function detectDomain(text = "") {
  const q = text.toLowerCase();
  if (/\b(landlord|landlords|tenant|tenancy|rent|repairs|notice|eviction|private renting)\b/.test(q)) {
    return "tenancy";
  }
  if (/\b(work|worker|employee|employer|dismissal|wage|salary|holiday)\b/.test(q)) {
    return "employment";
  }
  if (/\b(article|human rights|equality act|freedom of expression|privacy)\b/.test(q)) {
    return "human_rights";
  }
  if (/\b(visa|immigration|ilr|citizenship|asylum|skilled worker|graduate visa)\b/.test(q)) {
    return "immigration";
  }
  return "general";
}

const DOMAIN_TERMS = {
  tenancy: ["tenant", "landlord", "rent", "tenancy", "private renting", "repair", "notice", "eviction"],
  employment: ["worker", "employee", "employer", "wage", "dismissal", "holiday", "employment"],
  human_rights: ["human rights", "article", "equality act", "expression", "privacy"],
  immigration: ["visa", "immigration", "citizenship", "ilr", "asylum"]
};

function getCitationRelevance(citations, domain) {
  if (!citations?.length || domain === "general") return 1;
  const terms = DOMAIN_TERMS[domain] || [];
  let matched = 0;
  for (const c of citations) {
    const text = `${c?.source || ""} ${c?.snippet || ""}`.toLowerCase();
    if (terms.some((t) => new RegExp(`\\b${t.replace(/\s+/g, "\\s+")}\\b`, "i").test(text))) {
      matched += 1;
    }
  }
  return matched / citations.length;
}

export default function ChatBox({ token, conversation, onConversationChange, onUsageUpdate, notice, setNotice }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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

  const updateConversation = (nextMessages) => {
    const firstUser = nextMessages.find((m) => m.role === "user");
    const title = firstUser ? classifyTitle(firstUser.text) : "New chat";
    onConversationChange({
      ...conversation,
      title,
      messages: nextMessages,
      updatedAt: Date.now()
    });
  };

  const submit = async (question) => {
    if (!question || loading) return;
    setNotice("");

    const next = [...messages, { role: "user", text: question, time: new Date().toLocaleTimeString() }];
    updateConversation(next);
    setInput("");
    setLoading(true);

    try {
      const safeHistory = next
        .slice(-8)
        .filter((m) => {
          const t = String(m?.text || "").trim();
          if (!t) return false;
          // Do not send raw serialized backend validation errors back to the model.
          if (t.startsWith("{\"detail\"") || t.startsWith("{\"error\"")) return false;
          return true;
        })
        .map((m) => ({ role: m.role, text: m.text }));

      const data = await sendChatMessage({
        token,
        question,
        history: safeHistory,
        sessionId: conversation.id
      });

      const domain = detectDomain(question);
      const citations = data.citations || [];
      const relevance = getCitationRelevance(citations, domain);
      const isOffTopic = domain !== "general" && relevance < 0.5;
      const answerText = isOffTopic
        ? "I could not find reliable sources for that specific topic in this attempt. Please rephrase your question and I will try again with a narrower focus."
        : data.answer;

      const updated = [
        ...next,
        {
          role: "assistant",
          text: answerText,
          citations: isOffTopic ? [] : citations,
          confidence: isOffTopic ? "Low" : (data.confidence || data.confidence_label || "Low"),
          retrievedChunks: isOffTopic ? [] : (data.retrieved_chunks || []),
          queryType: data.query_type || "legal_info",
          time: new Date().toLocaleTimeString()
        }
      ];
      updateConversation(updated);
      if (data.usage) onUsageUpdate?.(data.usage);
    } catch (err) {
      let msg = err?.message || "The service is unavailable right now. Please try again.";
      if (/unauthorized/i.test(msg)) {
        msg = "Your session expired. Please log in again.";
      } else if (/upgrade/i.test(msg) || /limit/i.test(msg)) {
        msg = "Daily free-plan limit reached. Upgrade to continue.";
      }
      setNotice(msg);
      const updated = [
        ...next,
        {
          role: "assistant",
          text: msg,
          citations: [],
          confidence: "Low",
          retrievedChunks: [],
          queryType: "legal_info",
          time: new Date().toLocaleTimeString()
        }
      ];
      updateConversation(updated);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = (prompt) => {
    setInput(prompt);
    // Start chat immediately when selecting a topic.
    submit(prompt);
  };

  const handleQuickPromptClick = (prompt) => {
    setInput(prompt);
  };

  return (
    <section className="chat-card">
      <NoticeCard />

      {notice ? <p className="error-banner">{notice}</p> : null}

      <div className="status-bar">
        <span>Transparent answers with confidence and sources.</span>
        <button type="button" className="ghost" onClick={() => window.print()}>
          Export Chat (PDF)
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!hasStartedChat ? (
          <motion.div
            key="pre-chat-panel"
            className="prechat-panel"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <TopicCards onSelectTopic={handleTopicSelect} />
            <div className="suggestions">
              {QUICK_PROMPTS.map((item) => (
                <button key={item} type="button" className="suggestion" onClick={() => handleQuickPromptClick(item)}>
                  {item}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
            onSuggestionClick={(s) => setInput(s)}
          />
        ))}
        {loading ? (
          <div className="bubble assistant typing">
            <div className="bubble-header">
              <strong>Assistant</strong>
              <span className="bubble-time">now</span>
            </div>
            <p>AI is thinking...</p>
            <div className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input.trim());
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about UK law (e.g., 'What are my rights at work?')"
        />
        <button type="submit" disabled={loading}>{loading ? "Thinking..." : "Send"}</button>
      </form>
    </section>
  );
}
