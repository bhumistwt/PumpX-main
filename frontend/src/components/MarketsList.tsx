import React, { useState, useMemo } from 'react';
import { useMarket } from '../hooks/useMarket';
import MarketCard from './MarketCard';

interface MarketsListProps {
  userAddress?: string;
}

const FILTERS = [
  { key: 'all', label: 'All Markets' },
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Resolved' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

export default function MarketsList({ userAddress }: MarketsListProps) {
  const { markets } = useMarket();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const filteredMarkets = useMemo(() => {
    const now = Date.now();
    return markets.filter((market) => {
      // Filter by status
      if (filter === 'active' && (market.resolved || now >= market.deadline)) return false;
      if (filter === 'resolved' && !market.resolved) return false;

      // Filter by search
      if (search) {
        const q = search.toLowerCase();
        return (
          market.question.toLowerCase().includes(q) ||
          market.tokenSymbol.toLowerCase().includes(q) ||
          market.tokenName.toLowerCase().includes(q) ||
          market.marketContract?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [markets, filter, search]);

  const activeCt = markets.filter(m => !m.resolved && Date.now() < m.deadline).length;
  const resolvedCt = markets.filter(m => m.resolved).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Markets</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {markets.length} total · {activeCt} active · {resolvedCt} resolved
          </p>
        </div>
        <a href="/markets" className="btn-primary text-sm shrink-0">+ Create Market</a>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by token, question, or address…"
          className="input flex-1 text-sm"
        />
        <div className="flex bg-[var(--bg-elevated)] rounded-lg p-0.5 shrink-0">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[var(--accent-primary)] text-black'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              {f.label}
              {f.key === 'all' && ` (${markets.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Markets Grid */}
      {filteredMarkets.length === 0 ? (
        <div className="card text-center py-16 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">No markets found</h3>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            {filter === 'all' && !search
              ? 'Be the first to create a prediction market'
              : 'Try adjusting your search or filters'}
          </p>
          {filter === 'all' && !search && (
            <a href="/markets" className="btn-primary text-sm inline-block">Create Market</a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
