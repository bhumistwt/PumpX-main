/**
 * PumpX — Register Page
 * User profile setup after first wallet connect.
 * Shown when isLoggedIn=true but hasProfile=false.
 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { z } from 'zod';
import { LuUser, LuCheck, LuArrowRight, LuAtSign } from 'react-icons/lu';

const usernameSchema = z
    .string()
    .min(3, 'At least 3 characters')
    .max(30, 'At most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only');

const AVATAR_EMOJIS = ['🚀', '💎', '🔮', '⚡', '🦊', '🐉', '🌊', '🔥', '🦋', '🎯', '🏆', '🌟'];

export default function RegisterPage() {
    const router = useRouter();
    const { user, isLoading, refetch } = useAuth();

    const [username, setUsername] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Guard: must be logged in
    useEffect(() => {
        if (!isLoading && !user?.isLoggedIn) {
            router.replace('/login');
        }
        if (!isLoading && user?.hasProfile) {
            router.replace('/dashboard');
        }
    }, [isLoading, user, router]);

    const handleUsernameChange = (val: string) => {
        setUsername(val);
        const result = usernameSchema.safeParse(val);
        setValidationError(result.success ? null : result.error.issues[0].message);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError(null);

        const result = usernameSchema.safeParse(username);
        if (!result.success) {
            setValidationError(result.error.issues[0].message);
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: result.data, avatarUrl: selectedAvatar }),
            });

            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) {
                    setServerError('That username is taken. Try another.');
                } else if (res.status === 503) {
                    setServerError(data.error ?? 'Database is unavailable. Fix your Supabase connection string or click Skip for now.');
                } else {
                    setServerError(data.error ?? 'Failed to save profile. Please try again.');
                }
                return;
            }

            setSuccess(true);
            await refetch();

            setTimeout(() => {
                router.replace('/dashboard');
            }, 1200);
        } catch {
            setServerError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
                <div className="w-8 h-8 border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
            {/* Background orbs */}
            <div className="pointer-events-none fixed inset-0" aria-hidden>
                <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
                <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] rounded-full opacity-12 blur-[100px]"
                    style={{ background: 'radial-gradient(circle, #70e000, transparent 70%)' }} />
            </div>

            <div className="w-full max-w-md relative z-10 animate-scale-in">
                <div className="glass-panel p-8 md:p-10">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
                            style={{ background: 'linear-gradient(135deg, rgba(112,224,0,0.2), rgba(99,102,241,0.2))', border: '1px solid var(--glass-border)' }}>
                            {selectedAvatar ?? '👤'}
                        </div>
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Almost there!</h1>
                        <p className="text-sm text-[var(--text-secondary)]">
                            Set up your PumpX profile to start predicting.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <LuAtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => handleUsernameChange(e.target.value)}
                                    placeholder="pumpx_trader"
                                    maxLength={30}
                                    className="glass-input pl-10 pr-10"
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                                {username.length >= 3 && !validationError && (
                                    <LuCheck className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                                )}
                            </div>
                            {validationError && username.length > 0 && (
                                <p className="text-xs text-red-400 mt-1.5 animate-fade-in">{validationError}</p>
                            )}
                            {!validationError && username.length > 0 && (
                                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                                    Will display as <span className="text-[var(--accent-primary)] font-medium">@{username}</span>
                                </p>
                            )}
                        </div>

                        {/* Avatar picker */}
                        <div>
                            <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                                Avatar (optional)
                            </label>
                            <div className="grid grid-cols-6 gap-2">
                                {AVATAR_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setSelectedAvatar(selectedAvatar === emoji ? null : emoji)}
                                        className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${selectedAvatar === emoji
                                            ? 'ring-2 ring-[var(--accent-primary)] scale-110'
                                            : 'hover:scale-105'
                                            }`}
                                        style={{
                                            background: selectedAvatar === emoji
                                                ? 'rgba(112,224,0,0.15)'
                                                : 'rgba(255,255,255,0.04)',
                                            border: '1px solid var(--glass-border)',
                                        }}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Wallet address display */}
                        {user?.address && (
                            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                                <LuUser className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Connected as</p>
                                    <p className="text-xs font-mono text-[var(--text-secondary)] truncate">
                                        {user.address.slice(0, 10)}…{user.address.slice(-8)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Server error */}
                        {serverError && (
                            <div className="p-3 rounded-xl text-sm text-red-400 animate-fade-in"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                {serverError}
                            </div>
                        )}

                        {/* Success */}
                        {success && (
                            <div className="p-3 rounded-xl text-sm text-emerald-400 animate-fade-in flex items-center gap-2"
                                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <LuCheck className="w-4 h-4 shrink-0" />
                                Profile created! Redirecting to dashboard…
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting || success || !!validationError || username.length < 3}
                            className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-[#04060f]/30 border-t-[#04060f] rounded-full animate-spin" />
                                    Saving profile…
                                </>
                            ) : (
                                <>
                                    Create Profile
                                    <LuArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>

                        {/* Skip option — lets users proceed when DB is down or they want to setup later */}
                        <button
                            type="button"
                            onClick={() => router.replace('/dashboard')}
                            className="w-full py-2.5 text-sm text-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                            Skip for now →
                        </button>
                    </form>
                </div>

                {/* Footer note */}
                <p className="text-center text-xs text-[var(--text-muted)] mt-4">
                    Your profile is linked to your wallet address. You can update it later in settings.
                </p>
            </div>
        </div>
    );
}
