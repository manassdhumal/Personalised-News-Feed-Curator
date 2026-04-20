"use client";

import { UserInfo } from "@/lib/api";
import { motion } from "framer-motion";

interface UserSwitcherProps {
  users: UserInfo[];
  currentUserId: string;
  onChange: (userId: string) => void;
}

const USER_AVATARS: Record<string, string> = {
  user_1: "👨‍💻",
  user_2: "⚽",
  user_3: "💼",
  user_4: "🎭",
  user_5: "🌍",
};

export default function UserSwitcher({ users, currentUserId, onChange }: UserSwitcherProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-foreground">Simulation Panel</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          Multi-User
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {users.map((user) => {
          const isActive = user.user_id === currentUserId;
          return (
            <button
              key={user.user_id}
              onClick={() => onChange(user.user_id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                isActive
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "hover:bg-secondary/50 border border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-xl">{USER_AVATARS[user.user_id] || "👤"}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user.display_name}</div>
                <div className="text-xs opacity-70 truncate">{user.description}</div>
              </div>
              {isActive && (
                <div className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
