"""
scraper.py — RSS ingestion, normalization, and full-body extraction.

Feeds used:
  1. BBC News Top Stories  — http://feeds.bbci.co.uk/news/rss.xml
  2. NPR News              — https://feeds.npr.org/1001/rss.xml
  3. The Guardian World    — https://www.theguardian.com/world/rss

Design decisions:
- trafilatura is used for body extraction: it has the highest extraction accuracy of the
  available open-source options and handles paywalls gracefully (returns None, which we catch).
- Normalization maps every feed into one Article dataclass before anything downstream touches it.
- Dedupe key = SHA-256 of the canonical URL (strip whitespace/trailing slash).
  We check the DB for this key before doing the expensive body-fetch, so re-runs are cheap.
- pubDate parsing tries multiple common formats and falls back to None on failure.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import feedparser
import requests
import trafilatura
from dotenv import load_dotenv

from db import get_conn, init_db, url_hash, article_exists, insert_article

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("scraper")

FETCH_TIMEOUT: int = int(os.getenv("FETCH_TIMEOUT", "15"))
MAX_ARTICLES_PER_FEED: int = int(os.getenv("MAX_ARTICLES_PER_FEED", "50"))

# ─── RSS Feeds ────────────────────────────────────────────────────────────────
FEEDS: list[dict] = [
    {
        "name": "BBC News",
        "url": "http://feeds.bbci.co.uk/news/rss.xml",
    },
    {
        "name": "NPR News",
        "url": "https://feeds.npr.org/1001/rss.xml",
    },
    {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/world/rss",
    },
    {
        "name": "Al Jazeera",
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; NewsPulse/1.0; +https://github.com/piyushb03/NewsPulse)"
    )
}


# ─── Internal Article Schema ──────────────────────────────────────────────────
@dataclass
class Article:
    url_hash: str
    title: str
    source: str
    url: str
    fetched_at: str
    summary: Optional[str] = None
    body: Optional[str] = None
    published_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "url_hash": self.url_hash,
            "title": self.title,
            "summary": self.summary,
            "body": self.body,
            "source": self.source,
            "url": self.url,
            "published_at": self.published_at,
            "fetched_at": self.fetched_at,
        }


# ─── Date parsing ─────────────────────────────────────────────────────────────

def _parse_date(raw: Optional[str]) -> Optional[str]:
    """
    Parse a date string from various RSS formats into UTC ISO-8601.
    Returns None on any failure rather than crashing.
    """
    if not raw:
        return None
    raw = raw.strip()

    # RFC 2822 (most feeds): "Mon, 09 Sep 2024 12:00:00 +0000"
    try:
        dt = parsedate_to_datetime(raw)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass

    # ISO 8601 variants
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            pass

    logger.debug("Could not parse date string: %r", raw)
    return None


# ─── Feed normalization ───────────────────────────────────────────────────────

def _extract_summary(entry) -> Optional[str]:
    """Pull summary text from feedparser entry, trying multiple fields."""
    for attr in ("summary", "description", "content"):
        val = getattr(entry, attr, None)
        if val:
            if isinstance(val, list):
                # content is a list of dicts with 'value' key
                val = val[0].get("value", "")
            # Strip HTML tags naively
            val = re.sub(r"<[^>]+>", " ", val).strip()
            if val:
                return val[:2000]  # cap summary length
    return None


def _canonical_url(url: str) -> str:
    return url.strip().rstrip("/")


def _normalize_entry(entry, source_name: str) -> Optional[Article]:
    """Convert a feedparser entry into our internal Article schema."""
    url = getattr(entry, "link", None) or getattr(entry, "id", None)
    if not url:
        logger.warning("[%s] Entry has no URL — skipping", source_name)
        return None

    url = _canonical_url(url)
    title = getattr(entry, "title", "").strip()
    if not title:
        logger.warning("[%s] Entry %s has no title — skipping", source_name, url)
        return None

    now_utc = datetime.now(timezone.utc).isoformat()

    published_raw = (
        getattr(entry, "published", None)
        or getattr(entry, "updated", None)
        or getattr(entry, "created", None)
    )

    return Article(
        url_hash=url_hash(url),
        title=title,
        source=source_name,
        url=url,
        fetched_at=now_utc,
        summary=_extract_summary(entry),
        published_at=_parse_date(published_raw),
    )


# ─── Body extraction ──────────────────────────────────────────────────────────

def _fetch_body(url: str) -> Optional[str]:
    """
    Fetch and extract the main article body from the article's web page.
    Uses trafilatura for high-quality extraction.
    Returns None gracefully on any error (timeout, paywall, malformed HTML).
    """
    try:
        response = requests.get(url, timeout=FETCH_TIMEOUT, headers=HEADERS)
        response.raise_for_status()
        html = response.text
    except requests.RequestException as exc:
        logger.warning("HTTP fetch failed for %s: %s", url, exc)
        return None

    try:
        body = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
        )
        return body
    except Exception as exc:
        logger.warning("trafilatura extraction failed for %s: %s", url, exc)
        return None


# ─── Main ingest function ─────────────────────────────────────────────────────

def ingest_feed(feed_config: dict, conn) -> tuple[int, int]:
    """
    Ingest one RSS feed. Returns (new_count, skipped_count).
    Never raises — logs and continues on any per-article error.
    """
    source_name = feed_config["name"]
    feed_url = feed_config["url"]
    logger.info("[%s] Fetching RSS …", source_name)

    try:
        parsed = feedparser.parse(feed_url)
    except Exception as exc:
        logger.error("[%s] Failed to parse feed: %s", source_name, exc)
        return 0, 0

    if parsed.bozo and not parsed.entries:
        logger.error("[%s] Feed is malformed and empty: %s", source_name, parsed.bozo_exception)
        return 0, 0

    entries = parsed.entries
    if MAX_ARTICLES_PER_FEED > 0:
        entries = entries[:MAX_ARTICLES_PER_FEED]

    logger.info("[%s] Found %d entries", source_name, len(entries))
    new_count = 0
    skipped_count = 0

    for entry in entries:
        try:
            article = _normalize_entry(entry, source_name)
            if article is None:
                skipped_count += 1
                continue

            # Dedupe check BEFORE expensive body fetch
            if article_exists(conn, article.url_hash):
                logger.debug("[%s] Already stored: %s", source_name, article.url)
                skipped_count += 1
                continue

            # Fetch full body
            body = _fetch_body(article.url)
            article.body = body
            if body is None:
                logger.info("[%s] Body extraction failed (graceful skip): %s", source_name, article.url)

            inserted_id = insert_article(conn, article.to_dict())
            if inserted_id:
                new_count += 1
                logger.info("[%s] Stored article %d: %s", source_name, inserted_id, article.title[:60])
            else:
                skipped_count += 1

        except Exception as exc:
            logger.error("[%s] Unexpected error processing entry: %s", source_name, exc)
            skipped_count += 1
            continue

    return new_count, skipped_count


def run_ingestion() -> dict:
    """Run ingestion for all configured feeds. Returns summary stats."""
    init_db()
    total_new = 0
    total_skipped = 0

    with get_conn() as conn:
        for feed_config in FEEDS:
            try:
                new, skipped = ingest_feed(feed_config, conn)
                total_new += new
                total_skipped += skipped
            except Exception as exc:
                logger.error("Feed %s failed entirely: %s", feed_config["name"], exc)

    logger.info("Ingestion complete — %d new articles, %d skipped/existing", total_new, total_skipped)
    return {"new": total_new, "skipped": total_skipped}


if __name__ == "__main__":
    stats = run_ingestion()
    print(f"\nIngestion done: {stats['new']} new, {stats['skipped']} skipped/existing")
