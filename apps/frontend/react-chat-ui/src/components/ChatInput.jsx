import { motion } from "framer-motion";

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m8 12 6.5-6.5a3 3 0 1 1 4.2 4.2L10 18.4a5 5 0 1 1-7-7L12.6 1.8" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 12 18-9-5 9 5 9-18-9Z" />
    </svg>
  );
}

export default function ChatInput({ input, setInput, loading, onSubmit }) {
  return (
    <form
      className="sticky bottom-4 mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(input.trim());
      }}
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-glass">
        <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Attachment">
          <PaperclipIcon />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a legal question..."
          className="w-full rounded-full border border-transparent bg-white px-2 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
        <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Microphone">
          <MicIcon />
        </button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="submit"
          disabled={loading}
          className="rounded-full bg-gradient-to-r from-blue-600 to-blue-500 p-3 text-white shadow-sm transition hover:brightness-110 disabled:opacity-70"
          title="Send"
        >
          <SendIcon />
        </motion.button>
      </div>
    </form>
  );
}
