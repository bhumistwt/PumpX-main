import type { NextPage } from "next";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { LiveIndicator } from "../components/ui/primitives";
import { LuArrowRight, LuShield, LuZap, LuGlobe, LuBarChart3, LuTrendingUp, LuLock } from "react-icons/lu";

// Animated counter hook
function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

const FEATURES = [
  { icon: LuGlobe, title: "Permissionless Markets", desc: "Anyone can create prediction markets on any ERC-20 token. No oracle restrictions." },
  { icon: LuShield, title: "On-Chain Resolution", desc: "Markets resolve transparently using verifiable on-chain supply data." },
  { icon: LuZap, title: "Instant Settlement", desc: "Claim winnings immediately after resolution. No delays, no intermediaries." },
  { icon: LuLock, title: "Non-Custodial", desc: "Your funds stay in audited smart contracts. Full self-custody at all times." },
  { icon: LuBarChart3, title: "Real-Time Analytics", desc: "Live market depth, whale tracking, and sentiment visualization." },
  { icon: LuTrendingUp, title: "Multi-Chain Ready", desc: "Deployed on Base with expansion to Arbitrum, Mantle, and more." },
];

const Home: NextPage = () => {
  const [stats, setStats] = React.useState({ activeMarkets: 0, totalEthVolume: 0, totalUsers: 0 });

  React.useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => setStats({
        activeMarkets: d.activeMarkets ?? 0,
        totalEthVolume: d.totalEthVolume ?? 0,
        totalUsers: d.totalUsers ?? 0,
      }))
      .catch(() => { });
  }, []);

  const marketsCount = useCountUp(stats.activeMarkets);
  const volumeCount = useCountUp(Math.round(stats.totalEthVolume * 1000) / 1000, 1500);
  const usersCount = useCountUp(stats.totalUsers);

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <LiveIndicator label="Live on Base" />
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Decentralized{" "}
            <span className="gradient-text">Financial Intelligence</span>
            {" "}Platform
          </h1>

          <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Create permissionless prediction markets on any token. Stake positions with ETH.
            Earn from accurate market forecasts. Fully on-chain, fully transparent.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/markets">
              <button className="btn-primary flex items-center gap-2 text-base px-8 py-4">
                Create Market <LuArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/markets/view">
              <button className="btn-secondary flex items-center gap-2 text-base px-8 py-4">
                Explore Markets
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Live Stats Ticker */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="card p-6 text-center">
            <p className="text-3xl font-bold font-mono-data text-[var(--accent-primary)]">{marketsCount}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Active Markets</p>
          </div>
          <div className="card p-6 text-center">
            <p className="text-3xl font-bold font-mono-data text-[var(--accent-primary)]">{volumeCount} ETH</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Total Volume</p>
          </div>
          <div className="card p-6 text-center">
            <p className="text-3xl font-bold font-mono-data text-[var(--accent-primary)]">{usersCount.toLocaleString()}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Unique Predictors</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Built for Serious Predictors</h2>
          <p className="text-[var(--text-muted)]">Institutional-grade infrastructure, permissionless access</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="card p-6 group hover:border-[var(--accent-primary)]/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-5 h-5 text-[var(--accent-primary)]" />
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="pb-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">How It Works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: "01", title: "Enter Token", desc: "Paste any ERC-20 contract address to validate" },
            { step: "02", title: "Set Conditions", desc: "Define supply threshold and deadline" },
            { step: "03", title: "Deploy On-Chain", desc: "Smart contract created via MarketFactory" },
            { step: "04", title: "Trade & Resolve", desc: "Bet YES/NO with ETH, claim winnings" },
          ].map((item, i) => (
            <div key={i} className="relative">
              <div className="card p-6 text-center">
                <span className="text-3xl font-bold text-[var(--accent-primary)]/20 font-mono">{item.step}</span>
                <h3 className="font-semibold mt-2 mb-1">{item.title}</h3>
                <p className="text-sm text-[var(--text-muted)]">{item.desc}</p>
              </div>
              {i < 3 && (
                <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-[var(--text-muted)]">
                  <LuArrowRight className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
