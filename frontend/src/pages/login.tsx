/**
 * PumpX — Login Page
 * Glassmorphism, SIWE authentication, dark gradient background.
 */
import React, { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { hasWalletConnectProjectId } from '../wagmi';
import { LuShield, LuZap, LuLock, LuTrendingUp } from 'react-icons/lu';

const FEATURES = [
    { icon: LuTrendingUp, text: 'Predict stock & crypto milestones' },
    { icon: LuZap, text: 'Real-time PumpScore index' },
    { icon: LuShield, text: 'On-chain payouts, zero custody risk' },
    { icon: LuLock, text: 'Sign-In With Ethereum — no email, no password' },
];

export default function LoginPage() {
    const router = useRouter();
    const { isConnected } = useAccount();
    const { user, isLoading, isSigningIn, error, signIn } = useAuth();

    // If already logged in → redirect
    useEffect(() => {
        if (!isLoading && user?.isLoggedIn) {
            if (!user.hasProfile) {
                router.replace('/register');
            } else {
                const cb = typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/dashboard';
                router.replace(cb);
            }
        }
    }, [isLoading, user, router]);

    // NOTE: We intentionally do NOT auto-trigger signIn() on wallet connect.
    // The user must click the "Sign in" button themselves so the wallet popup
    // isn't blocked by the browser and doesn't race with the RainbowKit modal.

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
            {/* Ambient background orbs */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
                <div
                    className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
                />
                <div
                    className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-15 blur-[120px]"
                    style={{ background: 'radial-gradient(circle, #00d4aa, transparent 70%)' }}
                />
                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                        backgroundSize: '50px 50px',
                    }}
                />
            </div>

            <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center relative z-10">

                {/* ── Left: Branding ── */}
                <div className="hidden lg:flex flex-col gap-8 pr-8">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #00d4aa, #6366f1)' }}>
                            <span className="text-xl font-black" style={{ color: '#04060f' }}>P</span>
                        </div>
                        <span className="text-2xl font-bold text-[var(--text-primary)]">
                            Pump<span style={{ color: 'var(--accent-primary)' }}>X</span>
                        </span>
                    </div>

                    <div>
                        <h1 className="text-4xl font-black leading-tight text-[var(--text-primary)] mb-4">
                            The prediction<br />
                            market for<br />
                            <span className="gradient-text">everything real.</span>
                        </h1>
                        <p className="text-[var(--text-secondary)] text-lg leading-relaxed">
                            Bet on stock milestones, crypto moves, and real-world events.
                            Powered by blockchain. Settled on-chain.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {FEATURES.map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)' }}>
                                    <Icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                                </div>
                                <span className="text-sm text-[var(--text-secondary)]">{text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                        <div className="flex -space-x-2">
                            {['👤', '👤', '👤', '👤'].map((_, i) => (
                                <div key={i} className="w-8 h-8 rounded-full text-xs flex items-center justify-center"
                                    style={{ background: `hsl(${i * 60 + 180}, 40%, 20%)`, border: '2px solid var(--bg-base)', color: 'var(--text-muted)' }}>
                                    {String.fromCharCode(65 + i)}
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">
                            <span className="text-[var(--accent-primary)] font-semibold">2,400+</span> bettors active
                        </p>
                    </div>
                </div>

                {/* ── Right: Auth Card ── */}
                <div className="glass-panel p-8 md:p-10 w-full animate-scale-in">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #00d4aa, #6366f1)' }}>
                            <span className="text-lg font-black" style={{ color: '#04060f' }}>P</span>
                        </div>
                        <span className="text-xl font-bold text-[var(--text-primary)]">
                            Pump<span style={{ color: 'var(--accent-primary)' }}>X</span>
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                        Sign in to PumpX
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] mb-8">
                        Connect your wallet and sign a message to authenticate. No email or password needed.
                    </p>

                    {!hasWalletConnectProjectId && (
                        <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                            WalletConnect scan and browser-deeplink mode are disabled until you set a real
                            <span className="font-mono"> NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID </span>
                            in <span className="font-mono">frontend/.env.local</span>. MetaMask and other injected wallets still work.
                        </div>
                    )}

                    {/* Step indicator */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="flex-1">
                            <div className={`flex items-center gap-2 text-xs font-medium ${isConnected ? 'text-emerald-400' : 'text-[var(--accent-primary)]'}`}>
                                <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${isConnected ? 'bg-emerald-400/20 text-emerald-400' : 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                                    }`}>
                                    {isConnected ? '✓' : '1'}
                                </div>
                                Connect Wallet
                            </div>
                        </div>
                        <div className="w-8 h-px" style={{ background: 'var(--glass-border)' }} />
                        <div className="flex-1">
                            <div className={`flex items-center gap-2 text-xs font-medium ${user?.isLoggedIn ? 'text-emerald-400' : isConnected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                                <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${user?.isLoggedIn ? 'bg-emerald-400/20 text-emerald-400' :
                                    isConnected ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' :
                                        'bg-[var(--glass-border)] text-[var(--text-muted)]'
                                    }`}>
                                    {user?.isLoggedIn ? '✓' : '2'}
                                </div>
                                Sign Message
                            </div>
                        </div>
                    </div>

                    {/* Wallet connect button */}
                    <div className="mb-4">
                        <ConnectButton.Custom>
                            {({ account, chain: walletChain, openConnectModal, mounted }) => {
                                if (!mounted) return null;

                                if (!account) {
                                    return (
                                        <button
                                            onClick={openConnectModal}
                                            className="btn-primary w-full text-center py-3.5 text-base"
                                        >
                                            Connect Wallet
                                        </button>
                                    );
                                }

                                return (
                                    <div className="space-y-3">
                                        <button
                                            onClick={signIn}
                                            disabled={isSigningIn}
                                            className="btn-primary w-full text-center py-3.5 text-base disabled:opacity-60 disabled:cursor-wait"
                                        >
                                            {isSigningIn ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="w-4 h-4 border-2 border-[#04060f]/30 border-t-[#04060f] rounded-full animate-spin" />
                                                    Check your wallet for signature popup…
                                                </span>
                                            ) : (
                                                `Sign in as ${account.displayName}`
                                            )}
                                        </button>
                                        {isSigningIn && (
                                            <p className="text-xs text-center text-[var(--text-muted)]">
                                                Don't see a popup? Check your wallet extension or try clicking the button again.
                                            </p>
                                        )}
                                    </div>
                                );
                            }}
                        </ConnectButton.Custom>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-xl text-sm text-red-400 mb-4 animate-fade-in"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {error}
                        </div>
                    )}

                    {/* Divider + info */}
                    <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--glass-border)' }}>
                        <p className="text-center text-xs text-[var(--text-muted)]">
                            By signing in, you agree to our{' '}
                            <a href="#" className="text-[var(--accent-primary)] hover:underline">Terms</a>
                            {' '}and{' '}
                            <a href="#" className="text-[var(--accent-primary)] hover:underline">Privacy Policy</a>.
                        </p>
                        <p className="text-center text-[10px] text-[var(--text-muted)] mt-3 flex items-center justify-center gap-1.5">
                            <LuLock className="w-3 h-3" />
                            Your wallet signature is validated server-side. We never access your funds.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
