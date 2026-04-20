"use client";

import { motion } from "framer-motion";

interface FeedToggleProps {
  mode: "ai" | "normal";
  onChange: (mode: "ai" | "normal") => void;
}

export default function FeedToggle({ mode, onChange }: FeedToggleProps) {
  return (
    <div className="flex items-center gap-2 glass-card rounded-xl px-3 py-2">
      <button
        onClick={() => onChange("normal")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          mode === "normal"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        📰 Normal
      </button>
      <div className="relative">
        <button
          onClick={() => onChange(mode === "ai" ? "normal" : "ai")}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            mode === "ai" ? "bg-primary" : "bg-secondary"
          }`}
        >
          <motion.div
            animate={{ x: mode === "ai" ? 20 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
          />
        </button>
      </div>
      <button
        onClick={() => onChange("ai")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          mode === "ai"
            ? "bg-primary/20 text-primary border border-primary/30"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        🧠 AI Feed
      </button>
    </div>
  );
}
