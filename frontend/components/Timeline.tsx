'use client';

import React, { useMemo } from 'react';
import { format, parseISO, differenceInHours, isValid } from 'date-fns';
import { TimelineCluster } from '@/types';
import { getSourceColor } from './SourceFilter';

interface TimelineProps {
  clusters: TimelineCluster[];
  onClusterClick: (id: number) => void;
  selectedClusterId: number | null;
}

function safeParseISO(s: string | null): Date | null {
  if (!s) return null;
  try {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function formatDate(s: string | null): string {
  const d = safeParseISO(s);
  if (!d) return '—';
  return format(d, 'MMM d, HH:mm');
}

/**
 * Timeline visualization component.
 *
 * Architecture:
 * - Computes a global time range from all clusters' start/end dates.
 * - Maps each cluster to a horizontal bar spanning its time window as a % of total range.
 * - Clusters are stacked vertically, labeled with their topic label.
 * - Clicking a cluster row calls onClusterClick.
 * - Intensity (article count) is communicated via bar height/opacity.
 */
export function Timeline({ clusters, onClusterClick, selectedClusterId }: TimelineProps) {
  const { minDate, maxDate, totalMs } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;

    for (const c of clusters) {
      const start = safeParseISO(c.start);
      const end = safeParseISO(c.end);
      if (start && (!min || start < min)) min = start;
      if (end && (!max || end > max)) max = end;
      if (start && (!max || start > max)) max = start;
      if (end && (!min || end < min)) min = end;
    }

    const totalMs = min && max ? Math.max(max.getTime() - min.getTime(), 1) : 1;
    return { minDate: min, maxDate: max, totalMs };
  }, [clusters]);

  // Generate time axis ticks (6 evenly spaced)
  const ticks = useMemo(() => {
    if (!minDate || !maxDate) return [];
    const tickCount = 6;
    return Array.from({ length: tickCount }, (_, i) => {
      const ms = minDate.getTime() + (totalMs / (tickCount - 1)) * i;
      return new Date(ms);
    });
  }, [minDate, maxDate, totalMs]);

  if (clusters.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px',
          color: 'var(--color-text-muted)',
          gap: '12px',
          textAlign: 'center',
        }}
        aria-live="polite"
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-dim)' }}>
            No clusters yet
          </p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Click &ldquo;Refresh Data&rdquo; to fetch and group the latest articles.
          </p>
        </div>
      </div>
    );
  }

  // Sort clusters by start time
  const sorted = [...clusters].sort((a, b) => {
    const aDate = safeParseISO(a.start);
    const bDate = safeParseISO(b.start);
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.getTime() - bDate.getTime();
  });

  const maxArticleCount = Math.max(...clusters.map((c) => c.article_count), 1);

  function getBarStyle(cluster: TimelineCluster): React.CSSProperties {
    const start = safeParseISO(cluster.start);
    const endRaw = safeParseISO(cluster.end);

    if (!start || !minDate) {
      return { left: '0%', width: '2%' };
    }

    const endMs: number = endRaw !== null ? endRaw.getTime() : start.getTime();
    const left = ((start.getTime() - minDate.getTime()) / totalMs) * 100;
    const width = Math.max(((endMs - start.getTime()) / totalMs) * 100, 0.5);

    return {
      left: `${Math.min(left, 99.5)}%`,
      width: `${Math.min(width, 100 - left)}%`,
    };
  }

  // Determine primary source color for each cluster
  function getPrimaryColor(cluster: TimelineCluster): string {
    if (cluster.sources.length === 0) return '#3b82f6';
    return getSourceColor(cluster.sources[0]);
  }

  const isSelected = (id: number) => id === selectedClusterId;

  return (
    <div
      role="region"
      aria-label="News cluster timeline"
      style={{ width: '100%' }}
    >
      {/* Time axis */}
      <div
        style={{
          position: 'relative',
          height: '28px',
          marginBottom: '8px',
          marginLeft: '200px',
          paddingRight: '16px',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          {ticks.map((tick, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${(i / (ticks.length - 1)) * 100}%`,
                transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {format(tick, 'MMM d')}
            </div>
          ))}
        </div>
        {/* Axis line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            backgroundColor: 'var(--color-border)',
          }}
        />
      </div>

      {/* Cluster rows */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}
      >
        {sorted.map((cluster) => {
          const barStyle = getBarStyle(cluster);
          const color = getPrimaryColor(cluster);
          const selected = isSelected(cluster.id);
          const intensity = cluster.article_count / maxArticleCount;
          const barHeight = Math.max(18, Math.round(18 + intensity * 16));

          return (
            <div
              key={cluster.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0',
                height: `${barHeight + 10}px`,
              }}
            >
              {/* Label */}
              <div
                style={{
                  width: '200px',
                  flexShrink: 0,
                  paddingRight: '12px',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: '11.5px',
                    color: selected ? 'var(--color-accent-light)' : 'var(--color-text-dim)',
                    fontWeight: selected ? 600 : 400,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s ease',
                  }}
                  title={cluster.label}
                >
                  {cluster.label}
                </span>
              </div>

              {/* Timeline track */}
              <div
                style={{
                  flex: 1,
                  position: 'relative',
                  height: `${barHeight}px`,
                  paddingRight: '16px',
                }}
              >
                {/* Track background */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: '4px',
                  }}
                />

                {/* The bar */}
                <button
                  onClick={() => onClusterClick(cluster.id)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    ...barStyle,
                    backgroundColor: selected
                      ? color
                      : color + Math.round(intensity * 120 + 80).toString(16).padStart(2, '0'),
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: selected
                      ? `1px solid ${color}`
                      : '1px solid transparent',
                    outline: 'none',
                    transition: 'background-color 0.15s ease, opacity 0.15s ease, border-color 0.15s ease',
                    minWidth: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                  }}
                  aria-label={`${cluster.label} — ${cluster.article_count} article${cluster.article_count !== 1 ? 's' : ''}, ${formatDate(cluster.start)} to ${formatDate(cluster.end)}`}
                  aria-pressed={selected}
                >
                  {/* Article count badge if big enough */}
                  {parseFloat(barStyle.width as string) > 4 && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.9)',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        padding: '0 4px',
                      }}
                    >
                      {cluster.article_count}
                    </span>
                  )}
                </button>
              </div>

              {/* Count + range metadata */}
              <div
                style={{
                  width: '90px',
                  flexShrink: 0,
                  paddingLeft: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {cluster.article_count} art.
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                    opacity: 0.7,
                  }}
                >
                  {cluster.sources.slice(0, 2).join(', ')}
                  {cluster.sources.length > 2 ? ' +more' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom axis line */}
      <div
        style={{
          height: '1px',
          backgroundColor: 'var(--color-border)',
          marginTop: '8px',
          marginLeft: '200px',
          marginRight: '16px',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
