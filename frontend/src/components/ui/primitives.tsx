import React from 'react';
import { LuArrowUpRight, LuArrowDownRight } from 'react-icons/lu';
import { getSentimentLabel } from '../../lib/sentimentUtils';

// ── Loading Skeleton ─────────────────────────────────────────
export function Skeleton({ className = '', lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: i === lines - 1 && lines > 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

// ── Glass Card ────────────────────────────────────────────────
export function GlassCard({
  children,
  className = '',
  glow = false,
  noPad = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  noPad?: boolean;
}) {
  return (
    <div
      className={`glass-card ${noPad ? '' : 'p-5'} ${glow ? 'border-glow-teal' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
  change,
  icon,
  loading = false,
  accentColor,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  loading?: boolean;
  accentColor?: string;
}) {
  if (loading) {
    return (
      <div className="glass-card p-4">
        <Skeleton lines={2} />
      </div>
    );
  }

  const accent = accentColor ?? 'var(--accent-primary)';

  return (
    <div className="glass-card p-4 group hover:border-[var(--glass-border-hover)] transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value font-mono-data" style={{ color: accentColor ?? 'var(--text-primary)' }}>
            {value}
          </p>
          {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
          {change && (
            <p className={`text-xs mt-1 font-medium ${change.positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {change.positive ? '▲' : '▼'} {change.value}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
            style={{ background: `${accent}18` }}
          >
            <span style={{ color: accent }}>{icon}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────
export function PageHeader({
  icon,
  title,
  subtitle,
  pill,
  action,
  iconBg = 'from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20',
  iconColor = 'text-[var(--accent-primary)]',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  pill?: React.ReactNode;
  action?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${iconBg} border border-[var(--glass-border)] flex items-center justify-center shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
            {pill}
          </div>
          {subtitle && (
            <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Tab Bar ────────────────────────────────────────────────────
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: Array<{ id: T; label: string; icon?: React.ReactNode; count?: number }>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 overflow-x-auto pb-0.5 ${className}`} style={{ scrollbarWidth: 'none' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${active === tab.id
              ? 'bg-[var(--accent-primary)] text-[var(--bg-base)] shadow-lg shadow-[var(--accent-primary)]/20'
              : 'glass-card text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--glass-border-hover)]'
            }`}
        >
          {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${active === tab.id ? 'bg-[var(--bg-base)]/20 text-[var(--bg-base)]' : 'bg-[var(--glass-border)] text-[var(--text-muted)]'
                }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Sentiment Bar (YES/NO split) ──────────────────────────────
export function SentimentBar({
  yesPercent,
  height = 'h-2.5',
  showLabels = true,
  showEmoji = false,
  className = '',
}: {
  yesPercent: number;
  height?: string;
  showLabels?: boolean;
  showEmoji?: boolean;
  className?: string;
}) {
  const noPercent = 100 - yesPercent;
  const yesSentiment = getSentimentLabel(yesPercent);

  return (
    <div className={className}>
      {showLabels && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="font-medium text-emerald-400">
            {showEmoji && yesSentiment.emoji + ' '} YES {yesPercent.toFixed(1)}%
          </span>
          <span className="font-medium text-red-400">
            NO {noPercent.toFixed(1)}%
          </span>
        </div>
      )}
      <div className={`w-full ${height} rounded-full overflow-hidden flex`} style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="bg-emerald-500 transition-all duration-700 rounded-l-full"
          style={{ width: `${yesPercent}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-700 rounded-r-full"
          style={{ width: `${noPercent}%` }}
        />
      </div>
    </div>
  );
}

// ── Change Badge (±%) ─────────────────────────────────────────
export function ChangeBadge({
  value,
  size = 'md',
  className = '',
}: {
  value: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const isPos = value >= 0;
  const sizeClass = {
    xs: 'text-[9px] px-1 py-0.5',
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md font-mono font-semibold ${sizeClass} ${isPos
          ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/15'
          : 'text-red-400 bg-red-400/10 border border-red-400/15'
        } ${className}`}
    >
      {isPos ? <LuArrowUpRight className="w-3 h-3" /> : <LuArrowDownRight className="w-3 h-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

// ── Mini Sparkline (SVG) ──────────────────────────────────────
export function MiniSparkline({
  data,
  width = 100,
  height = 32,
  positive,
  className = '',
}: {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  className?: string;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const trend = positive !== undefined ? positive : data[data.length - 1] >= data[0];
  const color = trend ? '#10b981' : '#ef4444';

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const linePath = `M${pts.join(' L')}`;
  const fillPath = `${linePath} L${width},${height} L0,${height} Z`;
  const gradId = `sg-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg width={width} height={height} className={`overflow-visible shrink-0 ${className}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

// ── Live Indicator ────────────────────────────────────────────
export function LiveIndicator({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      {label}
    </span>
  );
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({
  variant,
  children,
}: {
  variant: 'active' | 'success' | 'danger' | 'warning' | 'teal';
  children: React.ReactNode;
}) {
  const cls = {
    active: 'badge-active',
    success: 'badge-success',
    danger: 'badge-danger',
    warning: 'badge-warning',
    teal: 'badge-teal',
  }[variant];
  return <span className={cls}>{children}</span>;
}

// ── Progress Bar ──────────────────────────────────────────────
export function ProgressBar({
  value,
  max,
  showLabel = true,
  size = 'md',
}: {
  value: number;
  max: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const pct = Math.min((value / max) * 100, 100);
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>{pct.toFixed(1)}%</span>
          <span>{value.toLocaleString()} / {max.toLocaleString()}</span>
        </div>
      )}
      <div className={`w-full ${h} rounded-full overflow-hidden`} style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className={`${h} rounded-full transition-all duration-700 ease-out`}
          style={{
            width: `${pct}%`,
            background: pct >= 100
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
          }}
        />
      </div>
    </div>
  );
}

// ── Address Display ───────────────────────────────────────────
export function Address({ value, full = false }: { value: string; full?: boolean }) {
  if (!value) return <span className="text-[var(--text-muted)]">—</span>;
  const display = full ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
  return <span className="font-mono-data text-[var(--text-secondary)] text-xs">{display}</span>;
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center glass-card">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {icon ?? (
          <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

// ── Transaction Toast ─────────────────────────────────────────
export function TxToast({
  status,
  hash,
  message,
}: {
  status: 'pending' | 'success' | 'error';
  hash?: string;
  message?: string;
}) {
  const config = {
    pending: { cls: 'border-amber-500/30 bg-amber-500/10', icon: '⏳', text: 'Transaction Pending…' },
    success: { cls: 'border-emerald-500/30 bg-emerald-500/10', icon: '✓', text: 'Transaction Confirmed' },
    error: { cls: 'border-red-500/30 bg-red-500/10', icon: '✗', text: 'Transaction Failed' },
  }[status];

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-xl ${config.cls} animate-slide-up`}>
      <span className="text-lg">{config.icon}</span>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{message ?? config.text}</p>
        {hash && (
          <p className="text-xs font-mono-data text-[var(--text-muted)] mt-0.5">
            {hash.slice(0, 10)}…{hash.slice(-8)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────
export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-primary)] glass-card opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
      </div>
    </div>
  );
}
