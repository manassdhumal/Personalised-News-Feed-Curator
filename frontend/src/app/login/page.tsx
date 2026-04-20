"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loginUser } from "@/lib/api";
import { useAuth } from "@/components/AuthContext";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  // Demo accounts for quick login
  const demoAccounts = [
    { username: "tech_enthusiast", label: "Tech Enthusiast", icon: "👨‍💻" },
    { username: "sports_fan", label: "Sports Fan", icon: "⚽" },
    { username: "business_reader", label: "Business Reader", icon: "💼" },
    { username: "entertainment_lover", label: "Entertainment Lover", icon: "🎭" },
    { username: "general_reader", label: "General Reader", icon: "🌍" },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginUser(username, password);
      await refresh();
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
    setLoading(false);
  };

  const handleDemoLogin = async (demoUsername: string) => {
    setError("");
    setLoading(true);
    try {
      await loginUser(demoUsername, "demo123");
      await refresh();
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 ai-glow">
            <span className="text-3xl">🧠</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">NewsCurator AI</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your personalized feed</p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">Register</Link>
          </div>
        </div>

        {/* Demo Accounts */}
        <div className="mt-6">
          <p className="text-xs text-center text-muted-foreground mb-3">Or try a demo account:</p>
          <div className="grid grid-cols-1 gap-2">
            {demoAccounts.map((demo) => (
              <button
                key={demo.username}
                onClick={() => handleDemoLogin(demo.username)}
                disabled={loading}
                className="flex items-center gap-3 px-4 py-2.5 glass-card rounded-xl text-sm hover:bg-primary/10 transition-colors text-left disabled:opacity-50"
              >
                <span className="text-xl">{demo.icon}</span>
                <div>
                  <div className="font-medium text-foreground">{demo.label}</div>
                  <div className="text-xs text-muted-foreground">{demo.username}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
