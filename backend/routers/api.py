"""
API Router — all endpoints with JWT auth protection.
"""

from fastapi import APIRouter, Query, Depends, WebSocket, WebSocketDisconnect
from models import (
    FeedbackRequest, ArticleResponse, FeedResponse,
    WhyResponse, UserStatsResponse, UserInfo,
    RegisterRequest, LoginRequest, TokenResponse,
    BookmarkRequest, BookmarkResponse,
    BanditSnapshotResponse,
)
from services.bandit_engine import bandit_engine, CATEGORIES
from services.user_service import user_service
from services.news_service import news_service
from services.nlp_service import nlp_service
from services.websocket import ws_manager
from services.auth import (
    register, login, get_current_user, get_optional_user, decode_token,
)
from services import database as db
from services.database import get_seen_article_urls
import random

router = APIRouter()


# ── Auth Endpoints ─────────────────────────────────────────

@router.post("/auth/register", response_model=TokenResponse)
async def auth_register(req: RegisterRequest):
    result = await register(req.username, req.password, req.display_name)
    return TokenResponse(**result)


@router.post("/auth/login", response_model=TokenResponse)
async def auth_login(req: LoginRequest):
    result = await login(req.username, req.password)
    return TokenResponse(**result)


@router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return {
        "user_id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"],
        "is_demo": bool(user["is_demo"]),
    }


# ── Feed Endpoint ─────────────────────────────────────────

@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    mode: str = Query(default="ai"),
    count: int = Query(default=12, ge=1, le=30),
    algorithm: str = Query(default="thompson_sampling"),
    search: str = Query(default=""),
    categories: str = Query(default=""),  # comma-separated
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    filter_cats = [c.strip() for c in categories.split(",") if c.strip()] if categories else []

    # Fetch URLs this user has already seen so we can exclude them
    seen_urls = await get_seen_article_urls(user_id)

    def _unseen(articles: list[dict]) -> list[dict]:
        """Filter out articles the user has already been served."""
        return [a for a in articles if a.get("url", "") not in seen_urls]

    if mode == "ai":
        recommended_category = await bandit_engine.recommend(user_id, algorithm)
        primary_count = max(1, int(count * 0.6))
        secondary_count = count - primary_count

        # Fetch a larger pool so there's headroom after deduplication
        primary_pool = await news_service.fetch_articles(recommended_category, primary_count * 4)
        primary_articles = _unseen(primary_pool)[:primary_count]

        other_categories = [c for c in CATEGORIES if c != recommended_category]
        secondary_articles = []
        secondary_picks = random.sample(other_categories, min(3, len(other_categories))) if other_categories else []
        if secondary_count > 0 and secondary_picks:
            per_cat = max(1, secondary_count // len(secondary_picks))
            for cat in secondary_picks:
                arts = await news_service.fetch_articles(cat, per_cat * 4)
                secondary_articles.extend(_unseen(arts))
            secondary_articles = secondary_articles[:secondary_count]

        all_articles = primary_articles + secondary_articles

        # Graceful fallback: if deduplication left nothing, serve raw pool without dedup
        if not all_articles:
            all_articles = list(primary_pool)
            for cat in secondary_picks:
                arts = await news_service.fetch_articles(cat, max(1, secondary_count // max(len(secondary_picks), 1)))
                all_articles.extend(arts)
    else:
        recommended_category = "mixed"
        all_articles = []
        cats_to_fetch = filter_cats if filter_cats else CATEGORIES
        per_cat = max(1, count // len(cats_to_fetch))
        for cat in cats_to_fetch:
            arts = await news_service.fetch_articles(cat, per_cat * 4)
            all_articles.extend(_unseen(arts))
        # Fallback if all articles seen
        if not all_articles:
            for cat in cats_to_fetch:
                arts = await news_service.fetch_articles(cat, per_cat)
                all_articles.extend(arts)

    # Apply NLP diversity filtering
    all_articles = nlp_service.diversify_articles(all_articles, max_similarity=0.75)

    # Apply search filter
    if search.strip():
        all_articles = nlp_service.search_articles(all_articles, search)

    # Apply category filter
    if filter_cats:
        all_articles = [a for a in all_articles if a.get("category") in filter_cats]

    random.shuffle(all_articles)
    all_articles = all_articles[:count]

    articles = [
        ArticleResponse(
            title=a["title"],
            description=a["description"],
            url=a["url"],
            image_url=a.get("image_url"),
            source=a["source"],
            category=a["category"],
            published_at=a.get("published_at", ""),
        )
        for a in all_articles
    ]

    return FeedResponse(
        articles=articles,
        recommended_category=recommended_category,
        mode=mode,
        user_id=user_id,
        algorithm=algorithm,
    )


# ── Feedback Endpoint ─────────────────────────────────────

@router.post("/feedback")
async def post_feedback(feedback: FeedbackRequest, user: dict = Depends(get_current_user)):
    user_id = user["id"]

    await bandit_engine.update(
        user_id=user_id,
        category=feedback.category,
        clicked=feedback.clicked,
        time_spent=feedback.time_spent,
    )

    await user_service.record_interaction(
        user_id=user_id,
        category=feedback.category,
        clicked=feedback.clicked,
        time_spent=feedback.time_spent,
        article_title=feedback.article_title,
        article_url=feedback.article_url,
    )

    # Push update via WebSocket
    await ws_manager.send_to_user(user_id, {
        "type": "feedback_recorded",
        "category": feedback.category,
        "clicked": feedback.clicked,
    })

    return {"status": "ok", "message": "Feedback recorded"}


# ── Why Endpoint ───────────────────────────────────────────

@router.get("/why", response_model=WhyResponse)
async def get_why(user: dict = Depends(get_current_user)):
    explanation = await bandit_engine.get_explanation(user["id"])
    return WhyResponse(
        user_id=user["id"],
        recommended_category=explanation["category"],
        explanation=explanation["explanation"],
        category_scores=explanation["category_scores"],
        factors=explanation["factors"],
    )


# ── User Stats ─────────────────────────────────────────────

@router.get("/user-stats", response_model=UserStatsResponse)
async def get_user_stats(user: dict = Depends(get_current_user)):
    stats = await user_service.get_user_stats(user["id"])
    return UserStatsResponse(**stats)


@router.get("/users", response_model=list[UserInfo])
async def list_users():
    users = await user_service.list_users()
    return [UserInfo(**u) for u in users]


# ── Bookmarks ──────────────────────────────────────────────

@router.post("/bookmarks", response_model=dict)
async def add_bookmark(req: BookmarkRequest, user: dict = Depends(get_current_user)):
    bookmark_id = await db.add_bookmark(
        user_id=user["id"],
        title=req.title,
        description=req.description,
        url=req.url,
        image_url=req.image_url,
        source=req.source,
        category=req.category,
        published_at=req.published_at,
    )
    return {"status": "ok", "id": bookmark_id}


@router.get("/bookmarks", response_model=list[BookmarkResponse])
async def get_bookmarks(user: dict = Depends(get_current_user)):
    bookmarks = await db.get_bookmarks(user["id"])
    return [BookmarkResponse(**b) for b in bookmarks]


@router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: int, user: dict = Depends(get_current_user)):
    success = await db.remove_bookmark(user["id"], bookmark_id)
    if not success:
        return {"status": "error", "message": "Bookmark not found"}
    return {"status": "ok"}


# ── Convergence Data ───────────────────────────────────────

@router.get("/convergence", response_model=BanditSnapshotResponse)
async def get_convergence(user: dict = Depends(get_current_user)):
    snapshots = await bandit_engine.get_convergence_data(user["id"])
    return BanditSnapshotResponse(snapshots=snapshots, categories=CATEGORIES)


# ── WebSocket ──────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    payload = decode_token(token) if token else None
    user_id = payload["sub"] if payload else "anonymous"

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Keep connection alive — handle ping/pong
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
