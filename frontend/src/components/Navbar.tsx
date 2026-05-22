import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import {
  LuAlignJustify, LuX, LuTrendingUp, LuPlusCircle, LuLayoutDashboard,
  LuTrophy, LuBot, LuGamepad2, LuFlame, LuShield, LuGitBranch, LuGlobe,
  LuGauge, LuGlobe2, LuBarChart2, LuChevronDown, LuLogIn, LuLogOut, LuUser,
} from 'react-icons/lu';
import { XPBar } from './gamification/XPBar';
import { StreakCounter } from './gamification/StreakCounter';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '../hooks/useAuth';

// ── Nav groups ────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Markets',
    href: null,
    items: [
      { href: '/markets', label: 'Create Market', icon: LuPlusCircle },
      { href: '/markets/view', label: 'Browse Markets', icon: LuTrendingUp },
      { href: '/heatmap', label: 'Sentiment Heatmap', icon: LuFlame },
      { href: '/conditional', label: 'Chain Bets', icon: LuGitBranch },
      { href: '/hedge', label: 'Hedge', icon: LuShield },
    ],
  },
  {
    label: 'Intelligence',
    href: null,
    items: [
      { href: '/intelligence', label: 'Stock Intel', icon: LuBarChart2 },
      { href: '/live-markets', label: 'Live Markets', icon: LuGlobe2 },
      { href: '/pumpscore', label: 'PumpScore', icon: LuGauge },
      { href: '/supply', label: 'Supply Track', icon: LuGlobe },
      { href: '/assistant', label: 'AI Assistant', icon: LuBot },
    ],
  },
  {
    label: 'Profile',
    href: null,
    items: [
      { href: '/dashboard', label: 'My Dashboard', icon: LuLayoutDashboard },
      { href: '/leaderboard', label: 'Leaderboard', icon: LuTrophy },
      { href: '/gamification', label: 'Achievements', icon: LuGamepad2 },
      { href: '/analytics', label: 'Analytics', icon: LuBarChart2 },
    ],
  },
] as const;

// Admin-only extra items (injected at runtime)
const ADMIN_ITEMS = [
  { href: '/admin', label: 'Admin Console', icon: LuShield },
] as const;

// ── Dropdown component ────────────────────────────────────────

function NavDropdown({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: readonly { href: string; label: string; icon: React.ElementType }[];
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = items.some((i) => currentPath === i.href || currentPath.startsWith(i.href + '/'));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive
          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass)]'
          }`}
      >
        {label}
        <LuChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 w-52 rounded-2xl p-1.5 z-50 animate-scale-in"
          style={{
            background: 'rgba(8,13,26,0.92)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
        >
          {items.map(({ href, label: itemLabel, icon: Icon }) => {
            const active = currentPath === href || currentPath.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${active
                  ? 'bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {itemLabel}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const { isConnected } = useAccount();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'shadow-lg shadow-black/20' : ''
        }`}
      style={{
        background: scrolled
          ? 'rgba(4,6,15,0.88)'
          : 'rgba(4,6,15,0.60)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--glass-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00d4aa, #6366f1)' }}>
              <span className="text-sm font-black" style={{ color: '#04060f' }}>P</span>
            </div>
            <span className="text-base font-bold text-[var(--text-primary)] hidden sm:block">
              Pump<span style={{ color: 'var(--accent-primary)' }}>X</span>
            </span>
          </Link>

          {/* Desktop nav */}
          {isConnected && (
            <div className="hidden md:flex items-center gap-1">
              {NAV_GROUPS.map((group) => (
                <NavDropdown
                  key={group.label}
                  label={group.label}
                  items={group.items}
                  currentPath={router.pathname}
                />
              ))}
              {/* Admin-only link */}
              {user?.role === 'ADMIN' && (
                <NavDropdown
                  label="Admin"
                  items={ADMIN_ITEMS}
                  currentPath={router.pathname}
                />
              )}
            </div>
          )}

          {/* Right section */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Gamification indicators */}
            {isConnected && (
              <div className="hidden lg:flex items-center gap-2">
                <XPBar compact />
                <StreakCounter compact />
              </div>
            )}

            {/* Auth: wallet + login/logout */}
            {isConnected ? (
              <>
                <ConnectButton
                  showBalance={false}
                  chainStatus="icon"
                  accountStatus={{ smallScreen: 'avatar', largeScreen: 'avatar' }}
                />
                {user?.username && (
                  <span className="hidden md:block text-xs font-medium text-[var(--text-secondary)]">
                    @{user.username}
                  </span>
                )}
                <button
                  onClick={signOut}
                  className="btn-ghost p-2 rounded-xl"
                  title="Sign out"
                >
                  <LuLogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-secondary flex items-center gap-2 py-2 px-4">
                <LuLogIn className="w-4 h-4" />
                <span className="hidden sm:block text-sm">Sign In</span>
              </Link>
            )}

            {/* Mobile burger */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-xl text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
            >
              {isMenuOpen ? <LuX className="w-5 h-5" /> : <LuAlignJustify className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div
          className="md:hidden border-t animate-slide-up overflow-y-auto max-h-[80vh]"
          style={{
            background: 'rgba(4,6,15,0.97)',
            backdropFilter: 'blur(24px)',
            borderColor: 'var(--glass-border)',
          }}
        >
          <div className="px-4 py-4 space-y-1">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] px-3 mb-1">
                  {group.label}
                </p>
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = router.pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${active
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/4'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            ))}

            {/* Sign out in mobile */}
            {isConnected && (
              <button
                onClick={() => { signOut(); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-400 hover:bg-red-400/5 transition-colors mt-2"
              >
                <LuLogOut className="w-4 h-4" />
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
