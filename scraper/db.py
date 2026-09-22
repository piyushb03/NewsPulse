"""
db.py — Database abstraction layer for News Pulse scraper.

Supports both SQLite (local dev) and Postgres (production via DATABASE_URL env var).
Schema is created on first run (idempotent DDL).
"""
from __future__ import annotations

import hashlib
import logging
import os
import sqlite3
from contextlib import contextmanager
from typing import Generator
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///news_pulse.db")


def _is_postgres() -> bool:
    return DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")


# ── SQLite helpers ────────────────────────────────────────────────────────────

def _sqlite_path() -> str:
    """Extract file path from a sqlite:// URL or return as-is."""
    if DATABASE_URL.startswith("sqlite:///"):
        return DATABASE_URL[len("sqlite:///"):]
    return "news_pulse.db"


@contextmanager
def _sqlite_conn() -> Generator[sqlite3.Connection, None, None]:
    db_path = _sqlite_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Postgres helpers ──────────────────────────────────────────────────────────

def _pg_conn():
    """Return a psycopg2 connection. Only imported when needed."""
    import psycopg2
    import psycopg2.extras
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


@contextmanager
def _postgres_conn():
    conn = _pg_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Unified connection context manager ───────────────────────────────────────

@contextmanager
def get_conn():
    """Yield a database connection (SQLite or Postgres based on DATABASE_URL)."""
    if _is_postgres():
        with _postgres_conn() as conn:
            yield conn
    else:
        with _sqlite_conn() as conn:
            yield conn


# ── Schema ────────────────────────────────────────────────────────────────────

_SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS articles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url_hash    TEXT    NOT NULL UNIQUE,
    title       TEXT    NOT NULL,
    summary     TEXT,
    body        TEXT,
    source      TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    published_at TEXT,
    fetched_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS clusters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS article_clusters (
    article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    cluster_id  INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, cluster_id)
);
"""

_POSTGRES_DDL = """
CREATE TABLE IF NOT EXISTS articles (
    id          SERIAL      PRIMARY KEY,
    url_hash    TEXT        NOT NULL UNIQUE,
    title       TEXT        NOT NULL,
    summary     TEXT,
    body        TEXT,
    source      TEXT        NOT NULL,
    url         TEXT        NOT NULL,
    published_at TIMESTAMPTZ,
    fetched_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS clusters (
    id          SERIAL      PRIMARY KEY,
    label       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_clusters (
    article_id  INTEGER     NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    cluster_id  INTEGER     NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, cluster_id)
);
"""


def init_db() -> None:
    """Create tables if they don't exist. Idempotent."""
    logger.info("Initialising database schema …")
    ddl = _POSTGRES_DDL if _is_postgres() else _SQLITE_DDL
    with get_conn() as conn:
        if _is_postgres():
            cur = conn.cursor()
            cur.execute(ddl)
        else:
            conn.executescript(ddl)
    logger.info("Schema ready.")


# ── Article helpers ───────────────────────────────────────────────────────────

def url_hash(url: str) -> str:
    return hashlib.sha256(url.strip().encode()).hexdigest()[:64]


def article_exists(conn, url_hash_val: str) -> bool:
    if _is_postgres():
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM articles WHERE url_hash = %s", (url_hash_val,))
        return cur.fetchone() is not None
    else:
        cur = conn.execute("SELECT 1 FROM articles WHERE url_hash = ?", (url_hash_val,))
        return cur.fetchone() is not None


def insert_article(conn, article: dict) -> int:
    """Insert article and return its ID. Assumes url_hash is unique (caller checks)."""
    if _is_postgres():
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO articles (url_hash, title, summary, body, source, url, published_at, fetched_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (url_hash) DO NOTHING
            RETURNING id
            """,
            (
                article["url_hash"], article["title"], article.get("summary"),
                article.get("body"), article["source"], article["url"],
                article.get("published_at"), article["fetched_at"],
            ),
        )
        row = cur.fetchone()
        return row["id"] if row else None
    else:
        cur = conn.execute(
            """
            INSERT OR IGNORE INTO articles (url_hash, title, summary, body, source, url, published_at, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                article["url_hash"], article["title"], article.get("summary"),
                article.get("body"), article["source"], article["url"],
                article.get("published_at"), article["fetched_at"],
            ),
        )
        return cur.lastrowid if cur.lastrowid else None


def get_all_articles(conn) -> list[dict]:
    """Fetch all articles for clustering."""
    if _is_postgres():
        cur = conn.cursor()
        cur.execute("SELECT id, title, summary, body, source, published_at FROM articles ORDER BY published_at DESC")
        return [dict(r) for r in cur.fetchall()]
    else:
        cur = conn.execute("SELECT id, title, summary, body, source, published_at FROM articles ORDER BY published_at DESC")
        return [dict(r) for r in cur.fetchall()]


def clear_clusters(conn) -> None:
    """Delete all cluster records (re-runs regenerate clusters fresh)."""
    if _is_postgres():
        cur = conn.cursor()
        cur.execute("DELETE FROM article_clusters")
        cur.execute("DELETE FROM clusters")
    else:
        conn.execute("DELETE FROM article_clusters")
        conn.execute("DELETE FROM clusters")


def insert_cluster(conn, label: str) -> int:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    if _is_postgres():
        cur = conn.cursor()
        cur.execute("INSERT INTO clusters (label, created_at) VALUES (%s, %s) RETURNING id", (label, now))
        return cur.fetchone()["id"]
    else:
        cur = conn.execute("INSERT INTO clusters (label, created_at) VALUES (?, ?)", (label, now))
        return cur.lastrowid


def insert_article_cluster(conn, article_id: int, cluster_id: int) -> None:
    if _is_postgres():
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO article_clusters (article_id, cluster_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (article_id, cluster_id),
        )
    else:
        conn.execute(
            "INSERT OR IGNORE INTO article_clusters (article_id, cluster_id) VALUES (?, ?)",
            (article_id, cluster_id),
        )
