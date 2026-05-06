import { motion } from "framer-motion";

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v2.6m0 12.8V21m9-9h-2.6M5.6 12H3m14.8 6.4-1.9-1.9M8.1 8.1 6.2 6.2m11.6 0-1.9 1.9M8.1 15.9l-1.9 1.9" />
      <circle cx="12" cy="12" r="3.8" />
    </svg>
  );
}

export default function Header({ onOpenSettings }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/60 glass px-6 shadow-glass"
    >
      <h2 className="font-semibold text-slate-800">Lawyer GPT</h2>
      <button
        type="button"
        onClick={onOpenSettings}
        className="rounded-lg border border-slate-300 bg-white/70 p-2 text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
        aria-label="Open settings"
      >
        <GearIcon />
      </button>
    </motion.header>
  );
}
