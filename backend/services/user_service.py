"""
User service — now backed by SQLite persistence.
"""

import time
from services.bandit_engine import bandit_engine, CATEGORIES
from services import database as db


class UserService:
    def __init__(self):
        pass

    async def record_interaction(self, user_id: str, category: str, clicked: bool, time_spent: float,
                                  article_title: str = "", article_url: str = ""):
        await db.record_interaction(user_id, category, clicked, time_spent, article_title, article_url)

    async def get_user_stats(self, user_id: str) -> dict:
        user = await db.get_user_by_id(user_id)
        display_name = user["display_name"] if user else user_id

        stats = await db.get_user_stats_db(user_id)
        interactions = await db.get_interactions(user_id, limit=20)
        preference_scores = await bandit_engine.get_preference_scores(user_id)
        sessions = await db.get_sessions(user_id, limit=30)

        return {
            "user_id": user_id,
            "display_name": display_name,
            "total_clicks": stats["total_clicks"],
            "total_impressions": stats["total_impressions"],
            "ctr": stats["ctr"],
            "category_distribution": stats["category_distribution"],
            "preference_scores": preference_scores,
            "interaction_history": interactions,
            "ctr_over_time": stats["ctr_over_time"],
            "sessions": sessions,
        }

    async def list_users(self) -> list[dict]:
        users = await db.get_all_users()
        return [
            {
                "user_id": u["id"],
                "display_name": u["display_name"],
                "username": u["username"],
                "is_demo": bool(u["is_demo"]),
            }
            for u in users
        ]


# Singleton
user_service = UserService()
