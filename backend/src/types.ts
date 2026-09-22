/**
 * types.ts — Shared TypeScript types for News Pulse backend.
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

export interface Cluster {
  id: number;
  label: string;
  created_at: string;
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

export type JobStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface IngestJob {
  jobId: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
