/**
 * Cross-Chain Supply Tracker Page
 *
 * Visualise how a token's supply is distributed across 7 supported chains.
 * Users enter a token address and see bars, distribution charts, and per-chain
 * breakdowns refreshing in real-time.
 */

import React from 'react';
import { CrossChainSupply } from '../components/CrossChainSupply';

export default function SupplyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">
            🌐 Cross-Chain Supply Tracker
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Track any ERC-20 token&apos;s total supply across{' '}
            <span className="text-blue-400">7 chains</span> simultaneously.
            See distribution, compare deployments, and spot supply discrepancies.
          </p>
        </div>

        {/* Supported Chains Banner */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {[
            { name: 'Base', icon: '🔵', color: 'border-blue-500' },
            { name: 'Arbitrum', icon: '🔷', color: 'border-sky-500' },
            { name: 'Mantle', icon: '⬛', color: 'border-zinc-500' },
            { name: 'Flow', icon: '🟢', color: 'border-green-500' },
            { name: 'Morph', icon: '🟣', color: 'border-purple-500' },
            { name: 'Chiliz', icon: '🔴', color: 'border-red-500' },
            { name: 'Scroll', icon: '📜', color: 'border-amber-500' },
          ].map((c) => (
            <span
              key={c.name}
              className={`inline-flex items-center gap-1.5 text-xs border ${c.color} bg-zinc-900 rounded-full px-3 py-1 text-zinc-300`}
            >
              {c.icon} {c.name}
            </span>
          ))}
        </div>

        {/* Main Component */}
        <CrossChainSupply />

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-5">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold text-white mb-1">Supply Discovery</h3>
            <p className="text-xs text-zinc-400">
              Scans all 7 configured chains for the given token address —
              instantly see where the token exists and supply amounts.
            </p>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-5">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold text-white mb-1">
              Distribution Analysis
            </h3>
            <p className="text-xs text-zinc-400">
              Visual breakdown of how supply is distributed across chains.
              Identify concentration risks or balanced deployments.
            </p>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-5">
            <div className="text-2xl mb-2">🔄</div>
            <h3 className="font-semibold text-white mb-1">Live Tracking</h3>
            <p className="text-xs text-zinc-400">
              Enable auto-refresh for real-time monitoring. Supply changes
              propagate across all chains with 30-second updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
