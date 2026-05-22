/**
 * PumpX — Voice-to-Market Component
 *
 * Allows users to speak their prediction market idea.
 * Captures voice via Web Speech API → sends to AI for parsing → auto-fills form.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LuMic, LuMicOff, LuSquare, LuSparkles, LuLoader2, LuAlertTriangle, LuWaves } from 'react-icons/lu';
import { useVoice } from '../hooks/useVoice';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const voice = useVoice();
  const [submitted, setSubmitted] = useState(false);

  // Auto-submit when user stops speaking
  useEffect(() => {
    if (!voice.isListening && voice.transcript && !submitted) {
      setSubmitted(true);
      onTranscript(voice.transcript);
    }
  }, [voice.isListening, voice.transcript, submitted, onTranscript]);

  const handleToggle = () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      setSubmitted(false);
      voice.startListening();
    }
  };

  if (!voice.isSupported) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <LuMicOff className="w-3.5 h-3.5" />
        Voice not supported in this browser
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Voice Button */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl border transition-all ${
          voice.isListening
            ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
            : 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/20'
        } disabled:opacity-40`}
      >
        {voice.isListening ? (
          <>
            <div className="relative">
              <LuMic className="w-6 h-6 text-red-400" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-red-400">Listening...</p>
              <p className="text-[10px] text-[var(--text-muted)]">Click to stop</p>
            </div>
            {/* Audio visualization bars */}
            <div className="flex items-center gap-0.5 ml-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="w-0.5 bg-red-400 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 16}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <LuMic className="w-6 h-6 text-[var(--accent-primary)]" />
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--accent-primary)]">Speak Your Market</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                Describe your prediction in plain English
              </p>
            </div>
          </>
        )}
      </button>

      {/* Live Transcript */}
      {(voice.transcript || voice.interimTranscript) && (
        <div className="bg-[var(--bg-elevated)] border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <LuWaves className="w-3 h-3 text-[var(--accent-primary)]" />
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Transcript</span>
          </div>
          <p className="text-sm text-white">
            {voice.transcript}
            {voice.interimTranscript && (
              <span className="text-[var(--text-muted)] italic">{voice.interimTranscript}</span>
            )}
          </p>
        </div>
      )}

      {/* Error */}
      {voice.error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/5 border border-red-400/10 px-3 py-2 rounded-lg">
          <LuAlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {voice.error}
        </div>
      )}

      {/* Tips */}
      {!voice.isListening && !voice.transcript && (
        <div className="text-[10px] text-[var(--text-muted)] space-y-1">
          <p className="font-medium">Example phrases:</p>
          <p>&ldquo;Create a market for PEPE reaching 1 trillion supply by June&rdquo;</p>
          <p>&ldquo;Bet on DOGE token hitting 200 billion supply next month&rdquo;</p>
          <p>&ldquo;Will the new token at 0x123 pass 10 million supply by April?&rdquo;</p>
        </div>
      )}
    </div>
  );
}

/** Compact voice button for embedding in other components */
export function VoiceButton({ onTranscript, className }: { onTranscript: (text: string) => void; className?: string }) {
  const voice = useVoice();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!voice.isListening && voice.transcript && !submitted) {
      setSubmitted(true);
      onTranscript(voice.transcript);
    }
  }, [voice.isListening, voice.transcript, submitted, onTranscript]);

  if (!voice.isSupported) return null;

  return (
    <button
      onClick={() => {
        if (voice.isListening) {
          voice.stopListening();
        } else {
          setSubmitted(false);
          voice.startListening();
        }
      }}
      className={`p-2 rounded-lg transition-colors ${
        voice.isListening
          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--accent-primary)]'
      } ${className || ''}`}
      title={voice.isListening ? 'Stop listening' : 'Voice input'}
    >
      {voice.isListening ? (
        <div className="relative">
          <LuMic className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        </div>
      ) : (
        <LuMic className="w-4 h-4" />
      )}
    </button>
  );
}
