/**
 * PumpX — Text-to-Speech Hook
 *
 * Browser-native SpeechSynthesis for AI voice output.
 * Zero-cost, zero-latency, works offline.
 *
 * Features:
 *  - Automatic markdown/emoji stripping for natural speech
 *  - Preferred voice selection (Google/Microsoft English voices)
 *  - Toggle persisted to localStorage
 *  - Non-blocking, fire-and-forget speak()
 *  - Cancels previous speech when new one is queued
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const LS_KEY = 'pumpx-tts-enabled';

// ── Text cleaning for natural speech ────────────────────

function cleanTextForSpeech(text: string): string {
    let cleaned = text;

    // Remove markdown bold/italic
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/_(.+?)_/g, '$1');

    // Remove markdown headers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // Remove bullet/list prefixes
    cleaned = cleaned.replace(/^[\s]*[-•·]\s+/gm, '');
    cleaned = cleaned.replace(/^\d+\.\s+/gm, '');

    // Remove emoji (common Unicode ranges)
    cleaned = cleaned.replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu,
        ''
    );

    // Remove common text-emoji like ✅ ❌ ⚡ 🔥 📊 📈 📁 🏷 💰 🟢 🔴 🌐 🛡 🎙
    cleaned = cleaned.replace(/[✅❌⚡🔥📊📈📁🏷💰🟢🔴🌐🛡🎙⏳🔗]/g, '');

    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/\S+/g, '');

    // Remove hex addresses (0x...)
    cleaned = cleaned.replace(/0x[a-fA-F0-9]{6,}/g, 'address');

    // Clean up multiple spaces/newlines
    cleaned = cleaned.replace(/\n{2,}/g, '. ');
    cleaned = cleaned.replace(/\n/g, '. ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');

    // Remove leading/trailing whitespace and dots
    cleaned = cleaned.replace(/^[\s.]+|[\s.]+$/g, '');

    return cleaned;
}

// ── Voice selection ─────────────────────────────────────

function selectBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices.length) return null;

    const englishVoices = voices.filter(
        (v) => v.lang.startsWith('en')
    );

    if (!englishVoices.length) return voices[0];

    // Prefer female voices for a softer, polite tone
    const PREFERRED_FEMALE = [
        'Google UK English Female',     // Chrome — clear & polite
        'Google US English',            // Chrome fallback (often female)
        'Microsoft Zira',               // Windows — female
        'Microsoft Aria',               // Windows 11 — natural female
        'Microsoft Jenny',              // Windows 11 — natural female
        'Samantha',                     // macOS — female
        'Karen',                        // macOS — Australian female
        'Moira',                        // macOS — Irish female
        'Tessa',                        // macOS — South African female
    ];

    for (const name of PREFERRED_FEMALE) {
        const match = englishVoices.find((v) => v.name.includes(name));
        if (match) return match;
    }

    // Fallback: any female-sounding network voice
    const networkVoice = englishVoices.find((v) => !v.localService);
    if (networkVoice) return networkVoice;

    return englishVoices[0];
}

// ── Hook ────────────────────────────────────────────────

export interface UseTextToSpeechReturn {
    /** Speak the given text (auto-cleans markdown/emoji). Cancels any in-progress speech. */
    speak: (text: string) => void;
    /** Stop any in-progress speech immediately */
    stop: () => void;
    /** Whether the browser is currently speaking */
    isSpeaking: boolean;
    /** Whether TTS is enabled (user preference) */
    isEnabled: boolean;
    /** Toggle TTS on/off (persisted to localStorage) */
    setEnabled: (enabled: boolean) => void;
    /** Whether the browser supports SpeechSynthesis */
    isSupported: boolean;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
    // Defer to useEffect so server + first client render both return false (no hydration mismatch)
    const [isSupported, setIsSupported] = useState(false);
    const [isEnabled, setEnabledState] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Detect support + load persisted preference after hydration
    useEffect(() => {
        const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
        setIsSupported(supported);
        const stored = localStorage.getItem(LS_KEY);
        if (stored !== null) {
            setEnabledState(stored === 'true');
        }
    }, []);

    // Load voices (they load async in some browsers)
    useEffect(() => {
        if (!isSupported) return;

        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            voiceRef.current = selectBestVoice(voices);
        };

        loadVoices();
        window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        return () => {
            window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
        };
    }, [isSupported]);

    // Persist preference
    const setEnabled = useCallback((enabled: boolean) => {
        setEnabledState(enabled);
        localStorage.setItem(LS_KEY, String(enabled));
        if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, []);

    // Speak
    const speak = useCallback(
        (text: string) => {
            if (!isSupported || !isEnabled) return;

            const cleaned = cleanTextForSpeech(text);
            if (!cleaned.trim()) return;

            // Cancel any current speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(cleaned);
            utterance.rate = 1.0;    // Natural speaking pace
            utterance.pitch = 1.1;   // Slightly higher for feminine tone
            utterance.volume = 0.85; // Softer, not loud

            if (voiceRef.current) {
                utterance.voice = voiceRef.current;
            }

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);

            utteranceRef.current = utterance;

            // Chrome bug workaround: resume after cancel
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 50);
        },
        [isSupported, isEnabled]
    );

    // Stop
    const stop = useCallback(() => {
        if (!isSupported) return;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }, [isSupported]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isSupported) {
                window.speechSynthesis.cancel();
            }
        };
    }, [isSupported]);

    return {
        speak,
        stop,
        isSpeaking,
        isEnabled,
        setEnabled,
        isSupported,
    };
}
