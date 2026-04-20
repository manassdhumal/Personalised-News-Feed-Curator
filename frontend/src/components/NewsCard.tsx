"use client";

import { Article, sendFeedback, addBookmark, CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

interface NewsCardProps {
  article: Article;
  index: number;
  onFeedbackSent?: () => void;
}

// Gradient placeholders when no image
const CATEGORY_GRADIENTS: Record<string, string> = {
  technology: "from-blue-600/30 to-indigo-800/30",
  sports: "from-emerald-600/30 to-teal-800/30",
  business: "from-amber-600/30 to-yellow-800/30",
  entertainment: "from-pink-600/30 to-rose-800/30",
  health: "from-green-600/30 to-emerald-800/30",
  science: "from-purple-600/30 to-violet-800/30",
  general: "from-slate-600/30 to-gray-800/30",
};

export default function NewsCard({ article, index, onFeedbackSent }: NewsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasClicked, setHasClicked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [imgError, setImgError] = useState(false);
  const startTimeRef = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  // Use refs so the IntersectionObserver cleanup always reads the latest value
  const hasSeenRef = useRef(false);
  const hasClickedRef = useRef(false);
  const categoryColor = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.general;
  const categoryIcon = CATEGORY_ICONS[article.category] || CATEGORY_ICONS.general;

  // Track when the card enters the viewport for at least 1 second (genuine impression)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    let visibilityTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Start a 1-second timer — only count as a real impression if in view that long
          visibilityTimer = setTimeout(() => {
            hasSeenRef.current = true;
          }, 1000);
        } else {
          if (visibilityTimer) {
            clearTimeout(visibilityTimer);
            visibilityTimer = null;
          }
        }
      },
      { threshold: 0.5 } // card must be 50% visible
    );

    observer.observe(el);

    // On unmount: if the card was genuinely seen but never clicked → send negative impression
    return () => {
      observer.disconnect();
      if (visibilityTimer) clearTimeout(visibilityTimer);
      if (hasSeenRef.current && !hasClickedRef.current) {
        sendFeedback(article.category, false, 0, article.title, article.url).catch(() => {});
      }
    };
  }, [article]);

  const handleClick = useCallback(async () => {
    if (hasClickedRef.current) return;
    hasClickedRef.current = true;
    setHasClicked(true);
    setIsExpanded(true);
    startTimeRef.current = Date.now();
    await sendFeedback(article.category, true, 0, article.title, article.url);
    onFeedbackSent?.();
  }, [article, onFeedbackSent]);

  const handleClose = useCallback(async () => {
    const timeSpent = (Date.now() - startTimeRef.current) / 1000;
    setIsExpanded(false);
    if (timeSpent > 1) {
      await sendFeedback(article.category, true, timeSpent, article.title, article.url);
      onFeedbackSent?.();
    }
  }, [article, onFeedbackSent]);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBookmarked) return;
    try {
      await addBookmark(article);
      setIsBookmarked(true);
    } catch { /* ignore */ }
  };

  const showImage = article.image_url && !imgError;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      layout
    >
      <div
        className="glass-card rounded-2xl overflow-hidden cursor-pointer group"
        onClick={!isExpanded ? handleClick : undefined}
      >
        {/* Image or gradient placeholder */}
        {showImage ? (
          <div className="relative h-40 overflow-hidden">
            <img
              src={article.image_url!}
              alt={article.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <Badge
              variant="secondary"
              className="absolute top-3 left-3 text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm"
              style={{ backgroundColor: `${categoryColor}30`, color: categoryColor, borderColor: `${categoryColor}50` }}
            >
              {categoryIcon} {article.category}
            </Badge>
          </div>
        ) : (
          <div className={`h-24 bg-gradient-to-br ${CATEGORY_GRADIENTS[article.category] || CATEGORY_GRADIENTS.general} flex items-center justify-center relative`}>
            <span className="text-4xl opacity-30">{categoryIcon}</span>
            <Badge
              variant="secondary"
              className="absolute top-3 left-3 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${categoryColor}20`, color: categoryColor, borderColor: `${categoryColor}40` }}
            >
              {categoryIcon} {article.category}
            </Badge>
          </div>
        )}

        <div className="p-4">
          {/* Source + Bookmark */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{article.source}</span>
            <button
              onClick={handleBookmark}
              className={`text-sm transition-all ${isBookmarked ? "text-yellow-400 scale-110" : "text-muted-foreground hover:text-yellow-400 opacity-0 group-hover:opacity-100"}`}
              title={isBookmarked ? "Bookmarked" : "Bookmark"}
            >
              {isBookmarked ? "★" : "☆"}
            </button>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold leading-snug mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </h3>

          {/* Description */}
          <p className={`text-xs text-muted-foreground leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
            {article.description}
          </p>

          {/* Expanded view */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 pt-3 border-t border-border/50"
            >
              <div className="flex items-center justify-between">
                <a href={article.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}>
                  Read full article →
                </a>
                <button onClick={(e) => { e.stopPropagation(); handleClose(); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                  Close
                </button>
              </div>
              {hasClicked && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-primary/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Tracking reading time for personalization
                </div>
              )}
            </motion.div>
          )}

          {hasClicked && !isExpanded && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-primary/60">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Feedback recorded
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
