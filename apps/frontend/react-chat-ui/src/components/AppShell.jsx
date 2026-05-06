import { motion } from "framer-motion";

export default function AppShell({ sidebar, header, children }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-screen bg-slate-100"
    >
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </motion.main>
  );
}
