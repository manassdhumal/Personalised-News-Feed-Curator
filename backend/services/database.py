"""
SQLite database layer with async support.
Tables: users, interactions, bookmarks, bandit_state, bandit_snapshots, global_trending
"""

import aiosqlite
import os
import json
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "newscurator.db")


async def get_db() -> aiosqlite.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    """Create all tables if they don't exist."""
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                hashed_password TEXT NOT NULL,
                is_demo INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id),
                category TEXT NOT NULL,
                article_title TEXT DEFAULT '',
                article_url TEXT DEFAULT '',
                clicked INTEGER DEFAULT 0,
                time_spent REAL DEFAULT 0,
                timestamp REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id),
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                url TEXT NOT NULL,
                image_url TEXT,
                source TEXT DEFAULT '',
                category TEXT DEFAULT '',
                published_at TEXT DEFAULT '',
                created_at REAL NOT NULL,
                UNIQUE(user_id, url)
            );

            CREATE TABLE IF NOT EXISTS bandit_state (
                user_id TEXT NOT NULL REFERENCES users(id),
                category TEXT NOT NULL,
                alpha REAL DEFAULT 1.0,
                beta_val REAL DEFAULT 1.0,
                embedding REAL DEFAULT 0.0,
                last_updated REAL NOT NULL,
                PRIMARY KEY (user_id, category)
            );

            CREATE TABLE IF NOT EXISTS bandit_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id),
                snapshot_data TEXT NOT NULL,
                timestamp REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS global_trending (
                category TEXT PRIMARY KEY,
                click_count INTEGER DEFAULT 0,
                last_updated REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id),
                started_at REAL NOT NULL,
                ended_at REAL,
                interactions_count INTEGER DEFAULT 0,
                clicks_count INTEGER DEFAULT 0,
                categories_explored TEXT DEFAULT '[]'
            );

            CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_interactions_time ON interactions(timestamp);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
            CREATE INDEX IF NOT EXISTS idx_snapshots_user ON bandit_snapshots(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        """)
        await db.commit()
    finally:
        await db.close()


# ── User CRUD ──────────────────────────────────────────────

async def create_user(user_id: str, username: str, display_name: str, hashed_password: str, is_demo: bool = False):
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO users (id, username, display_name, hashed_password, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, username, display_name, hashed_password, int(is_demo), time.time()),
        )
        await db.commit()
    finally:
        await db.close()


async def get_user_by_username(username: str) -> dict | None:
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM users WHERE username = ?", (username,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None
    finally:
        await db.close()


async def get_user_by_id(user_id: str) -> dict | None:
    db = await get_db()
    try:
        async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None
    finally:
        await db.close()


async def get_all_users() -> list[dict]:
    db = await get_db()
    try:
        async with db.execute("SELECT id, username, display_name, is_demo, created_at FROM users ORDER BY created_at") as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]
    finally:
        await db.close()


# ── Bandit State ───────────────────────────────────────────

async def save_bandit_state(user_id: str, category: str, alpha: float, beta_val: float, embedding: float = 0.0):
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO bandit_state (user_id, category, alpha, beta_val, embedding, last_updated)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, category) DO UPDATE SET alpha=?, beta_val=?, embedding=?, last_updated=?""",
            (user_id, category, alpha, beta_val, embedding, time.time(), alpha, beta_val, embedding, time.time()),
        )
        await db.commit()
    finally:
        await db.close()


async def load_bandit_state(user_id: str) -> dict[str, dict]:
    db = await get_db()
    try:
        async with db.execute("SELECT category, alpha, beta_val, embedding, last_updated FROM bandit_state WHERE user_id = ?", (user_id,)) as cur:
            rows = await cur.fetchall()
            return {
                row["category"]: {
                    "alpha": row["alpha"],
                    "beta": row["beta_val"],
                    "embedding": row["embedding"],
                    "last_updated": row["last_updated"],
                }
                for row in rows
            }
    finally:
        await db.close()


async def save_bandit_snapshot(user_id: str, snapshot: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO bandit_snapshots (user_id, snapshot_data, timestamp) VALUES (?, ?, ?)",
            (user_id, json.dumps(snapshot), time.time()),
        )
        await db.commit()
    finally:
        await db.close()


async def get_bandit_snapshots(user_id: str, limit: int = 100) -> list[dict]:
    db = await get_db()
    try:
        async with db.execute(
            "SELECT snapshot_data, timestamp FROM bandit_snapshots WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
            (user_id, limit),
        ) as cur:
            rows = await cur.fetchall()
            return [{"data": json.loads(row["snapshot_data"]), "timestamp": row["timestamp"]} for row in reversed(rows)]
    finally:
        await db.close()


# ── Interactions ───────────────────────────────────────────

async def record_interaction(user_id: str, category: str, clicked: bool, time_spent: float, article_title: str = "", article_url: str = ""):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO interactions (user_id, category, article_title, article_url, clicked, time_spent, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, category, article_title, article_url, int(clicked), time_spent, time.time()),
        )
        await db.commit()
    finally:
        await db.close()


async def get_seen_article_urls(user_id: str) -> set[str]:
    """Return all article URLs this user has already been served (to prevent repeats)."""
    db = await get_db()
    try:
        async with db.execute(
            "SELECT DISTINCT article_url FROM interactions WHERE user_id = ? AND article_url != ''",
            (user_id,),
        ) as cur:
            rows = await cur.fetchall()
            return {row["article_url"] for row in rows}
    finally:
        await db.close()


async def get_interactions(user_id: str, limit: int = 50) -> list[dict]:
    db = await get_db()
    try:
        async with db.execute(
            "SELECT category, article_title, clicked, time_spent, timestamp FROM interactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
            (user_id, limit),
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in reversed(rows)]
    finally:
        await db.close()


async def get_user_stats_db(user_id: str) -> dict:
    db = await get_db()
    try:
        # Total impressions and clicks
        async with db.execute("SELECT COUNT(*) as total FROM interactions WHERE user_id = ?", (user_id,)) as cur:
            total = (await cur.fetchone())["total"]
        async with db.execute("SELECT COUNT(*) as clicks FROM interactions WHERE user_id = ? AND clicked = 1", (user_id,)) as cur:
            clicks = (await cur.fetchone())["clicks"]

        # Category distribution (clicks only)
        async with db.execute(
            "SELECT category, COUNT(*) as cnt FROM interactions WHERE user_id = ? AND clicked = 1 GROUP BY category",
            (user_id,),
        ) as cur:
            cat_dist = {row["category"]: row["cnt"] for row in await cur.fetchall()}

        # CTR over time (every 5 impressions)
        async with db.execute(
            "SELECT clicked, timestamp FROM interactions WHERE user_id = ? ORDER BY timestamp", (user_id,)
        ) as cur:
            rows = await cur.fetchall()
            ctr_over_time = []
            running_clicks = 0
            for i, row in enumerate(rows, 1):
                running_clicks += row["clicked"]
                if i % 5 == 0:
                    ctr_over_time.append({"impressions": i, "ctr": round(running_clicks / i, 4), "timestamp": row["timestamp"]})

        return {
            "total_impressions": total,
            "total_clicks": clicks,
            "ctr": round(clicks / max(total, 1), 4),
            "category_distribution": cat_dist,
            "ctr_over_time": ctr_over_time,
        }
    finally:
        await db.close()


# ── Bookmarks ──────────────────────────────────────────────

async def add_bookmark(user_id: str, title: str, description: str, url: str, image_url: str | None, source: str, category: str, published_at: str) -> int:
    db = await get_db()
    try:
        cursor = await db.execute(
            """INSERT OR IGNORE INTO bookmarks (user_id, title, description, url, image_url, source, category, published_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, title, description, url, image_url, source, category, published_at, time.time()),
        )
        await db.commit()
        return cursor.lastrowid
    finally:
        await db.close()


async def get_bookmarks(user_id: str) -> list[dict]:
    db = await get_db()
    try:
        async with db.execute(
            "SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]
    finally:
        await db.close()


async def remove_bookmark(user_id: str, bookmark_id: int) -> bool:
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM bookmarks WHERE id = ? AND user_id = ?", (bookmark_id, user_id))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


# ── Global Trending ────────────────────────────────────────

async def update_trending(category: str):
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO global_trending (category, click_count, last_updated) VALUES (?, 1, ?)
               ON CONFLICT(category) DO UPDATE SET click_count = click_count + 1, last_updated = ?""",
            (category, time.time(), time.time()),
        )
        await db.commit()
    finally:
        await db.close()


async def get_trending() -> dict[str, int]:
    db = await get_db()
    try:
        async with db.execute("SELECT category, click_count FROM global_trending") as cur:
            return {row["category"]: row["click_count"] for row in await cur.fetchall()}
    finally:
        await db.close()


# ── Sessions ──────────────────────────────────────────────

async def create_session(user_id: str) -> int:
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO sessions (user_id, started_at) VALUES (?, ?)", (user_id, time.time())
        )
        await db.commit()
        return cursor.lastrowid
    finally:
        await db.close()


async def update_session(session_id: int, interactions_count: int, clicks_count: int, categories: list[str]):
    db = await get_db()
    try:
        await db.execute(
            "UPDATE sessions SET ended_at = ?, interactions_count = ?, clicks_count = ?, categories_explored = ? WHERE id = ?",
            (time.time(), interactions_count, clicks_count, json.dumps(categories), session_id),
        )
        await db.commit()
    finally:
        await db.close()


async def get_sessions(user_id: str, limit: int = 30) -> list[dict]:
    db = await get_db()
    try:
        async with db.execute(
            "SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?", (user_id, limit)
        ) as cur:
            rows = await cur.fetchall()
            result = []
            for row in reversed(rows):
                d = dict(row)
                d["categories_explored"] = json.loads(d["categories_explored"]) if d["categories_explored"] else []
                result.append(d)
            return result
    finally:
        await db.close()
