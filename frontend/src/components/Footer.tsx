"use client";
import Link from "next/link";

const Footer = ({ className }: { className?: string }) => (
  <footer className={`border-t border-[var(--border-subtle)] ${className || ''}`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#00d4aa] to-[#3b82f6] flex items-center justify-center">
              <span className="text-xs font-bold text-[#0a0e17]">P</span>
            </div>
            <span className="font-bold text-[var(--text-primary)]">PumpX</span>
          </div>
          <p className="text-sm text-[var(--text-muted)] max-w-xs">
            Decentralized financial intelligence platform. Permissionless prediction markets powered by on-chain resolution.
          </p>
        </div>

        {/* Protocol */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Protocol</h4>
          <div className="space-y-2">
            <Link href="/markets" className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors">Create Market</Link>
            <Link href="/markets/view" className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors">Explore Markets</Link>
            <Link href="/analytics" className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors">Analytics</Link>
            <Link href="/leaderboard" className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors">Leaderboard</Link>
          </div>
        </div>

        {/* Network */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Network</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Base Mainnet
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Base Sepolia
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-xs text-[var(--text-muted)]">
          &copy; {new Date().getFullYear()} PumpX. Built at Consensus 2026.
        </p>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--text-muted)]">v1.0.0</span>
          <a href="https://github.com/Meet2054/Consensus_HK" target="_blank" rel="noopener" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors">GitHub</a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
