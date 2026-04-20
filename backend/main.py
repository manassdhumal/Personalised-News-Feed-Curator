"""
FastAPI Application — AI-Powered Personalized News Feed Curator
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from routers.api import router
from services.database import init_db
from services.auth import seed_demo_accounts
from services.pretrain import run_pretraining, load_pretrained_priors

app = FastAPI(
    title="Personalized News Feed Curator",
    description="AI-powered news recommendations using Contextual Bandits with persistence",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup():
    # Initialize database
    await init_db()
    print("✅ Database initialized")

    # Seed demo accounts
    await seed_demo_accounts()
    print("✅ Demo accounts seeded")

    # Run pretraining if not already done
    priors = load_pretrained_priors()
    if not priors:
        print("🧠 No pretrained priors found — running pretraining pipeline...")
        await run_pretraining()
    else:
        print("✅ Pretrained priors loaded from datasets")

    api_key = os.getenv("NEWS_API_KEY", "").strip()
    if api_key:
        print("✅ NewsAPI key detected")
    else:
        print("⚠️  No NewsAPI key — using mock article data")


@app.get("/")
async def root():
    return {"message": "Personalized News Feed Curator API v2", "docs": "/docs"}
