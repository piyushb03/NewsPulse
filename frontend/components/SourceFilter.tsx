'use client';

import React from 'react';

interface SourceFilterProps {
  allSources: string[];
  selectedSources: string[];
  onToggle: (source: string) => void;
  onSelectAll: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  'BBC News': '#bb1919',
  'NPR News': '#0052a5',
  'The Guardian': '#005689',
  Reuters: '#f63',
};

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source] ?? '#3b82f6';
}

export function SourceFilter({
  allSources,
  selectedSources,
  onToggle,
  onSelectAll,
}: SourceFilterProps) {
  const allSelected = selectedSources.length === allSources.length;

  if (allSources.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
      role="group"
      aria-label="Filter by news source"
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginRight: '4px',
        }}
      >
        Sources
      </span>

      {/* Select all */}
      <button
        onClick={onSelectAll}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${allSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: allSelected ? 'rgba(59,130,246,0.12)' : 'transparent',
          color: allSelected ? 'var(--color-accent-light)' : 'var(--color-text-dim)',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          fontFamily: 'inherit',
        }}
        aria-pressed={allSelected}
      >
        All
      </button>

      {allSources.map((source) => {
        const active = selectedSources.includes(source);
        const color = getSourceColor(source);
        return (
          <button
            key={source}
            onClick={() => onToggle(source)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${active ? color + '66' : 'var(--color-border)'}`,
              background: active ? color + '18' : 'transparent',
              color: active ? '#e2e8f0' : 'var(--color-text-muted)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
            aria-pressed={active}
            aria-label={`${active ? 'Hide' : 'Show'} ${source}`}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: active ? color : 'var(--color-text-muted)',
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            {source}
          </button>
        );
      })}
    </div>
  );
}

export { getSourceColor };
