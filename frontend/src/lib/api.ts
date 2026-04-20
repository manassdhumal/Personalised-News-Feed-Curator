const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Article {
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  source: string;
  category: string;
  published_at: string;
}

export interface FeedResponse {
  articles: Article[];
  recommended_category: string;
  mode: string;
  user_id: string;
  algorithm: string;
}

export interface WhyResponse {
  user_id: string;
  recommended_category: string;
  explanation: string;
  category_scores: Record<string, number>;
  factors: string[];
}

export interface UserStats {
  user_id: string;
  display_name: string;
  total_clicks: number;
  total_impressions: number;
  ctr: number;
  category_distribution: Record<string, number>;
  preference_scores: Record<string, number>;
  interaction_history: Array<{
    category: string;
    clicked: boolean;
    time_spent: number;
    article_title: string;
    timestamp: number;
  }>;
  ctr_over_time: Array<{ impressions: number; ctr: number; timestamp: number }>;
  sessions: Array<{
    id: number;
    started_at: number;
    ended_at: number | null;
    interactions_count: number;
    clicks_count: number;
    categories_explored: string[];
  }>;
}

export interface UserInfo {
  user_id: string;
  display_name: string;
  username: string;
  is_demo: boolean;
}

export interface Bookmark {
  id: number;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  source: string;
  category: string;
  published_at: string;
  created_at: number;
}

export interface BanditSnapshot {
  data: Record<string, { alpha: number; beta: number }>;
  timestamp: number;
}

export interface ConvergenceData {
  snapshots: BanditSnapshot[];
  categories: string[];
}

// ── Auth helpers ──────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function registerUser(username: string, password: string, displayName: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, display_name: displayName }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Registration failed");
  }
  const data = await res.json();
  localStorage.setItem("auth_token", data.token);
  return data;
}

export async function loginUser(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Login failed");
  }
  const data = await res.json();
  localStorage.setItem("auth_token", data.token);
  return data;
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export function logout() {
  localStorage.removeItem("auth_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ── Feed ──────────────────────────────────────────────────

export async function fetchFeed(
  mode: "ai" | "normal" = "ai",
  count: number = 12,
  algorithm: string = "thompson_sampling",
  search: string = "",
  categories: string[] = []
): Promise<FeedResponse> {
  const params = new URLSearchParams({
    mode,
    count: String(count),
    algorithm,
  });
  if (search) params.set("search", search);
  if (categories.length) params.set("categories", categories.join(","));

  const res = await fetch(`${API_BASE}/feed?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch feed");
  return res.json();
}

export async function sendFeedback(
  category: string,
  clicked: boolean,
  timeSpent: number,
  articleTitle: string = "",
  articleUrl: string = ""
): Promise<void> {
  await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      category,
      clicked,
      time_spent: timeSpent,
      article_title: articleTitle,
      article_url: articleUrl,
    }),
  });
}

export async function fetchWhy(): Promise<WhyResponse> {
  const res = await fetch(`${API_BASE}/why`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch explanation");
  return res.json();
}

export async function fetchUserStats(): Promise<UserStats> {
  const res = await fetch(`${API_BASE}/user-stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchUsers(): Promise<UserInfo[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

// ── Bookmarks ─────────────────────────────────────────────

export async function addBookmark(article: Article): Promise<void> {
  await fetch(`${API_BASE}/bookmarks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      title: article.title,
      description: article.description,
      url: article.url,
      image_url: article.image_url,
      source: article.source,
      category: article.category,
      published_at: article.published_at,
    }),
  });
}

export async function fetchBookmarks(): Promise<Bookmark[]> {
  const res = await fetch(`${API_BASE}/bookmarks`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch bookmarks");
  return res.json();
}

export async function removeBookmark(id: number): Promise<void> {
  await fetch(`${API_BASE}/bookmarks/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ── Convergence ───────────────────────────────────────────

export async function fetchConvergence(): Promise<ConvergenceData> {
  const res = await fetch(`${API_BASE}/convergence`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch convergence");
  return res.json();
}

// ── WebSocket ─────────────────────────────────────────────

export function connectWebSocket(onMessage: (data: unknown) => void): WebSocket | null {
  const token = getToken();
  if (!token) return null;
  const wsBase = API_BASE.replace("http", "ws");
  const ws = new WebSocket(`${wsBase}/ws?token=${token}`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch { /* ignore */ }
  };
  return ws;
}

// ── Constants ─────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  technology: "#6C8EEF",
  sports: "#4ECDC4",
  business: "#F7B32B",
  entertainment: "#E76F8B",
  health: "#5CBD6A",
  science: "#A77BCA",
  general: "#8E99A4",
};

export const CATEGORY_ICONS: Record<string, string> = {
  technology: "💻",
  sports: "⚽",
  business: "📈",
  entertainment: "🎬",
  health: "🏥",
  science: "🔬",
  general: "📰",
};

export const ALGORITHMS = [
  { id: "thompson_sampling", name: "Thompson Sampling", icon: "🎯" },
  { id: "ucb1", name: "UCB1", icon: "📐" },
  { id: "epsilon_greedy", name: "ε-Greedy", icon: "🎲" },
];
