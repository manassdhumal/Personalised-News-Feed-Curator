"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import ConvergenceChart from "@/components/ConvergenceChart";
import { useAuth } from "@/components/AuthContext";
import { fetchUserStats, fetchConvergence, UserStats, ConvergenceData } from "@/lib/api";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [convergence, setConvergence] = useState<ConvergenceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConvergenceLoading, setIsConvergenceLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setIsConvergenceLoading(true);
    try {
      const [statsData, convData] = await Promise.all([
        fetchUserStats(),
        fetchConvergence(),
      ]);
      setStats(statsData);
      setConvergence(convData);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
    setIsLoading(false);
    setIsConvergenceLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadStats();
  }, [loadStats, user]);

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold gradient-text">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {user.display_name}&apos;s learning progress and engagement analytics
            </p>
          </div>
          <button onClick={loadStats}
            className="px-4 py-2.5 rounded-xl glass-card text-sm font-medium hover:bg-primary/10 transition-colors">
            🔄 Refresh Stats
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <AnalyticsCharts stats={stats} isLoading={isLoading} />
            <ConvergenceChart data={convergence} isLoading={isConvergenceLoading} />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* User Info Card */}
            {stats && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">{stats.display_name}</h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>User ID</span>
                    <span className="text-foreground font-mono text-[10px]">{stats.user_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overall CTR</span>
                    <span className="text-primary font-semibold">{(stats.ctr * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impressions</span>
                    <span className="text-foreground">{stats.total_impressions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Clicks</span>
                    <span className="text-foreground">{stats.total_clicks}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Session History */}
            {stats && stats.sessions && stats.sessions.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                className="glass-card rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">Session History</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.sessions.slice(-5).reverse().map((s, i) => (
                    <div key={i} className="text-xs p-2 rounded-lg bg-secondary/30 border border-border/30">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Session #{s.id}</span>
                        <span>{new Date(s.started_at * 1000).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-foreground">
                        <span>{s.interactions_count} actions</span>
                        <span>{s.clicks_count} clicks</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Recent Activity */}
            {stats && stats.interaction_history.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="glass-card rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.interaction_history
                    .filter((h) => h.clicked)
                    .slice(-5)
                    .reverse()
                    .map((h, i) => (
                      <div key={i} className="text-xs p-2 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="font-medium truncate text-foreground">{h.article_title || h.category}</div>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                          <span className="capitalize">{h.category}</span>
                          <span>•</span>
                          <span>{h.time_spent}s read</span>
                        </div>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
