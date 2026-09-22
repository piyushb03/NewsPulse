"""
main.py — Entry point for the News Pulse pipeline.
Runs ingestion then grouping in sequence.
"""
from __future__ import annotations

import logging
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("main")


def main() -> int:
    logger.info("=== News Pulse Pipeline Starting ===")

    try:
        from scraper import run_ingestion
        ingest_stats = run_ingestion()
        logger.info("Ingestion: %d new articles, %d skipped", ingest_stats["new"], ingest_stats["skipped"])
    except Exception as exc:
        logger.error("Ingestion failed: %s", exc, exc_info=True)
        return 1

    try:
        from grouper import run_grouping
        group_stats = run_grouping()
        logger.info("Grouping: %d clusters from %d articles", group_stats["clusters"], group_stats["articles_clustered"])
    except Exception as exc:
        logger.error("Grouping failed: %s", exc, exc_info=True)
        return 1

    logger.info("=== News Pulse Pipeline Complete ===")
    print(f"\nPipeline complete: {ingest_stats['new']} new articles -> {group_stats['clusters']} clusters")
    return 0


if __name__ == "__main__":
    sys.exit(main())
