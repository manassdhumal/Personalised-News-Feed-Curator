"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import NewsCard from "@/components/NewsCard";
import FeedToggle from "@/components/FeedToggle";
import SearchBar from "@/components/SearchBar";
import WhyPanel from "@/components/WhyPanel";
import { useAuth } from "@/components/AuthContext";
import {
  fetchFeed, fetchWhy,
  Article, WhyResponse, ALGORITHMS,
} from "@/lib/api";

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [mode, setMode] = useState<"ai" | "normal">("ai");
  const [algorithm, setAlgorithm] = useState("thompson_sampling");
  const [whyData, setWhyData] = useState<WhyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWhyLoading, setIsWhyLoading] = useState(false);
  const [recommendedCategory, setRecommendedCategory] = useState("");
  const [feedKey, setFeedKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const loadFeed = useCallback(async (append = false) => {
    if (!user) return;
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const data = await fetchFeed(mode, 12, algorithm, searchQuery, selectedCategories);
      if (append) {
        setArticles((prev) => [...prev, ...data.articles]);
      } else {
        setArticles(data.articles);
        setFeedKey((k) => k + 1);
      }
      setRecommendedCategory(data.recommended_category);

      if (mode === "ai" && !append) {
        setIsWhyLoading(true);
        const why = await fetchWhy();
        setWhyData(why);
        setIsWhyLoading(false);
      } else if (mode !== "ai") {
        setWhyData(null);
      }
    } catch (err) {
      console.error("Failed to load feed:", err);
    }
    setIsLoading(false);
    setIsLoadingMore(false);
  }, [user, mode, algorithm, searchQuery, selectedCategories]);

  useEffect(() => {
    if (user) loadFeed();
  }, [loadFeed, user]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && articles.length > 0) {
          loadFeed(true);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [isLoading, isLoadingMore, articles.length, loadFeed]);

  const handleFeedbackSent = useCallback(() => {
    if (mode === "ai") fetchWhy().then(setWhyData).catch(console.error);
  }, [mode]);

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Your News Feed</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "ai"
                ? `AI recommends: ${recommendedCategory || "loading..."}`
                : "Showing random mix of news"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <FeedToggle mode={mode} onChange={setMode} />
            {mode === "ai" && (
              <div className="flex items-center gap-1 glass-card rounded-xl px-2 py-1">
                {ALGORITHMS.map((algo) => (
                  <button
                    key={algo.id}
                    onClick={() => setAlgorithm(algo.id)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                      algorithm === algo.id
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={algo.name}
                  >
                    {algo.icon}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => loadFeed()}
              className="px-4 py-2.5 rounded-xl glass-card text-sm font-medium hover:bg-primary/10 transition-colors">
              🔄
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mb-6">
          <SearchBar
            onSearch={setSearchQuery}
            onCategoryChange={setSelectedCategories}
            selectedCategories={selectedCategories}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
                    <div className="h-32 bg-secondary/30" />
                    <div className="p-4">
                      <div className="h-3 bg-secondary rounded w-20 mb-3" />
                      <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                      <div className="h-3 bg-secondary rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  <motion.div key={feedKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {articles.map((article, index) => (
                      <NewsCard
                        key={`${article.title}-${index}`}
                        article={article}
                        index={index}
                        onFeedbackSent={handleFeedbackSent}
                      />
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* Infinite scroll trigger */}
                <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Loading more...
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {mode === "ai" && <WhyPanel data={whyData} isLoading={isWhyLoading} />}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="glass-card rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Quick Info</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>User</span>
                  <span className="text-foreground">{user.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Feed Mode</span>
                  <span className={mode === "ai" ? "text-primary" : "text-foreground"}>
                    {mode === "ai" ? "🧠 AI Powered" : "📰 Normal"}
                  </span>
                </div>
                {mode === "ai" && (
                  <div className="flex justify-between">
                    <span>Algorithm</span>
                    <span className="text-primary">
                      {ALGORITHMS.find((a) => a.id === algorithm)?.icon}{" "}
                      {ALGORITHMS.find((a) => a.id === algorithm)?.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Articles</span>
                  <span className="text-foreground">{articles.length}</span>
                </div>
                {recommendedCategory && mode === "ai" && (
                  <div className="flex justify-between">
                    <span>Top Category</span>
                    <span className="text-primary capitalize">{recommendedCategory}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
