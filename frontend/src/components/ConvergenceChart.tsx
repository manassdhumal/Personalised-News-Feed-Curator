"use client";

import { ConvergenceData, CATEGORY_COLORS } from "@/lib/api";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface ConvergenceChartProps {
  data: ConvergenceData | null;
  isLoading: boolean;
}

export default function ConvergenceChart({ data, isLoading }: ConvergenceChartProps) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 h-72 animate-pulse">
        <div className="h-4 bg-secondary rounded w-1/3 mb-4" />
        <div className="h-full bg-secondary/30 rounded-xl" />
      </div>
    );
  }

  if (!data || data.snapshots.length < 2) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-1">Bandit Convergence</h3>
        <p className="text-xs text-muted-foreground mb-4">How model confidence evolves over time</p>
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Need more interactions to show convergence. Keep clicking articles!
        </div>
      </div>
    );
  }

  // Build chart data from snapshots
  const chartData = data.snapshots.map((snap, i) => {
    const point: Record<string, number | string> = { index: i + 1 };
    for (const cat of data.categories) {
      if (snap.data[cat]) {
        const { alpha, beta } = snap.data[cat];
        // Mean of Beta distribution = alpha / (alpha + beta)
        point[cat] = Math.round((alpha / (alpha + beta)) * 100) / 100;
      }
    }
    return point;
  });

  const tooltipStyle = {
    backgroundColor: "rgba(23, 23, 35, 0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    padding: "10px 14px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6"
    >
      <h3 className="text-sm font-semibold mb-1">Bandit Convergence</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Beta distribution means per category — watch them converge as the model learns
      </p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="index" stroke="rgba(255,255,255,0.3)" fontSize={11} label={{ value: "Updates", position: "bottom", fontSize: 10 }} />
            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} domain={[0, 1]} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#aaa" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.categories.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[cat] || CATEGORY_COLORS.general}
                strokeWidth={2}
                dot={false}
                name={cat.charAt(0).toUpperCase() + cat.slice(1)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
