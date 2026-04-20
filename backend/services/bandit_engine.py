"""
Enhanced Contextual Bandit Recommendation Engine.

Supports:
- Thompson Sampling, UCB1, Epsilon-Greedy (A/B testing)
- User embeddings (7-dim exponential moving average)
- Time-based decay factor
- Diversity penalties
- Trending boost (75% user / 25% global)
- Persistence via SQLite
- Convergence snapshots
"""

import numpy as np
from collections import defaultdict
import time
import math

from services import database as db
from services.pretrain import load_pretrained_priors, load_trending_baseline

CATEGORIES = [
    "technology", "sports", "business",
    "entertainment", "health", "science", "general"
]

DECAY_RATE = 0.97  # per day
EMBEDDING_LR = 0.15  # learning rate for embedding updates
USER_WEIGHT = 0.75  # 75% user engagement
TRENDING_WEIGHT = 0.25  # 25% global trending


class BanditEngine:
    def __init__(self):
        self.user_models: dict[str, dict[str, dict[str, float]]] = {}
        self.recent_recs: dict[str, list[str]] = defaultdict(list)
        self.last_recommendation: dict[str, dict] = {}
        self.user_algorithms: dict[str, str] = {}  # user_id -> algorithm
        self._loaded_users: set = set()
        self._pretrained_priors = load_pretrained_priors()
        self._trending_baseline = load_trending_baseline()
        if self._pretrained_priors:
            print("  📊 Pretrained priors loaded (MIND + Outbrain)")
        else:
            print("  ⚠  No pretrained priors — using uniform Beta(1,1)")

    def _get_default_model(self) -> dict[str, dict[str, float]]:
        """Get default model for new users — pretrained or uniform."""
        if self._pretrained_priors:
            return {
                cat: {
                    "alpha": self._pretrained_priors[cat]["alpha"],
                    "beta": self._pretrained_priors[cat]["beta"],
                    "embedding": 0.0,
                    "last_updated": time.time(),
                }
                for cat in CATEGORIES
                if cat in self._pretrained_priors
            }
        return {
            cat: {"alpha": 1.0, "beta": 1.0, "embedding": 0.0, "last_updated": time.time()}
            for cat in CATEGORIES
        }

    async def _ensure_loaded(self, user_id: str):
        """Load user model from DB if not cached."""
        if user_id in self._loaded_users:
            return
        state = await db.load_bandit_state(user_id)
        if state:
            self.user_models[user_id] = {
                cat: {
                    "alpha": state[cat]["alpha"] if cat in state else 1.0,
                    "beta": state[cat]["beta"] if cat in state else 1.0,
                    "embedding": state[cat]["embedding"] if cat in state else 0.0,
                    "last_updated": state[cat]["last_updated"] if cat in state else time.time(),
                }
                for cat in CATEGORIES
            }
        else:
            self.user_models[user_id] = self._get_default_model()
        self._loaded_users.add(user_id)

    def _apply_decay(self, user_id: str):
        """Apply time-based decay to alpha/beta values."""
        model = self.user_models[user_id]
        now = time.time()
        for cat in CATEGORIES:
            days_elapsed = (now - model[cat]["last_updated"]) / 86400
            if days_elapsed > 0.1:  # Only decay if > 2.4 hours
                decay = DECAY_RATE ** days_elapsed
                excess_alpha = model[cat]["alpha"] - 1.0
                excess_beta = model[cat]["beta"] - 1.0
                model[cat]["alpha"] = 1.0 + excess_alpha * decay
                model[cat]["beta"] = 1.0 + excess_beta * decay

    def _thompson_sampling(self, model: dict) -> dict[str, float]:
        """Thompson Sampling: sample from Beta distributions."""
        scores = {}
        for cat in CATEGORIES:
            alpha = model[cat]["alpha"]
            beta_val = model[cat]["beta"]
            # Adjust by embedding
            adj_alpha = alpha * (1.0 + max(0, model[cat]["embedding"]))
            scores[cat] = float(np.random.beta(max(adj_alpha, 0.01), max(beta_val, 0.01)))
        return scores

    def _ucb1(self, model: dict, total_pulls: int) -> dict[str, float]:
        """UCB1: Upper Confidence Bound."""
        scores = {}
        for cat in CATEGORIES:
            alpha = model[cat]["alpha"]
            beta_val = model[cat]["beta"]
            n = alpha + beta_val - 2.0  # number of pulls
            mean = alpha / (alpha + beta_val)
            if n < 1:
                scores[cat] = float("inf")
            else:
                exploration = math.sqrt(2 * math.log(max(total_pulls, 1)) / n)
                scores[cat] = mean + exploration
        return scores

    def _epsilon_greedy(self, model: dict, epsilon: float = 0.2) -> dict[str, float]:
        """Epsilon-Greedy: exploit with 1-epsilon, explore with epsilon."""
        scores = {}
        for cat in CATEGORIES:
            alpha = model[cat]["alpha"]
            beta_val = model[cat]["beta"]
            scores[cat] = alpha / (alpha + beta_val)

        if np.random.random() < epsilon:
            # Explore: add random noise
            for cat in CATEGORIES:
                scores[cat] += np.random.random() * 2
        return scores

    async def recommend(self, user_id: str, algorithm: str = "thompson_sampling") -> str:
        """Select best category using the specified algorithm."""
        await self._ensure_loaded(user_id)
        self._apply_decay(user_id)
        model = self.user_models[user_id]

        # Store algorithm choice
        self.user_algorithms[user_id] = algorithm

        # Get total pulls for UCB1
        total_pulls = sum(model[cat]["alpha"] + model[cat]["beta"] - 2.0 for cat in CATEGORIES)

        # Get raw scores from chosen algorithm
        if algorithm == "ucb1":
            raw_scores = self._ucb1(model, int(total_pulls))
        elif algorithm == "epsilon_greedy":
            raw_scores = self._epsilon_greedy(model)
        else:
            raw_scores = self._thompson_sampling(model)

        # Apply diversity penalty
        recent = self.recent_recs.get(user_id, [])
        diversity_scores = {}
        for cat in CATEGORIES:
            penalty = 0.0
            for i, past_cat in enumerate(reversed(recent[-5:])):
                if past_cat == cat:
                    penalty += 0.15 * (1.0 / (i + 1))
            diversity_scores[cat] = max(0.0, raw_scores[cat] - penalty)

        # Apply hybrid weighting (75% user, 25% trending)
        trending = await db.get_trending()
        total_trending = sum(trending.values()) or 1
        final_scores = {}
        for cat in CATEGORIES:
            trend_share = trending.get(cat, 0) / total_trending
            final_scores[cat] = (USER_WEIGHT * diversity_scores[cat]) + (TRENDING_WEIGHT * trend_share)

        best_category = max(final_scores, key=final_scores.get)

        # Track for diversity
        self.recent_recs[user_id].append(best_category)
        if len(self.recent_recs[user_id]) > 20:
            self.recent_recs[user_id] = self.recent_recs[user_id][-20:]

        # Store for explainability
        self.last_recommendation[user_id] = {
            "category": best_category,
            "algorithm": algorithm,
            "raw_scores": {k: round(v, 4) for k, v in raw_scores.items()},
            "diversity_scores": {k: round(v, 4) for k, v in diversity_scores.items()},
            "final_scores": {k: round(v, 4) for k, v in final_scores.items()},
            "model_params": {
                cat: {
                    "alpha": round(model[cat]["alpha"], 2),
                    "beta": round(model[cat]["beta"], 2),
                    "embedding": round(model[cat]["embedding"], 4),
                }
                for cat in CATEGORIES
            },
            "timestamp": time.time(),
        }

        return best_category

    async def update(self, user_id: str, category: str, clicked: bool, time_spent: float):
        """Update model with user feedback."""
        await self._ensure_loaded(user_id)

        if category not in CATEGORIES:
            return

        reward = (1.0 if clicked else 0.0) + min(time_spent / 30.0, 1.0)

        model = self.user_models[user_id]
        model[category]["alpha"] += reward
        model[category]["beta"] += max(0, 2.0 - reward)
        model[category]["last_updated"] = time.time()

        # Update embedding with exponential moving average
        current_emb = model[category]["embedding"]
        target = (reward / 2.0) - 0.5  # normalize to [-0.5, 0.5]
        model[category]["embedding"] = current_emb + EMBEDDING_LR * (target - current_emb)

        # Persist to DB
        await db.save_bandit_state(
            user_id, category,
            model[category]["alpha"],
            model[category]["beta"],
            model[category]["embedding"],
        )

        # Update global trending
        if clicked:
            await db.update_trending(category)

        # Save convergence snapshot every 3 updates
        total = sum(model[cat]["alpha"] + model[cat]["beta"] - 2.0 for cat in CATEGORIES)
        if int(total) % 3 == 0:
            snapshot = {
                cat: {"alpha": round(model[cat]["alpha"], 3), "beta": round(model[cat]["beta"], 3)}
                for cat in CATEGORIES
            }
            await db.save_bandit_snapshot(user_id, snapshot)

    async def get_explanation(self, user_id: str) -> dict:
        """Generate human-readable explanation."""
        await self._ensure_loaded(user_id)
        rec = self.last_recommendation.get(user_id)
        if not rec:
            return {
                "category": "general",
                "explanation": "No recommendations yet. Showing general news.",
                "category_scores": {cat: 0.5 for cat in CATEGORIES},
                "factors": ["New user — exploring all categories"],
            }

        category = rec["category"]
        model = rec["model_params"]
        scores = rec["final_scores"]
        algorithm = rec.get("algorithm", "thompson_sampling")

        factors = []

        # Algorithm info
        algo_names = {
            "thompson_sampling": "Thompson Sampling",
            "ucb1": "UCB1 (Upper Confidence Bound)",
            "epsilon_greedy": "Epsilon-Greedy",
        }
        factors.append(f"Using {algo_names.get(algorithm, algorithm)} algorithm")

        # Preference strength
        alpha = model[category]["alpha"]
        beta_val = model[category]["beta"]
        strength = alpha / (alpha + beta_val)
        if strength > 0.6:
            factors.append(f"Strong interest in {category} ({strength:.0%} confidence)")
        elif strength > 0.4:
            factors.append(f"Moderate interest in {category} ({strength:.0%} confidence)")
        else:
            factors.append(f"Exploring {category} to learn preferences")

        # Embedding info
        emb = model[category].get("embedding", 0)
        if emb > 0.1:
            factors.append(f"Positive engagement trend in {category}")
        elif emb < -0.1:
            factors.append(f"Declining engagement in {category} — trying to re-engage")

        # Diversity
        recent = self.recent_recs.get(user_id, [])
        if category not in recent[-3:]:
            factors.append("Adding variety to your feed")

        # Trending
        trending = await db.get_trending()
        total_trending = sum(trending.values()) or 1
        click_share = trending.get(category, 0) / total_trending
        if click_share > 0.2:
            factors.append(f"{category.title()} is trending ({click_share:.0%} of global clicks)")

        # Cold start
        total_interactions = sum(model[c]["alpha"] + model[c]["beta"] - 2.0 for c in CATEGORIES)
        if total_interactions < 5:
            factors.append("Still learning — recommendations improve with interaction")

        return {
            "category": category,
            "explanation": f"Recommended {category}: {'; '.join(factors)}",
            "category_scores": scores,
            "factors": factors,
        }

    async def get_preference_scores(self, user_id: str) -> dict[str, float]:
        await self._ensure_loaded(user_id)
        model = self.user_models[user_id]
        return {
            cat: round(model[cat]["alpha"] / (model[cat]["alpha"] + model[cat]["beta"]), 4)
            for cat in CATEGORIES
        }

    async def get_convergence_data(self, user_id: str) -> list[dict]:
        return await db.get_bandit_snapshots(user_id, limit=100)


# Singleton
bandit_engine = BanditEngine()
