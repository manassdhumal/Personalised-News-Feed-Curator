from pydantic import BaseModel
from typing import Optional


class FeedbackRequest(BaseModel):
    category: str
    article_title: str = ""
    article_url: str = ""
    clicked: bool = False
    time_spent: float = 0.0


class ArticleResponse(BaseModel):
    title: str
    description: str
    url: str
    image_url: Optional[str] = None
    source: str
    category: str
    published_at: str = ""


class FeedResponse(BaseModel):
    articles: list[ArticleResponse]
    recommended_category: str
    mode: str
    user_id: str
    algorithm: str = "thompson_sampling"


class WhyResponse(BaseModel):
    user_id: str
    recommended_category: str
    explanation: str
    category_scores: dict[str, float]
    factors: list[str]


class UserStatsResponse(BaseModel):
    user_id: str
    display_name: str
    total_clicks: int
    total_impressions: int
    ctr: float
    category_distribution: dict[str, int]
    preference_scores: dict[str, float]
    interaction_history: list[dict]
    ctr_over_time: list[dict]
    sessions: list[dict] = []


class UserInfo(BaseModel):
    user_id: str
    display_name: str
    username: str = ""
    is_demo: bool = False


# Auth models
class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    token: str


# Bookmark models
class BookmarkRequest(BaseModel):
    title: str
    description: str = ""
    url: str
    image_url: Optional[str] = None
    source: str = ""
    category: str = ""
    published_at: str = ""


class BookmarkResponse(BaseModel):
    id: int
    title: str
    description: str
    url: str
    image_url: Optional[str] = None
    source: str
    category: str
    published_at: str
    created_at: float


# Search model
class SearchQuery(BaseModel):
    query: str = ""
    categories: list[str] = []


# A/B Testing
class ABTestConfig(BaseModel):
    algorithm: str = "thompson_sampling"  # "thompson_sampling", "ucb1", "epsilon_greedy"


# Convergence snapshot
class BanditSnapshotResponse(BaseModel):
    snapshots: list[dict]
    categories: list[str]
