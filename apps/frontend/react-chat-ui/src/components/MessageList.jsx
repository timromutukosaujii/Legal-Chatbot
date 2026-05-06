import { AnimatePresence, motion } from "framer-motion";
import MessageBubble from "./MessageBubble";

export default function MessageList({ messages, loading, messagesRef }) {
  return (
    <div ref={messagesRef} className="max-h-[58vh] space-y-3 overflow-y-auto rounded-xl">
      <AnimatePresence initial={false}>
        {messages.map((m, idx) => (
          <MessageBubble
            key={`${m.role}-${idx}-${m.time || "x"}`}
            role={m.role}
            text={m.text}
            time={m.time}
            citations={m.citations || []}
            confidence={m.confidence || "Low"}
            retrievedChunks={m.retrievedChunks || []}
          />
        ))}
      </AnimatePresence>

      {loading ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Assistant is thinking...
        </motion.div>
      ) : null}
    </div>
  );
}
