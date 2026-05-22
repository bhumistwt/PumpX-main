/**
 * PumpX — Voice Toggle Component
 *
 * Polished toggle button for enabling/disabling AI voice output.
 * Matches the existing fintech design language.
 */

import React from 'react';
import { LuVolume2, LuVolumeX } from 'react-icons/lu';

interface VoiceToggleProps {
    isEnabled: boolean;
    isSpeaking: boolean;
    isSupported: boolean;
    onToggle: (enabled: boolean) => void;
    /** Render as a compact inline button */
    compact?: boolean;
}

export function VoiceToggle({
    isEnabled,
    isSpeaking,
    isSupported,
    onToggle,
    compact = false,
}: VoiceToggleProps) {
    if (!isSupported) return null;

    if (compact) {
        return (
            <button
                onClick={() => onToggle(!isEnabled)}
                className={`relative flex items-center gap-1 text-[10px] transition-colors ${isEnabled
                        ? 'text-[var(--accent-primary)] hover:text-white'
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                title={isEnabled ? 'Disable voice output' : 'Enable voice output'}
            >
                {isEnabled ? (
                    <LuVolume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-pulse' : ''}`} />
                ) : (
                    <LuVolumeX className="w-3.5 h-3.5" />
                )}
                <span>{isEnabled ? 'Voice On' : 'Voice Off'}</span>
                {isSpeaking && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--accent-primary)] rounded-full animate-pulse" />
                )}
            </button>
        );
    }

    return (
        <button
            onClick={() => onToggle(!isEnabled)}
            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${isEnabled
                    ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20'
                    : 'bg-[var(--bg-elevated)] border-white/5 text-[var(--text-muted)] hover:border-white/10 hover:text-white'
                }`}
            title={isEnabled ? 'Disable voice output' : 'Enable voice output'}
        >
            {isEnabled ? (
                <LuVolume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
            ) : (
                <LuVolumeX className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isEnabled ? 'Voice On' : 'Voice Off'}</span>
            {isSpeaking && (
                <>
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-pulse" />
                    {/* Speaking wave animation */}
                    <div className="flex items-center gap-[2px] ml-0.5">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="w-[2px] bg-[var(--accent-primary)] rounded-full animate-pulse"
                                style={{
                                    height: `${6 + i * 3}px`,
                                    animationDelay: `${i * 0.15}s`,
                                }}
                            />
                        ))}
                    </div>
                </>
            )}
        </button>
    );
}

export default VoiceToggle;
