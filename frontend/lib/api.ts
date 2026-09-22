/**
 * api.ts — Typed API client for News Pulse frontend.
 */
import { TimelineResponse, ClusterDetail, IngestJob } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  /** Fetch timeline data, optionally filtered by sources */
  getTimeline(sources?: string[]): Promise<TimelineResponse> {
    const query = sources && sources.length > 0
      ? `?sources=${encodeURIComponent(sources.join(','))}`
      : '';
    return fetchJson<TimelineResponse>(`/timeline${query}`);
  },

  /** Fetch full cluster detail including articles */
  getCluster(id: number): Promise<ClusterDetail> {
    return fetchJson<ClusterDetail>(`/clusters/${id}`);
  },

  /** Trigger pipeline ingestion, returns job ID */
  triggerIngest(): Promise<IngestJob> {
    return fetchJson<IngestJob>('/ingest/trigger', { method: 'POST' });
  },

  /** Poll job status */
  getIngestStatus(jobId: string): Promise<IngestJob> {
    return fetchJson<IngestJob>(`/ingest/status/${jobId}`);
  },
};
