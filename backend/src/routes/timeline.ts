/**
 * timeline.ts — /timeline route for News Pulse API.
 *
 * Returns clusters shaped specifically for charting:
 *   - start / end timestamps (explicit per-cluster)
 *   - article_count as the primary intensity metric
 *   - sources array (outlet diversity)
 *
 * Design note: "intensity" = article_count. This gives the charting library
 * a single numeric value to map to visual size/opacity without inventing complexity.
 * Documented in README under "Assumptions Made."
 */
import { Router, Request, Response } from 'express';
import { queryAll } from '../db';
import { TimelineCluster, ApiError } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Optional source filter: ?sources=BBC+News,NPR+News
    const sourcesParam = req.query.sources as string | undefined;
    const sourceFilter: string[] = sourcesParam
      ? sourcesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Fetch all clusters with their aggregate stats
    const rows = await queryAll<{
      id: number;
      label: string;
      article_count: number;
      earliest: string | null;
      latest: string | null;
    }>(`
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
      ORDER BY (earliest IS NULL), earliest ASC
    `);

    // Fetch sources per cluster for the filter
    const sourcesRows = await queryAll<{ cluster_id: number; source: string }>(`
      SELECT DISTINCT ac.cluster_id, a.source
      FROM article_clusters ac
      JOIN articles a ON a.id = ac.article_id
    `);

    const clusterSources: Map<number, Set<string>> = new Map();
    for (const row of sourcesRows) {
      if (!clusterSources.has(row.cluster_id)) {
        clusterSources.set(row.cluster_id, new Set());
      }
      clusterSources.get(row.cluster_id)!.add(row.source);
    }

    let timeline: TimelineCluster[] = rows.map((row) => ({
      id: row.id,
      label: row.label,
      start: row.earliest,
      end: row.latest,
      article_count: Number(row.article_count),
      intensity: Number(row.article_count),
      sources: Array.from(clusterSources.get(row.id) ?? new Set()),
    }));

    // Apply source filter if provided
    if (sourceFilter.length > 0) {
      timeline = timeline.filter((cluster) =>
        cluster.sources.some((s) => sourceFilter.includes(s))
      );
    }

    res.json({ timeline, total: timeline.length });
  } catch (err) {
    console.error('[GET /timeline] error:', err);
    res.status(500).json({ error: 'Failed to fetch timeline data' } satisfies ApiError);
  }
});

export default router;
