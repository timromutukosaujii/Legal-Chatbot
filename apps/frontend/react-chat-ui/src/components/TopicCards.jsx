import { motion } from "framer-motion";

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h18v10H3zM9 8V6h6v2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3a9 9 0 1 0 0 18m0-18c2 2.6 3 6 3 9s-1 6.4-3 9m0-18c-2 2.6-3 6-3 9s1 6.4 3 9M3 12h18" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 11 9-7 9 7M5 10v10h14V10M9 20v-6h6v6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 5 6v6c0 4.2 2.5 6.9 7 9 4.5-2.1 7-4.8 7-9V6l-7-3Z" />
    </svg>
  );
}

const TOPICS = [
  {
    label: "Employment Law",
    prompt: "What are my rights at work?",
    icon: <BriefcaseIcon />
  },
  {
    label: "Immigration Help",
    prompt: "Help me understand immigration law basics",
    icon: <GlobeIcon />
  },
  {
    label: "Tenant Rights",
    prompt: "What are my tenant rights?",
    icon: <HomeIcon />
  },
  {
    label: "Consumer Protection",
    prompt: "Explain my consumer protection rights",
    icon: <ShieldIcon />
  }
];

export default function TopicCards({ onSelectTopic }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Explore Legal Topics</h3>
      <div className="grid grid-cols-2 gap-3">
        {TOPICS.map((topic) => (
          <motion.button
            key={topic.label}
            whileHover={{ scale: 1.03, y: -2 }}
            type="button"
            onClick={() => onSelectTopic(topic.prompt)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-soft transition hover:border-blue-300"
          >
            <div className="topic-icon mb-2 inline-flex rounded-lg bg-blue-50 p-1.5 text-blue-600">{topic.icon}</div>
            <p className="text-sm font-semibold text-slate-800">{topic.label}</p>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
