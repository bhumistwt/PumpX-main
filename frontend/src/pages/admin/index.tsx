/**
 * PumpX — Admin Dashboard
 * Protected: ADMIN role required.
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import {
    LuUsers, LuBarChart3, LuShield, LuActivity, LuTrendingUp,
    LuRefreshCw, LuCheck, LuX, LuBrain, LuAlertTriangle, LuCircleDot,
} from 'react-icons/lu';

interface AdminStats {
    totalUsers: number;
    totalMarkets: number;
    activeMarkets: number;
    resolvedMarkets: number;
    totalBets: number;
    totalEthVolume: number;
}

interface MarketRow {
    id: string;
    contractAddress: string;
    question: string;
    resolved: boolean;
    reached: boolean;
    deadline: string;
    chainId: number;
    creatorAddress: string;
    yesPool: string;
    noPool: string;
    _count: { bets: number };
}

interface ModelHealth {
    id: string;
    avgProbability: number;
    avgConfidence: number;
    overconfidenceRate: number;
    totalPredictions: number;
    lastDriftCheck: string | null;
    lastDriftPsi: number | null;
    isDegrading: boolean;
}

interface PredictionLogEntry {
    id: string;
    marketAddress: string;
    probability: number;
    confidence: number;
    signal: string;
    riskFlags: string[];
    triggeredBy: string;
    createdAt: string;
}

interface ConfidenceBuckets {
    low: number;
    medium: number;
    high: number;
}

interface MLStats {
    health: ModelHealth;
    recentPredictions: PredictionLogEntry[];
    confidenceBuckets: ConfidenceBuckets;
    driftHistory: Array<{ psiScore: number | null; status: string | null; isDegrading: boolean; checkedAt: string }>;
}

export default function AdminDashboard() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [markets, setMarkets] = useState<MarketRow[]>([]);
    const [mlStats, setMlStats] = useState<MLStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'ADMIN')) {
            router.replace('/dashboard');
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (!user || user.role !== 'ADMIN') return;

        async function fetchAll() {
            try {
                const [statsRes, marketsRes, mlRes] = await Promise.all([
                    fetch('/api/stats'),
                    fetch('/api/markets?limit=100'),
                    fetch('/api/ml/stats'),
                ]);
                const statsData = await statsRes.json();
                const marketsData = await marketsRes.json();
                setStats(statsData);
                setMarkets(marketsData.markets || []);
                if (mlRes.ok) {
                    setMlStats(await mlRes.json());
                }
            } catch { }
            finally { setLoading(false); }
        }
        fetchAll();
    }, [user]);

    if (isLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="glass-card p-8 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[var(--text-muted)] text-sm">Loading admin console…</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'ADMIN') return null;

    const fmtEth = (wei: string) => (Number(wei) / 1e18).toFixed(4);
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

    // Model health indicator
    function modelHealthBadge(health: ModelHealth) {
        if (health.isDegrading) {
            return <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold"><LuAlertTriangle className="w-3.5 h-3.5" /> Degrading</span>;
        }
        if ((health.lastDriftPsi ?? 0) >= 0.2) {
            return <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-semibold"><LuAlertTriangle className="w-3.5 h-3.5" /> Alert</span>;
        }
        return <span className="inline-flex items-center gap-1 text-green-400 text-xs font-semibold"><LuCircleDot className="w-3.5 h-3.5 animate-pulse" /> Healthy</span>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <LuShield className="w-5 h-5 text-red-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Admin Console</h1>
                    <p className="text-sm text-[var(--text-muted)]">PumpX platform management</p>
                </div>
            </div>

            {/* Stats Grid */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'Total Users', value: stats.totalUsers, icon: LuUsers },
                        { label: 'Active Markets', value: stats.activeMarkets, icon: LuActivity },
                        { label: 'Total Markets', value: stats.totalMarkets, icon: LuBarChart3 },
                        { label: 'Resolved', value: stats.resolvedMarkets, icon: LuTrendingUp },
                        { label: 'Total Bets', value: stats.totalBets, icon: LuActivity },
                        { label: 'ETH Volume', value: `${stats.totalEthVolume.toFixed(4)} Ξ`, icon: LuTrendingUp },
                    ].map((s) => (
                        <div key={s.label} className="card p-4 text-center">
                            <p className="text-2xl font-bold font-mono text-[var(--accent-primary)]">{s.value}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── ML Model Intelligence Panel ─────────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                        <LuBrain className="w-4 h-4 text-[var(--accent-primary)]" />
                        Model Intelligence
                    </h2>
                    {mlStats && modelHealthBadge(mlStats.health)}
                </div>

                {mlStats ? (
                    <div className="p-4 space-y-6">
                        {/* Key metrics row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="rounded-xl bg-[var(--bg-elevated)] p-3 text-center">
                                <p className="text-xl font-bold font-mono text-[var(--accent-primary)]">
                                    {(mlStats.health.avgProbability * 100).toFixed(1)}%
                                </p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Avg Probability</p>
                            </div>
                            <div className="rounded-xl bg-[var(--bg-elevated)] p-3 text-center">
                                <p className="text-xl font-bold font-mono text-blue-400">
                                    {(mlStats.health.avgConfidence * 100).toFixed(1)}%
                                </p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Avg Confidence</p>
                            </div>
                            <div className="rounded-xl bg-[var(--bg-elevated)] p-3 text-center">
                                <p className={`text-xl font-bold font-mono ${mlStats.health.overconfidenceRate > 0.3 ? 'text-red-400' : 'text-green-400'}`}>
                                    {fmtPct(mlStats.health.overconfidenceRate)}
                                </p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Overconfidence Rate</p>
                            </div>
                            <div className="rounded-xl bg-[var(--bg-elevated)] p-3 text-center">
                                <p className="text-xl font-bold font-mono text-purple-400">
                                    {mlStats.health.totalPredictions.toLocaleString()}
                                </p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Total Predictions</p>
                            </div>
                        </div>

                        {/* Confidence distribution */}
                        <div>
                            <p className="text-xs text-[var(--text-muted)] mb-2">Confidence Distribution (last 20 predictions)</p>
                            <div className="flex gap-2 items-end h-8">
                                {(() => {
                                    const total = mlStats.confidenceBuckets.low + mlStats.confidenceBuckets.medium + mlStats.confidenceBuckets.high || 1;
                                    return [
                                        { label: 'Low', value: mlStats.confidenceBuckets.low, color: 'bg-red-500' },
                                        { label: 'Med', value: mlStats.confidenceBuckets.medium, color: 'bg-yellow-500' },
                                        { label: 'High', value: mlStats.confidenceBuckets.high, color: 'bg-green-500' },
                                    ].map((b) => (
                                        <div key={b.label} className="flex flex-col items-center gap-1 flex-1">
                                            <span className="text-xs text-[var(--text-muted)]">{b.value}</span>
                                            <div
                                                className={`w-full rounded-t ${b.color} opacity-80`}
                                                style={{ height: `${Math.max(4, (b.value / total) * 32)}px` }}
                                            />
                                            <span className="text-xs text-[var(--text-muted)]">{b.label}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* Drift info */}
                        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                            <span>PSI: <span className={`font-mono font-semibold ${(mlStats.health.lastDriftPsi ?? 0) >= 0.2 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {mlStats.health.lastDriftPsi !== null ? mlStats.health.lastDriftPsi.toFixed(4) : '—'}
                            </span></span>
                            <span>Last drift check: {mlStats.health.lastDriftCheck
                                ? new Date(mlStats.health.lastDriftCheck).toLocaleString()
                                : 'Never'}</span>
                            {mlStats.health.isDegrading && (
                                <span className="text-red-400 font-semibold flex items-center gap-1">
                                    <LuAlertTriangle className="w-3 h-3" /> MODEL_DEGRADING
                                </span>
                            )}
                        </div>

                        {/* Recent Predictions */}
                        <div>
                            <p className="text-xs text-[var(--text-muted)] mb-2">Recent Predictions</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                                            <th className="text-left p-2">Market</th>
                                            <th className="text-center p-2">Prob</th>
                                            <th className="text-center p-2">Conf</th>
                                            <th className="text-center p-2">Signal</th>
                                            <th className="text-center p-2">Trigger</th>
                                            <th className="text-left p-2">Flags</th>
                                            <th className="text-left p-2">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mlStats.recentPredictions.map((p) => (
                                            <tr key={p.id} className="border-b border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/20">
                                                <td className="p-2 font-mono">{p.marketAddress.slice(0, 8)}…</td>
                                                <td className="p-2 text-center font-mono">{(p.probability * 100).toFixed(1)}%</td>
                                                <td className="p-2 text-center font-mono">{(p.confidence * 100).toFixed(1)}%</td>
                                                <td className="p-2 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${p.signal === 'BUY' ? 'bg-green-500/20 text-green-400' :
                                                            p.signal === 'SELL' ? 'bg-red-500/20 text-red-400' :
                                                                'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                                                        }`}>{p.signal}</span>
                                                </td>
                                                <td className="p-2 text-center text-[var(--text-muted)]">{p.triggeredBy}</td>
                                                <td className="p-2">
                                                    {p.riskFlags.length > 0
                                                        ? <span className="text-yellow-400">{p.riskFlags[0].split(':')[0]}</span>
                                                        : <span className="text-green-400">—</span>}
                                                </td>
                                                <td className="p-2 text-[var(--text-muted)]">
                                                    {new Date(p.createdAt).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {mlStats.recentPredictions.length === 0 && (
                                            <tr><td colSpan={7} className="p-4 text-center text-[var(--text-muted)]">No predictions yet</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center text-[var(--text-muted)] text-sm">
                        <LuBrain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Model stats unavailable (ML service may be offline)
                    </div>
                )}
            </div>

            {/* Markets Table */}
            <div className="card overflow-hidden">
                <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                        <LuBarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
                        All Markets ({markets.length})
                    </h2>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-secondary text-xs flex items-center gap-1"
                    >
                        <LuRefreshCw className="w-3 h-3" /> Refresh
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-xs">
                                <th className="text-left p-3">Market</th>
                                <th className="text-center p-3">Chain</th>
                                <th className="text-center p-3">Status</th>
                                <th className="text-right p-3">YES Pool</th>
                                <th className="text-right p-3">NO Pool</th>
                                <th className="text-center p-3">Bets</th>
                                <th className="text-left p-3">Deadline</th>
                            </tr>
                        </thead>
                        <tbody>
                            {markets.map((m) => {
                                const isActive = !m.resolved && new Date(m.deadline) > new Date();
                                return (
                                    <tr key={m.id} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                                        <td className="p-3 max-w-[260px]">
                                            <p className="font-medium truncate text-[var(--text-primary)]">{m.question}</p>
                                            <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                                                {m.contractAddress.slice(0, 8)}…{m.contractAddress.slice(-6)}
                                            </p>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                                                {m.chainId === 8453 ? 'Base' : 'Sepolia'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            {m.resolved ? (
                                                m.reached ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                                        <LuCheck className="w-3 h-3" /> YES Won
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs text-red-400">
                                                        <LuX className="w-3 h-3" /> NO Won
                                                    </span>
                                                )
                                            ) : isActive ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-[var(--accent-primary)]">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[var(--text-muted)]">Expired</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right font-mono text-xs text-green-400">{fmtEth(m.yesPool)} Ξ</td>
                                        <td className="p-3 text-right font-mono text-xs text-red-400">{fmtEth(m.noPool)} Ξ</td>
                                        <td className="p-3 text-center text-[var(--text-muted)]">{m._count.bets}</td>
                                        <td className="p-3 text-xs text-[var(--text-muted)]">
                                            {new Date(m.deadline).toLocaleDateString()}
                                        </td>
                                    </tr>
                                );
                            })}
                            {markets.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-[var(--text-muted)]">
                                        No markets created yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
