/**
 * useTimeline.ts — Custom hook for managing timeline state, polling, and source filtering.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { TimelineCluster, IngestJob } from '@/types';

interface UseTimelineReturn {
  clusters: TimelineCluster[];
  allSources: string[];
  selectedSources: string[];
  toggleSource: (source: string) => void;
  selectAllSources: () => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  ingestJob: IngestJob | null;
  isIngesting: boolean;
  triggerIngest: () => Promise<void>;
}

export function useTimeline(): UseTimelineReturn {
  const [clusters, setClusters] = useState<TimelineCluster[]>([]);
  const [allSources, setAllSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingestJob, setIngestJob] = useState<IngestJob | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTimeline = useCallback(async (sources?: string[]) => {
    try {
      setError(null);
      const data = await api.getTimeline(sources);
      setClusters(data.timeline);

      // Derive all unique sources from unfiltered data
      if (!sources || sources.length === 0) {
        const sourceSet = new Set<string>();
        data.timeline.forEach((c) => c.sources.forEach((s) => sourceSet.add(s)));
        const sourcesArray = Array.from(sourceSet).sort();
        setAllSources(sourcesArray);
        // Initialize selectedSources if empty
        setSelectedSources((prev) => prev.length === 0 ? sourcesArray : prev);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load — fetch without filter to get all sources
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchTimeline(selectedSources.length > 0 && selectedSources.length < allSources.length
      ? selectedSources
      : undefined);
  }, [fetchTimeline, selectedSources, allSources]);

  const toggleSource = useCallback((source: string) => {
    setSelectedSources((prev) => {
      const next = prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source];
      // Re-fetch with new filter
      const filterSources = next.length < allSources.length ? next : undefined;
      fetchTimeline(filterSources);
      return next;
    });
  }, [allSources, fetchTimeline]);

  const selectAllSources = useCallback(() => {
    setSelectedSources(allSources);
    fetchTimeline();
  }, [allSources, fetchTimeline]);

  // Poll ingest job status
  const startPolling = useCallback((jobId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const job = await api.getIngestStatus(jobId);
        setIngestJob(job);

        if (job.status === 'complete') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setIsIngesting(false);
          // Reload timeline with fresh data
          await fetchTimeline();
        } else if (job.status === 'failed') {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setIsIngesting(false);
          setError(`Ingest failed: ${job.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  }, [fetchTimeline]);

  const triggerIngest = useCallback(async () => {
    if (isIngesting) return;

    setIsIngesting(true);
    setError(null);

    try {
      const job = await api.triggerIngest();
      setIngestJob(job);
      startPolling(job.jobId);
    } catch (err) {
      setIsIngesting(false);
      setError(err instanceof Error ? err.message : 'Failed to trigger ingest');
    }
  }, [isIngesting, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    clusters,
    allSources,
    selectedSources,
    toggleSource,
    selectAllSources,
    isLoading,
    error,
    refresh,
    ingestJob,
    isIngesting,
    triggerIngest,
  };
}
