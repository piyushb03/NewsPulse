'use client';

import React from 'react';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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

function getRelativeTime(s: string | null): string {
  const d = safeParseISO(s);

  if (!d) return 'Recently';

  return formatDistanceToNow(d, { addSuffix: true });
}

export function Timeline({
  clusters,
  onClusterClick,
  selectedClusterId,
}: TimelineProps) {
  if (!clusters || clusters.length === 0) {
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
          <p
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--color-text-dim)',
            }}
          >
            No stories available
          </p>

          <p
            style={{
              fontSize: '13px',
              marginTop: '4px',
            }}
          >
            Click &ldquo;Refresh Data&rdquo; to fetch and organize the latest
            news.
          </p>
        </div>
      </div>
    );
  }

  // Sort by latest update — freshest stories first
  const sorted = [...clusters].sort((a, b) => {
    const aDate = safeParseISO(a.end) || safeParseISO(a.start);
    const bDate = safeParseISO(b.end) || safeParseISO(b.start);

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    return bDate.getTime() - aDate.getTime();
  });

  /*
   * Framer Motion variants
   *
   * `as const` is important here because TypeScript otherwise
   * infers "spring" as a generic string instead of the specific
   * Framer Motion animation type expected by `Variants`.
   */
  const containerVariants = {
    hidden: {
      opacity: 0,
    },

    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  } as const;

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 15,
    },

    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 24,
      },
    },
  } as const;

  return (
    <motion.div
      role="list"
      aria-label="News stories feed"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px',
        width: '100%',
      }}
    >
      <AnimatePresence mode="popLayout">
        {sorted.map((cluster) => {
          const selected = cluster.id === selectedClusterId;

          // Format TF-IDF label into a readable topic list
          const cleanLabel = cluster.label
            .split(' · ')
            .map(
              (word) =>
                word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join(', ');

          return (
            <motion.button
              key={cluster.id}
              layout
              variants={itemVariants}
              initial="hidden"
              animate="show"
              exit={{
                opacity: 0,
                scale: 0.95,
              }}
              whileHover={{
                y: -4,
                boxShadow: 'var(--shadow-md)',
                borderColor: 'var(--color-border-hover)',
              }}
              whileTap={{
                scale: 0.98,
              }}
              role="listitem"
              onClick={() => onClusterClick(cluster.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                background: selected
                  ? 'var(--color-surface-2)'
                  : 'var(--color-surface)',
                border: `1px solid ${
                  selected
                    ? 'var(--color-border-hover)'
                    : 'var(--color-border)'
                }`,
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Top row: Time and Article count */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {getRelativeTime(cluster.end || cluster.start)}
                </span>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    background: 'var(--color-accent-light)',
                    WebkitBackgroundClip: 'text',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  }}
                >
                  {cluster.article_count}{' '}
                  article{cluster.article_count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Title / Label */}
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  lineHeight: 1.4,
                  marginBottom: '16px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {cleanLabel}
              </h3>

              {/* Bottom row: Sources */}
              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {cluster.sources.map((source) => (
                  <span
                    key={source}
                    style={{
                      fontSize: '10px',
                      color: getSourceColor(source),
                      background: 'var(--color-surface-2)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 500,
                    }}
                  >
                    {source}
                  </span>
                ))}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
