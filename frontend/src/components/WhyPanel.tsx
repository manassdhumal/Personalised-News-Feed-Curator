"use client";

import { WhyResponse, CATEGORY_COLORS } from "@/lib/api";
import { motion } from "framer-motion";

interface WhyPanelProps {
  data: WhyResponse | null;
  isLoading: boolean;
}

export default function WhyPanel({ data, isLoading }: WhyPanelProps) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-secondary rounded w-2/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-secondary rounded w-full" />
          <div className="h-3 bg-secondary rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const sortedScores = Object.entries(data.category_scores)
    .sort(([, a], [, b]) => b - a);

  const maxScore = Math.max(...Object.values(data.category_scores), 0.01);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">🧠</span>
        <h3 className="text-sm font-semibold">Why this recommendation?</h3>
      </div>

      {/* Factors */}
      <div className="space-y-2 mb-4">
        {data.factors.map((factor, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
            <span>{factor}</span>
          </div>
        ))}
      </div>

      {/* Category Scores */}
      <div className="pt-3 border-t border-border/50">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">Category Confidence Scores</h4>
        <div className="space-y-1.5">
          {sortedScores.map(([cat, score]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className="w-20 capitalize text-muted-foreground truncate">{cat}</span>
              <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(score / maxScore) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.general }}
                />
              </div>
              <span className="w-10 text-right text-muted-foreground">
                {(score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
