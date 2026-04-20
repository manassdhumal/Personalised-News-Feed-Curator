"""
News article fetching service.

Fetches from NewsAPI when an API key is available.
Falls back to generated mock articles otherwise.
"""

import httpx
import os
import random
import time
from datetime import datetime

NEWS_API_BASE = "https://newsapi.org/v2"

MOCK_ARTICLES = {
    "technology": [
        {"title": "AI Breakthrough: New Model Achieves Human-Level Reasoning", "description": "Researchers unveil a groundbreaking AI system that demonstrates unprecedented reasoning capabilities across multiple domains.", "source": "TechCrunch"},
        {"title": "Quantum Computing Milestone: 1000-Qubit Processor Announced", "description": "A major tech company announces a quantum processor that could revolutionize drug discovery and cryptography.", "source": "Wired"},
        {"title": "The Rise of Edge Computing in IoT Applications", "description": "How edge computing is transforming real-time data processing in smart cities and autonomous vehicles.", "source": "The Verge"},
        {"title": "Open Source LLMs Challenge Big Tech Dominance", "description": "Community-driven large language models are closing the gap with proprietary systems from major corporations.", "source": "Ars Technica"},
        {"title": "Cybersecurity in 2026: Zero Trust Architecture Goes Mainstream", "description": "Organizations worldwide adopt zero trust frameworks as cyber threats become increasingly sophisticated.", "source": "ZDNet"},
    ],
    "sports": [
        {"title": "Champions League Semifinal Produces Stunning Upset", "description": "An underdog club defeats the tournament favorites in a dramatic penalty shootout to advance to the final.", "source": "ESPN"},
        {"title": "Olympic Athlete Breaks 20-Year World Record", "description": "A remarkable performance at the Diamond League event rewrites history in the 400m hurdles.", "source": "BBC Sport"},
        {"title": "NBA Playoff Race Heats Up in Final Week", "description": "Multiple teams vie for the last playoff spots as the regular season draws to a close.", "source": "Sports Illustrated"},
        {"title": "Formula 1: New Regulations Promise Closer Racing", "description": "Technical changes for the upcoming season aim to reduce the performance gap between top and midfield teams.", "source": "Autosport"},
        {"title": "Tennis Star Announces Comeback After Injury", "description": "A former world number one announces their return to competitive tennis after a year-long rehabilitation.", "source": "ATP Tour"},
    ],
    "business": [
        {"title": "Federal Reserve Signals Cautious Approach to Rate Cuts", "description": "The central bank indicates it will take a measured approach to monetary policy amid mixed economic signals.", "source": "Bloomberg"},
        {"title": "Startup Unicorn Raises $2B at Record Valuation", "description": "An AI-powered logistics company achieves the highest valuation for a Series D round this year.", "source": "Forbes"},
        {"title": "Global Supply Chain Resilience Improves Post-Pandemic", "description": "New data shows companies have successfully diversified their supply chains, reducing single-point-of-failure risks.", "source": "Financial Times"},
        {"title": "Remote Work Revolution: Companies Adopt Hybrid Models", "description": "A major survey reveals that 70% of Fortune 500 companies now offer permanent hybrid work arrangements.", "source": "Wall Street Journal"},
        {"title": "Cryptocurrency Markets Rally on Regulatory Clarity", "description": "Digital asset prices surge as major economies establish clearer regulatory frameworks for crypto trading.", "source": "Reuters"},
    ],
    "entertainment": [
        {"title": "Anticipated Sequel Breaks Opening Weekend Box Office Records", "description": "The latest installment in the beloved franchise earns $350M globally in its debut weekend.", "source": "Variety"},
        {"title": "Streaming Wars: New Platform Launches with Exclusive Content", "description": "A new streaming service debuts with an impressive slate of original series and exclusive film deals.", "source": "Hollywood Reporter"},
        {"title": "Grammy Awards: Breakthrough Artist Dominates with Five Wins", "description": "An independent musician makes history by sweeping multiple categories at the annual ceremony.", "source": "Billboard"},
        {"title": "Video Game of the Year Sells 20 Million Copies in First Month", "description": "The highly anticipated RPG surpasses all sales expectations and receives universal critical acclaim.", "source": "IGN"},
        {"title": "Iconic Band Announces Reunion Tour After 15 Years", "description": "Fans around the world celebrate as the legendary group confirms a world tour spanning 50 cities.", "source": "Rolling Stone"},
    ],
    "health": [
        {"title": "New mRNA Vaccine Shows Promise Against Multiple Cancer Types", "description": "Clinical trials reveal encouraging results for a personalized cancer vaccine approach using mRNA technology.", "source": "Nature Medicine"},
        {"title": "Mental Health Apps Prove Effective in Large-Scale Study", "description": "Researchers find that AI-powered mental health applications significantly reduce anxiety and depression symptoms.", "source": "WebMD"},
        {"title": "Breakthrough in Alzheimer's Treatment Shows Cognitive Improvement", "description": "A new drug demonstrates the ability to slow and partially reverse cognitive decline in early-stage patients.", "source": "Medical News Today"},
        {"title": "Global Initiative to Reduce Antibiotic Resistance Gains Momentum", "description": "Over 100 countries commit to new protocols for responsible antibiotic use in healthcare and agriculture.", "source": "WHO"},
        {"title": "Wearable Health Monitors Achieve Medical-Grade Accuracy", "description": "Next-generation smartwatches can now detect atrial fibrillation and blood oxygen levels with clinical precision.", "source": "CNET Health"},
    ],
    "science": [
        {"title": "Mars Sample Return Mission Reveals Ancient Microbial Signatures", "description": "Analysis of Martian soil samples brought back to Earth suggests the planet once harbored microscopic life.", "source": "NASA"},
        {"title": "CRISPR Gene Editing Used to Cure Genetic Blood Disorder", "description": "A patient with sickle cell disease is declared cured after receiving a one-time CRISPR-based treatment.", "source": "Science"},
        {"title": "Deep Ocean Exploration Discovers New Species Ecosystem", "description": "A submersible mission to the Mariana Trench reveals a thriving ecosystem of previously unknown organisms.", "source": "National Geographic"},
        {"title": "Nuclear Fusion Experiment Achieves Net Energy Gain for Extended Period", "description": "Scientists sustain a fusion reaction that produces more energy than consumed for over 30 minutes.", "source": "New Scientist"},
        {"title": "James Webb Telescope Captures Most Distant Galaxy Ever Observed", "description": "The space telescope detects a galaxy formed just 300 million years after the Big Bang.", "source": "Space.com"},
    ],
    "general": [
        {"title": "Global Climate Summit Reaches Historic Carbon Reduction Agreement", "description": "World leaders commit to unprecedented emissions targets with binding enforcement mechanisms.", "source": "Associated Press"},
        {"title": "Education Revolution: AI Tutoring Systems Transform Learning", "description": "Schools worldwide report significant improvements in student outcomes using personalized AI tutoring.", "source": "The Guardian"},
        {"title": "Major Infrastructure Bill Passes with Bipartisan Support", "description": "A comprehensive infrastructure package allocates billions for transportation, broadband, and clean energy.", "source": "NPR"},
        {"title": "Cultural Heritage Sites Restored Using 3D Printing Technology", "description": "Innovative restoration projects use advanced manufacturing to rebuild damaged historical monuments.", "source": "Smithsonian"},
        {"title": "Community-Led Urban Farming Initiative Feeds Thousands", "description": "A grassroots urban agriculture project transforms vacant lots into productive farms in major cities.", "source": "BBC News"},
    ],
}


class NewsService:
    def __init__(self):
        self.api_key = os.getenv("NEWS_API_KEY", "").strip()
        self._cache: dict[str, dict] = {}  # category -> {articles, timestamp}
        self._cache_ttl = 600  # 10 minutes

    async def fetch_articles(self, category: str, count: int = 10) -> list[dict]:
        """Fetch articles for a category. Uses NewsAPI if available, otherwise mock data."""
        if self.api_key:
            cached = self._cache.get(category)
            if cached and (time.time() - cached["timestamp"]) < self._cache_ttl:
                return cached["articles"][:count]

            try:
                articles = await self._fetch_from_api(category, count)
                if articles:
                    self._cache[category] = {"articles": articles, "timestamp": time.time()}
                    return articles
            except Exception:
                pass

        # Fallback to mock data
        return self._get_mock_articles(category, count)

    async def _fetch_from_api(self, category: str, count: int) -> list[dict]:
        """Fetch from NewsAPI."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{NEWS_API_BASE}/top-headlines",
                params={
                    "category": category,
                    "language": "en",
                    "pageSize": count,
                    "apiKey": self.api_key,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()

            return [
                {
                    "title": art.get("title", ""),
                    "description": art.get("description", "") or "",
                    "url": art.get("url", "#"),
                    "image_url": art.get("urlToImage"),
                    "source": art.get("source", {}).get("name", "Unknown"),
                    "category": category,
                    "published_at": art.get("publishedAt", ""),
                }
                for art in data.get("articles", [])
                if art.get("title") and "[Removed]" not in art.get("title", "")
            ]

    def _get_mock_articles(self, category: str, count: int) -> list[dict]:
        """Generate mock articles from predefined data."""
        templates = MOCK_ARTICLES.get(category, MOCK_ARTICLES["general"])
        articles = []
        for tmpl in templates[:count]:
            articles.append({
                "title": tmpl["title"],
                "description": tmpl["description"],
                "url": f"https://example.com/news/{category}/{hash(tmpl['title']) % 10000}",
                "image_url": None,
                "source": tmpl["source"],
                "category": category,
                "published_at": datetime.now().isoformat(),
            })
        # Shuffle for variety
        random.shuffle(articles)
        return articles


# Singleton instance
news_service = NewsService()
