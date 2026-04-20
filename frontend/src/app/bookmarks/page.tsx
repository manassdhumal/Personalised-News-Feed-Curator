"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/components/AuthContext";
import { fetchBookmarks, removeBookmark, Bookmark, CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/api";

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchBookmarks().then(setBookmarks).catch(console.error).finally(() => setLoading(false));
    }
  }, [user]);

  const handleRemove = async (id: number) => {
    await removeBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-2xl font-bold gradient-text mb-1">Bookmarks</h1>
          <p className="text-sm text-muted-foreground mb-6">Your saved articles for later reading</p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-5 h-32 animate-pulse">
                <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-3 bg-secondary rounded w-full" />
              </div>
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <span className="text-4xl mb-4 block">🔖</span>
            <p className="text-muted-foreground">No bookmarks yet. Save articles from the feed!</p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookmarks.map((bookmark) => (
                <motion.div
                  key={bookmark.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card rounded-2xl overflow-hidden group"
                >
                  <div className="h-1" style={{ backgroundColor: CATEGORY_COLORS[bookmark.category] || CATEGORY_COLORS.general }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: `${CATEGORY_COLORS[bookmark.category] || CATEGORY_COLORS.general}15`,
                        color: CATEGORY_COLORS[bookmark.category] || CATEGORY_COLORS.general,
                      }}>
                        {CATEGORY_ICONS[bookmark.category]} {bookmark.category}
                      </span>
                      <button
                        onClick={() => handleRemove(bookmark.id)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ✕ Remove
                      </button>
                    </div>
                    <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="block">
                      <h3 className="text-sm font-semibold leading-snug mb-1 hover:text-primary transition-colors line-clamp-2">
                        {bookmark.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{bookmark.description}</p>
                    </a>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{bookmark.source}</span>
                      <span>{new Date(bookmark.created_at * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
