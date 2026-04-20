"use client";

import { UserStats, CATEGORY_COLORS } from "@/lib/api";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, AreaChart, Area,
} from "recharts";

interface AnalyticsChartsProps {
  stats: UserStats | null;
  isLoading: boolean;
}

const tooltipStyle = {
  backgroundColor: "rgba(23, 23, 35, 0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  padding: "10px 14px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

export default function AnalyticsCharts({ stats, isLoading }: AnalyticsChartsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-6 h-64 animate-pulse">
            <div className="h-4 bg-secondary rounded w-1/3 mb-4" />
            <div className="h-full bg-secondary/30 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const ctrData = stats.ctr_over_time.map((d) => ({
    impressions: d.impressions,
    ctr: (d.ctr * 100),
  }));

  const catData = Object.entries(stats.category_distribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: CATEGORY_COLORS[name] || CATEGORY_COLORS.general,
  }));

  const prefData = Object.entries(stats.preference_scores)
    .map(([cat, score]) => ({
      category: cat.charAt(0).toUpperCase() + cat.slice(1),
      score: Math.round(score * 100),
      fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.general,
    }))
    .sort((a, b) => b.score - a.score);

  const engagementData = stats.interaction_history
    .filter((h) => h.clicked)
    .slice(-15)
    .map((h, i) => ({
      index: i + 1,
      readTime: Math.round(h.time_spent * 10) / 10,
      category: h.category,
    }));

  // Session preference over time
  const sessionData = stats.sessions && stats.sessions.length > 0
    ? stats.sessions.map((s, i) => ({
        session: i + 1,
        interactions: s.interactions_count,
        clicks: s.clicks_count,
        ctr: s.interactions_count > 0 ? Math.round((s.clicks_count / s.interactions_count) * 100) : 0,
      }))
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* CTR Over Time */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold">Click-Through Rate</h3>
        <p className="text-xs text-muted-foreground mb-3">CTR trend over impressions</p>
        <div className="h-44">
          {ctrData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ctrData}>
                <defs>
                  <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C8EEF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6C8EEF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="impressions" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="ctr" stroke="#6C8EEF" strokeWidth={2} fill="url(#ctrGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No data yet — interact with articles
            </div>
          )}
        </div>
      </motion.div>

      {/* Category Distribution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold">Category Distribution</h3>
        <p className="text-xs text-muted-foreground mb-3">Click distribution by category</p>
        <div className="h-44">
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {catData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No clicks recorded yet
            </div>
          )}
        </div>
      </motion.div>

      {/* AI Preference Scores */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold">AI Preference Scores</h3>
        <p className="text-xs text-muted-foreground mb-3">Model&apos;s learned preferences</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={prefData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={11} domain={[0, 100]} />
              <YAxis type="category" dataKey="category" stroke="rgba(255,255,255,0.3)" fontSize={10} width={80} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {prefData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Engagement or Session CTR */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold">
          {sessionData.length > 1 ? "Session Performance" : "Engagement Timeline"}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {sessionData.length > 1 ? "CTR per session over time" : "Reading time per clicked article"}
        </p>
        <div className="h-44">
          {sessionData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="session" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="ctr" stroke="#4ECDC4" strokeWidth={2} dot={{ fill: "#4ECDC4", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : engagementData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="index" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} unit="s" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="readTime" radius={[4, 4, 0, 0]}>
                  {engagementData.map((d, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[d.category] || CATEGORY_COLORS.general} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No engagement data yet
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
