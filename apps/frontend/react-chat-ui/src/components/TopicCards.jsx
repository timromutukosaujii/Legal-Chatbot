import { motion } from "framer-motion";

function ScaleIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v15m-7-9h14M7 10l-2.5 5h5L7 10Zm10 0-2.5 5h5L17 10Z" /></svg>;
}
function ShieldIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 5 6v6c0 4.2 2.5 6.9 7 9 4.5-2.1 7-4.8 7-9V6l-7-3Z" /></svg>;
}
function BookIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h8v14H4zM12 5h8v14h-8" /></svg>;
}
function CourtIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" className="topic-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h18M5 10l7-6 7 6M6 10v8m12-8v8M3 18h18"/></svg>;
}

const TOPICS = [
  {
    title: "Human Rights Act 1998",
    desc: "How Convention rights apply in UK law.",
    example: "What rights are protected?",
    prompt: "What rights are protected by the Human Rights Act 1998?",
    icon: <ScaleIcon />
  },
  {
    title: "European Convention on Human Rights",
    desc: "Core ECHR rights used in UK legal discussion.",
    example: "What does Article 8 protect?",
    prompt: "What does Article 8 protect?",
    icon: <ShieldIcon />
  },
  {
    title: "Equality Act 2010",
    desc: "Discrimination protections and equality duties.",
    example: "How does it protect against discrimination?",
    prompt: "How does the Equality Act protect against discrimination?",
    icon: <BookIcon />
  },
  {
    title: "UK Constitutional Principles",
    desc: "Rule of law, judicial independence, and institutions.",
    example: "What is judicial independence?",
    prompt: "What is judicial independence?",
    icon: <CourtIcon />
  },
  {
    title: "Privacy and Data Rights",
    desc: "Privacy rights and data protection foundations.",
    example: "How is privacy protected?",
    prompt: "How is privacy protected under UK legal frameworks?",
    icon: <ShieldIcon />
  },
  {
    title: "Fair Trial Rights",
    desc: "Understanding fair hearing and due process rights.",
    example: "What is a fair trial right?",
    prompt: "What are fair trial rights under Article 6?",
    icon: <ScaleIcon />
  },
  {
    title: "Freedom of Expression",
    desc: "Speech rights and lawful limitations.",
    example: "What does Article 10 cover?",
    prompt: "What does Article 10 cover?",
    icon: <BookIcon />
  },
  {
    title: "Public Authority Duties",
    desc: "How public bodies must apply rights in decisions.",
    example: "What duties do authorities have?",
    prompt: "What duties do public authorities have under the Human Rights Act?",
    icon: <CourtIcon />
  }
];

export default function TopicCards({ onSelectTopic }) {
  return (
    <section>
      <h3 className="kb-title">Explore Legal Topics</h3>
      <div className="topic-grid">
        {TOPICS.map((topic) => (
          <motion.button
            key={topic.title}
            whileHover={{ scale: 1.02, y: -2 }}
            type="button"
            onClick={() => onSelectTopic(topic.prompt)}
            className="topic-card"
          >
            <div className="topic-icon">{topic.icon}</div>
            <p className="topic-title">{topic.title}</p>
            <p className="topic-desc">{topic.desc}</p>
            <p className="topic-example">Example: "{topic.example}"</p>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
