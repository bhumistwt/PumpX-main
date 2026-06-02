import React from 'react';
import Link from 'next/link';
import { LuShield, LuExternalLink, LuFlaskConical, LuCalendar, LuFileCode2 } from 'react-icons/lu';
import {
  getFactoryAddress,
  getFactoryExplorerUrl,
  SECURITY_META,
} from '../../constants/security';

function formatDeployDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SecuritySection() {
  const factoryAddress = getFactoryAddress();
  const explorerUrl = getFactoryExplorerUrl();
  const deployLabel = formatDeployDate(SECURITY_META.deployedAt);

  return (
    <section id="security" className="pb-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <LuShield className="w-3.5 h-3.5" />
          Security
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">Transparent &amp; On-Chain</h2>
        <p className="text-[var(--text-muted)] max-w-xl mx-auto">
          Core protocol contracts on {SECURITY_META.networkLabel}. Verify addresses, tests, and deployment history.
        </p>
      </div>

      <div className="card p-6 sm:p-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Contract */}
          <div className="sm:col-span-2 p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              <LuFileCode2 className="w-3.5 h-3.5" />
              {SECURITY_META.contractName} on {SECURITY_META.networkLabel}
            </div>
            <p className="font-mono text-sm text-[var(--text-primary)] break-all">{factoryAddress}</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-[var(--accent-primary)] hover:underline"
            >
              View on Basescan
              <LuExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Foundry tests */}
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              <LuFlaskConical className="w-3.5 h-3.5" />
              Smart contract tests
            </div>
            <Link
              href={SECURITY_META.foundryTestsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/15 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Foundry tests
              <LuExternalLink className="w-3 h-3 opacity-70" />
            </Link>
            <p className="text-xs text-[var(--text-muted)] mt-2">{SECURITY_META.foundryTestsLabel}</p>
          </div>

          {/* Deployment date */}
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              <LuCalendar className="w-3.5 h-3.5" />
              Deployment date
            </div>
            <p className="text-lg font-semibold text-[var(--text-primary)] font-mono-data">{deployLabel}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">MarketFactory proxy deployment</p>
          </div>
        </div>

        {/* Audit badge */}
        <div className="mt-6 pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            Third-party security review is scheduled. Contracts are non-upgradeable and open source.
          </p>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/35 shrink-0">
            <LuShield className="w-4 h-4" />
            Pending Audit
          </span>
        </div>
      </div>
    </section>
  );
}
