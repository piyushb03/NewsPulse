'use client';

import React, { useState } from 'react';
import { useTimeline } from '@/hooks/useTimeline';
import { useCluster } from '@/hooks/useCluster';
import { Timeline } from '@/components/Timeline';
import { ClusterDetailPanel } from '@/components/ClusterDetailPanel';
import { SourceFilter } from '@/components/SourceFilter';
import { RefreshButton } from '@/components/RefreshButton';

export default function HomePage() {
  const {
    clusters,
    allSources,
    selectedSources,
    toggleSource,
    selectAllSources,
    isLoading,
    error,
    ingestJob,
    isIngesting,
    triggerIngest,
  } = useTimeline();

  const {
    cluster: selectedCluster,
    isLoading: clusterLoading,
    error: clusterError,
    fetchCluster,
    clearCluster,
  } = useCluster();

  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  function handleClusterClick(id: number) {
    if (selectedClusterId === id) {
      setSelectedClusterId(null);
      clearCluster();
      return;
    }
    setSelectedClusterId(id);
    fetchCluster(id);
  }

  function handleCloseDetail() {
    setSelectedClusterId(null);
    clearCluster();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
        role="banner"
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 24px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          {/* Logo / title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-hidden="true"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              News Pulse
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                padding: '2px 6px',
                background: 'var(--color-surface-2)',
                borderRadius: '3px',
                border: '1px solid var(--color-border)',
              }}
            >
              Live
            </span>
          </div>

          {/* Source filter (desktop) */}
          <div className="source-filter-desktop" style={{ flex: 1, overflow: 'hidden' }}>
            <SourceFilter
              allSources={allSources}
              selectedSources={selectedSources}
              onToggle={toggleSource}
              onSelectAll={selectAllSources}
            />
          </div>

          {/* Refresh button */}
          <div style={{ flexShrink: 0 }}>
            <RefreshButton
              isIngesting={isIngesting}
              ingestJob={ingestJob}
              onRefresh={triggerIngest}
              error={isIngesting ? null : (ingestJob?.status === 'failed' ? ingestJob.error ?? 'Failed' : null)}
            />
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main
        style={{
          flex: 1,
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        role="main"
        id="main-content"
      >
        {/* Mobile source filter */}
        <div className="source-filter-mobile" style={{ display: 'none' }}>
          <SourceFilter
            allSources={allSources}
            selectedSources={selectedSources}
            onToggle={toggleSource}
            onSelectAll={selectAllSources}
          />
        </div>

        {/* Timeline section */}
        <section
          aria-label="Topic cluster timeline"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Section header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                Topic Timeline
              </h1>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  marginTop: '2px',
                }}
                aria-live="polite"
              >
                {isLoading
                  ? 'Loading clusters…'
                  : error
                  ? `Error: ${error}`
                  : clusters.length === 0
                  ? 'No clusters — click Refresh Data to start.'
                  : `${clusters.length} cluster${clusters.length !== 1 ? 's' : ''} · click any bar to see articles`}
              </p>
            </div>
            {!isLoading && !error && clusters.length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-surface-2)',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  border: '1px solid var(--color-border)',
                }}
              >
                BBC · NPR · The Guardian · Reuters
              </span>
            )}
          </div>

          {/* Timeline body */}
          <div
            style={{
              padding: '16px 20px',
              overflowX: 'auto',
              minHeight: '200px',
              position: 'relative',
            }}
          >
            {isLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '160px',
                  gap: '10px',
                  color: 'var(--color-text-muted)',
                  fontSize: '13px',
                }}
                aria-live="polite"
                role="status"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ animation: 'spin 1s linear infinite' }}
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Loading timeline…
              </div>
            ) : error ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '160px',
                  gap: '8px',
                  color: 'var(--color-danger)',
                  fontSize: '13px',
                  textAlign: 'center',
                }}
                role="alert"
              >
                <span>⚠ {error}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Make sure the backend is running on {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
                </span>
              </div>
            ) : (
              <div style={{ minWidth: '640px' }}>
                <Timeline
                  clusters={clusters}
                  onClusterClick={handleClusterClick}
                  selectedClusterId={selectedClusterId}
                />
              </div>
            )}
          </div>
        </section>

        {/* Cluster detail panel */}
        <ClusterDetailPanel
          cluster={selectedCluster}
          isLoading={clusterLoading}
          error={clusterError}
          onClose={handleCloseDetail}
        />
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
        }}
        role="contentinfo"
      >
        News Pulse · RSS feeds: BBC News, NPR, The Guardian, Reuters ·{' '}
        <a
          href="https://github.com/piyushb03/NewsPulse"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-accent)', textDecoration: 'none' }}
        >
          GitHub
        </a>
      </footer>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .source-filter-desktop { display: none !important; }
          .source-filter-mobile { display: block !important; }
        }
      `}</style>
    </div>
  );
}
