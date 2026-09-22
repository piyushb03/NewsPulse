/**
 * useCluster.ts — Hook for fetching a single cluster's detail on click.
 */
'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { ClusterDetail } from '@/types';

interface UseClusterReturn {
  cluster: ClusterDetail | null;
  isLoading: boolean;
  error: string | null;
  fetchCluster: (id: number) => Promise<void>;
  clearCluster: () => void;
}

export function useCluster(): UseClusterReturn {
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCluster = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    setCluster(null);

    try {
      const data = await api.getCluster(id);
      setCluster(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCluster = useCallback(() => {
    setCluster(null);
    setError(null);
  }, []);

  return { cluster, isLoading, error, fetchCluster, clearCluster };
}
