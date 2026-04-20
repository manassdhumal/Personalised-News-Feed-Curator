"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CATEGORY_ICONS } from "@/lib/api";

const ALL_CATEGORIES = ["technology", "sports", "business", "entertainment", "health", "science", "general"];

interface SearchBarProps {
  onSearch: (query: string) => void;
  onCategoryChange: (categories: string[]) => void;
  selectedCategories: string[];
}

export default function SearchBar({ onSearch, onCategoryChange, selectedCategories }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      onCategoryChange(selectedCategories.filter((c) => c !== cat));
    } else {
      onCategoryChange([...selectedCategories, cat]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-4 space-y-3"
    >
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!e.target.value) onSearch(""); }}
            placeholder="Search articles..."
            className="w-full px-4 py-2.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); onSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-lg bg-primary/20 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
        >
          🔍
        </button>
      </form>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                isSelected
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {CATEGORY_ICONS[cat]} {cat}
            </button>
          );
        })}
        {selectedCategories.length > 0 && (
          <button
            onClick={() => onCategoryChange([])}
            className="px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>
    </motion.div>
  );
}
