/**
 * PumpX — Canonical Sentiment Utilities
 * Single source of truth for sentiment colors/labels across all pages.
 * Replaces: heatmap.tsx inline helpers, pumpscore inline helpers,
 *           analytics.tsx SentimentGauge color logic, intelligence.tsx inline.
 */

export interface SentimentZone {
    label: string;
    color: string;       // text color class
    bgClass: string;     // background class
    borderClass: string; // border class
    emoji: string;
    hexColor: string;    // raw hex (for SVG/canvas usage)
}

/**
 * getSentimentLabel — used by heatmap, analytics, dashboard
 * @param yesRatio — 0-100 (percentage of YES votes)
 */
export function getSentimentLabel(yesRatio: number): SentimentZone {
    if (yesRatio >= 75)
        return { label: 'Very Bullish', color: 'text-emerald-400', bgClass: 'bg-emerald-500/20', borderClass: 'border-emerald-500/25', emoji: '🚀', hexColor: '#10b981' };
    if (yesRatio >= 60)
        return { label: 'Bullish', color: 'text-emerald-300', bgClass: 'bg-emerald-500/12', borderClass: 'border-emerald-500/15', emoji: '📈', hexColor: '#34d399' };
    if (yesRatio >= 40)
        return { label: 'Neutral', color: 'text-amber-400', bgClass: 'bg-amber-500/12', borderClass: 'border-amber-500/15', emoji: '⚖️', hexColor: '#f59e0b' };
    if (yesRatio >= 25)
        return { label: 'Bearish', color: 'text-red-300', bgClass: 'bg-red-500/12', borderClass: 'border-red-500/15', emoji: '📉', hexColor: '#f87171' };
    return { label: 'Very Bearish', color: 'text-red-400', bgClass: 'bg-red-500/20', borderClass: 'border-red-500/25', emoji: '💀', hexColor: '#ef4444' };
}

/**
 * getSentimentColor — returns gradient card class for heatmap cells
 */
export function getSentimentColor(yesRatio: number): string {
    if (yesRatio >= 75) return 'from-emerald-500/25 to-emerald-500/5 border-emerald-500/20';
    if (yesRatio >= 60) return 'from-emerald-500/15 to-emerald-500/3 border-emerald-500/12';
    if (yesRatio >= 40) return 'from-amber-500/15  to-amber-500/3  border-amber-500/12';
    if (yesRatio >= 25) return 'from-red-500/15    to-red-500/3    border-red-500/12';
    return 'from-red-500/25    to-red-500/5    border-red-500/20';
}

/**
 * getPumpScoreZone — used by pumpscore page, maps 0-100 score to sentiment
 */
export function getPumpScoreZone(score: number): SentimentZone & { bg: string; border: string } {
    const base = getSentimentLabel(score);
    const bgHexMap: Record<string, string> = {
        '#10b981': 'rgba(16,185,129,0.12)',
        '#34d399': 'rgba(52,211,153,0.10)',
        '#f59e0b': 'rgba(245,158,11,0.10)',
        '#f87171': 'rgba(248,113,113,0.10)',
        '#ef4444': 'rgba(239,68,68,0.12)',
    };
    const borderHexMap: Record<string, string> = {
        '#10b981': 'rgba(16,185,129,0.30)',
        '#34d399': 'rgba(52,211,153,0.25)',
        '#f59e0b': 'rgba(245,158,11,0.25)',
        '#f87171': 'rgba(248,113,113,0.25)',
        '#ef4444': 'rgba(239,68,68,0.30)',
    };
    return {
        ...base,
        bg: bgHexMap[base.hexColor] ?? 'rgba(255,255,255,0.06)',
        border: borderHexMap[base.hexColor] ?? 'rgba(255,255,255,0.10)',
    };
}

/**
 * calculatePumpScore — aggregate YES % across markets, volume-weighted
 */
export function calculatePumpScore(
    markets: Array<{ yesPool: number; noPool: number; status?: string }>
): number {
    const active = markets.filter((m) => !('status' in m) || m.status !== 'resolved');
    if (active.length === 0) return 50;

    const totalVolume = active.reduce((s, m) => s + m.yesPool + m.noPool, 0);
    if (totalVolume === 0) return 50;

    const weightedSum = active.reduce((s, m) => {
        const total = m.yesPool + m.noPool;
        if (total === 0) return s;
        const yesPct = (m.yesPool / total) * 100;
        return s + yesPct * (total / totalVolume);
    }, 0);

    return Math.round(Math.max(0, Math.min(100, weightedSum)));
}
