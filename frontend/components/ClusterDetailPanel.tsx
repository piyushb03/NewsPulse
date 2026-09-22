'use client';

import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { ClusterDetail, Article } from '@/types';

interface ClusterDetailPanelProps {
  cluster: ClusterDetail | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatPubDate(s: string | null): string {
  if (!s) return 'Unknown date';
  try {
    const d = parseISO(s);
    if (!isValid(d)) return s;
    return format(d, 'MMM d, yyyy · HH:mm');
  } catch {
    return s;
  }
}

function ArticleRow({ article, index }: { article: Article; index: number }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: '14px 0',
        borderBottom: '1px solid var(--color-border)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.paddingLeft = '4px';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.paddingLeft = '0px';
      }}
      aria-label={`${article.title} — ${article.source}, opens in new tab`}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            background: 'var(--color-surface-2)',
            padding: '2px 6px',
            borderRadius: '3px',
            flexShrink: 0,
          }}
        >
          {article.source}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatPubDate(article.published_at)}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: 'var(--color-accent)',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          ↗
        </span>
      </div>
      <h3
        style={{
          fontSize: '13.5px',
          fontWeight: 500,
          color: 'var(--color-text)',
          lineHeight: '1.45',
          transition: 'color 0.1s ease',
          margin: 0,
        }}
      >
        {article.title}
      </h3>
      {article.summary && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginTop: '4px',
            lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {article.summary}
        </p>
      )}
    </a>
  );
}

export function ClusterDetailPanel({
  cluster,
  isLoading,
  error,
  onClose,
}: ClusterDetailPanelProps) {
  const panelVisible = isLoading || error !== null || cluster !== null;

  if (!panelVisible) return null;

  return (
    <div
      role="complementary"
      aria-label="Cluster detail"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '70vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div>
          {isLoading ? (
            <div
              style={{
                width: '180px',
                height: '16px',
                background: 'var(--color-border)',
                borderRadius: '4px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ) : cluster ? (
            <>
              <h2
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  margin: 0,
                }}
              >
                {cluster.label}
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  marginTop: '2px',
                }}
              >
                {cluster.article_count} article
                {cluster.article_count !== 1 ? 's' : ''}
                {cluster.earliest && (
                  <> · {formatPubDate(cluster.earliest)} — {formatPubDate(cluster.latest)}</>
                )}
              </p>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-danger)', margin: 0 }}>
              {error}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '6px 8px',
            lineHeight: 1,
            fontSize: '14px',
            transition: 'border-color 0.15s ease, color 0.15s ease',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-hover)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
          }}
          aria-label="Close cluster detail"
        >
          ✕
        </button>
      </div>

      {/* Articles list */}
      <div
        style={{
          overflowY: 'auto',
          padding: '0 20px',
          flex: 1,
        }}
      >
        {isLoading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '16px 0',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div
                  style={{
                    width: '60px',
                    height: '12px',
                    background: 'var(--color-border)',
                    borderRadius: '3px',
                    marginBottom: '8px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <div
                  style={{
                    width: '100%',
                    height: '14px',
                    background: 'var(--color-border)',
                    borderRadius: '3px',
                    marginBottom: '6px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <div
                  style={{
                    width: '70%',
                    height: '12px',
                    background: 'var(--color-border)',
                    borderRadius: '3px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {!isLoading && cluster && (
          <div>
            {cluster.articles.map((article, i) => (
              <ArticleRow key={article.id} article={article} index={i} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
