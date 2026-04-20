"""
NLP Service for article clustering and similarity.
Uses TF-IDF vectorization and cosine similarity.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


class NLPService:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=500,
            stop_words="english",
            ngram_range=(1, 2),
        )
        self._fitted = False

    def compute_similarity(self, articles: list[dict]) -> np.ndarray:
        """Compute pairwise cosine similarity between articles."""
        if not articles:
            return np.array([])

        texts = [
            f"{a.get('title', '')} {a.get('description', '')}"
            for a in articles
        ]

        try:
            if not self._fitted:
                tfidf_matrix = self.vectorizer.fit_transform(texts)
                self._fitted = True
            else:
                tfidf_matrix = self.vectorizer.transform(texts)
        except Exception:
            # Fallback: refit
            tfidf_matrix = self.vectorizer.fit_transform(texts)
            self._fitted = True

        return cosine_similarity(tfidf_matrix)

    def diversify_articles(self, articles: list[dict], max_similarity: float = 0.7) -> list[dict]:
        """Remove articles that are too similar to already selected ones."""
        if len(articles) <= 1:
            return articles

        try:
            sim_matrix = self.compute_similarity(articles)
        except Exception:
            return articles

        selected_indices = [0]  # Always keep the first article
        for i in range(1, len(articles)):
            max_sim_to_selected = max(sim_matrix[i][j] for j in selected_indices)
            if max_sim_to_selected < max_similarity:
                selected_indices.append(i)

        return [articles[i] for i in selected_indices]

    def cluster_articles(self, articles: list[dict], n_clusters: int = 3) -> dict[int, list[dict]]:
        """Group articles into clusters based on content similarity."""
        if len(articles) < n_clusters:
            return {0: articles}

        try:
            sim_matrix = self.compute_similarity(articles)
        except Exception:
            return {0: articles}

        # Simple greedy clustering
        clusters: dict[int, list[int]] = {}
        assigned = set()

        for cluster_id in range(min(n_clusters, len(articles))):
            if cluster_id == 0:
                seed = 0
            else:
                # Find the article most dissimilar to existing clusters
                max_dissim = -1
                seed = 0
                for i in range(len(articles)):
                    if i in assigned:
                        continue
                    min_sim = min(
                        sim_matrix[i][j]
                        for cid in clusters
                        for j in clusters[cid]
                    ) if clusters else 1.0
                    if min_sim > max_dissim or max_dissim == -1:
                        max_dissim = min_sim
                        seed = i

            clusters[cluster_id] = [seed]
            assigned.add(seed)

        # Assign remaining articles to nearest cluster
        for i in range(len(articles)):
            if i in assigned:
                continue
            best_cluster = 0
            best_sim = -1
            for cid, members in clusters.items():
                avg_sim = np.mean([sim_matrix[i][j] for j in members])
                if avg_sim > best_sim:
                    best_sim = avg_sim
                    best_cluster = cid
            clusters[best_cluster].append(i)
            assigned.add(i)

        return {
            cid: [articles[i] for i in indices]
            for cid, indices in clusters.items()
        }

    def search_articles(self, articles: list[dict], query: str) -> list[dict]:
        """Search articles by query using TF-IDF similarity."""
        if not query.strip() or not articles:
            return articles

        texts = [f"{a.get('title', '')} {a.get('description', '')}" for a in articles]
        texts.append(query)

        try:
            tfidf_matrix = TfidfVectorizer(
                max_features=300, stop_words="english"
            ).fit_transform(texts)
        except Exception:
            # Fallback: simple text matching
            query_lower = query.lower()
            return [
                a for a in articles
                if query_lower in a.get("title", "").lower() or query_lower in a.get("description", "").lower()
            ]

        query_vec = tfidf_matrix[-1]
        article_vecs = tfidf_matrix[:-1]
        similarities = cosine_similarity(query_vec, article_vecs).flatten()

        # Return articles with similarity > threshold, sorted by relevance
        scored = [(articles[i], similarities[i]) for i in range(len(articles)) if similarities[i] > 0.05]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [a for a, _ in scored] if scored else articles


# Singleton
nlp_service = NLPService()
