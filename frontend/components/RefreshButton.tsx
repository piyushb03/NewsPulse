'use client';

import React from 'react';
import { IngestJob } from '@/types';

interface RefreshButtonProps {
  isIngesting: boolean;
  ingestJob: IngestJob | null;
  onRefresh: () => void;
  error: string | null;
}

export function RefreshButton({
  isIngesting,
  ingestJob,
  onRefresh,
  error,
}: RefreshButtonProps) {
  const statusText = (() => {
    if (!isIngesting && !ingestJob) return null;
    if (isIngesting && ingestJob?.status === 'pending') return 'Starting…';
    if (isIngesting && ingestJob?.status === 'running') return 'Fetching articles…';
    if (ingestJob?.status === 'complete') return 'Done';
    if (ingestJob?.status === 'failed') return 'Failed';
    return null;
  })();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button
        id="refresh-btn"
        onClick={onRefresh}
        disabled={isIngesting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '8px 16px',
          background: isIngesting ? 'var(--color-surface-2)' : 'var(--color-accent)',
          color: isIngesting ? 'var(--color-text-muted)' : 'white',
          border: isIngesting ? '1px solid var(--color-border)' : '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          boxShadow: isIngesting ? 'none' : 'var(--shadow-sm)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isIngesting ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease, opacity 0.15s ease',
          fontFamily: 'inherit',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={(e) => {
          if (!isIngesting) {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isIngesting) {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent)';
          }
        }}
        aria-label={isIngesting ? 'Refreshing data…' : 'Refresh data — triggers the scraper pipeline'}
        aria-busy={isIngesting}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            animation: isIngesting ? 'spin 1s linear infinite' : 'none',
          }}
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        {isIngesting ? 'Refreshing…' : 'Refresh Data'}
      </button>

      {(statusText || error) && (
        <span
          style={{
            fontSize: '12px',
            color:
              ingestJob?.status === 'failed' || error
                ? 'var(--color-danger)'
                : ingestJob?.status === 'complete'
                ? 'var(--color-success)'
                : 'var(--color-text-muted)',
            transition: 'color 0.2s ease',
          }}
          aria-live="polite"
        >
          {error ? `Error: ${error}` : statusText}
        </span>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
