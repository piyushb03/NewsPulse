/**
 * clusters.ts — /clusters routes for News Pulse API.
 */
import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db';
import { ClusterSummary, ClusterDetail, Article, ApiError } from '../types';

const router = Router();

/**
 * GET /clusters
 * Returns all topic clusters with label, article count, and time range.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const clusters = await queryAll<ClusterSummary>(`
      SELECT
        c.id,
        c.label,
        COUNT(ac.article_id) AS article_count,
        MIN(a.published_at)  AS earliest,
        MAX(a.published_at)  AS latest
      FROM clusters c
      LEFT JOIN article_clusters ac ON ac.cluster_id = c.id
      LEFT JOIN articles a          ON a.id = ac.article_id
      GROUP BY c.id, c.label
      ORDER BY (latest IS NULL), latest DESC
    `);

    res.json({ clusters, total: clusters.length });
  } catch (err) {
    console.error('[GET /clusters] error:', err);
    res.status(500).json({ error: 'Failed to fetch clusters' } satisfies ApiError);
  }
});

/**
 * GET /clusters/:id
 * Returns full cluster detail with all member articles sorted chronologically.
 * Returns 404 if cluster not found.
 */
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid cluster ID — must be a positive integer' } satisfies ApiError);
  }

  try {
    const cluster = await queryOne<{ id: number; label: string; created_at: string }>(`
      SELECT id, label, created_at FROM clusters WHERE id = ?
    `, [id]);

    if (!cluster) {
      return res.status(404).json({ error: `Cluster ${id} not found` } satisfies ApiError);
    }

    const articles = await queryAll<Article>(`
      SELECT
        a.id, a.url_hash, a.title, a.summary, a.body,
        a.source, a.url, a.published_at, a.fetched_at
      FROM articles a
      JOIN article_clusters ac ON ac.article_id = a.id
      WHERE ac.cluster_id = ?
      ORDER BY (a.published_at IS NULL), a.published_at ASC
    `, [id]);

    const result: ClusterDetail = {
      id: cluster.id,
      label: cluster.label,
      article_count: articles.length,
      earliest: articles.length > 0 ? articles[0].published_at : null,
      latest: articles.length > 0 ? articles[articles.length - 1].published_at : null,
      articles,
    };

    res.json(result);
  } catch (err) {
    console.error(`[GET /clusters/${id}] error:`, err);
    res.status(500).json({ error: 'Failed to fetch cluster detail' } satisfies ApiError);
  }
});

export default router;
