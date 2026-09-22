/**
 * types.ts — Shared types for News Pulse frontend.
 */

export interface Article {
  id: number;
  url_hash: string;
  title: string;
  summary: string | null;
  body: string | null;
  source: string;
  url: string;
  published_at: string | null;
  fetched_at: string;
}

export interface ClusterSummary {
  id: number;
  label: string;
  article_count: number;
  earliest: string | null;
  latest: string | null;
}

export interface ClusterDetail extends ClusterSummary {
  articles: Article[];
}

export interface TimelineCluster {
  id: number;
  label: string;
  start: string | null;
  end: string | null;
  article_count: number;
  intensity: number;
  sources: string[];
}

export interface TimelineResponse {
  timeline: TimelineCluster[];
  total: number;
}

export interface IngestJob {
  jobId: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startedAt: string;
  finishedAt?: string;
  error?: string;
}
