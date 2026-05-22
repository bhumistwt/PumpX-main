/**
 * PumpX AI Layer — Chat Components
 *
 * Professional fintech chat UI with:
 * - Message bubbles (user/bot/system/action/attestation/error)
 * - Transaction preview cards
 * - Confirm/Cancel action buttons
 * - Typing indicator
 * - Auto-scroll
 * - Mobile responsive
 */

import React, { useRef, useEffect, useState } from 'react';
import type { ChatMessage, ActionPayload, AttestationPayload, ActionSummary } from '../../lib/ai/types';
import { VoiceToggle } from './VoiceToggle';
import {
  LuBot,
  LuUser,
  LuCheck,
  LuX,
  LuExternalLink,
  LuShieldCheck,
  LuShieldAlert,
  LuAlertTriangle,
  LuLoader2,
  LuSend,
  LuTrash2,
  LuInfo,
} from 'react-icons/lu';

// ── Message Bubble ─────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  switch (msg.type) {
    case 'user':
      return (
        <div className="flex justify-end mb-3 animate-fade-in">
          <div className="max-w-[80%] sm:max-w-[70%]">
            <div className="bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/20 rounded-2xl rounded-br-md px-4 py-2.5">
              <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
            </div>
            <p className="text-[9px] text-[var(--text-muted)] mt-1 text-right">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      );

    case 'bot':
      return (
        <div className="flex gap-2.5 mb-3 animate-fade-in">
          <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center shrink-0 mt-0.5">
            <LuBot className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <div className="max-w-[80%] sm:max-w-[70%]">
            <div className="bg-[var(--bg-elevated)] border border-white/5 rounded-2xl rounded-bl-md px-4 py-2.5">
              <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed ai-message-content">
                {formatMessageContent(msg.content)}
              </div>
            </div>
            <p className="text-[9px] text-[var(--text-muted)] mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      );

    case 'system':
      return (
        <div className="flex justify-center mb-3 animate-fade-in">
          <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-white/5 rounded-full px-3 py-1 flex items-center gap-1.5">
            {msg.content === 'Thinking...' && (
              <LuLoader2 className="w-3 h-3 animate-spin" />
            )}
            {msg.content}
          </span>
        </div>
      );

    case 'action':
      return msg.action ? <ActionCard action={msg.action} /> : null;

    case 'attestation':
      return msg.attestation ? <AttestationCard attestation={msg.attestation} /> : null;

    case 'error':
      return (
        <div className="flex gap-2.5 mb-3 animate-fade-in">
          <div className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <LuAlertTriangle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[80%]">
            <p className="text-sm text-red-300">{msg.content}</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ── Format markdown-lite content ───────────────────────

function formatMessageContent(content: string): React.ReactNode {
  // Split by ** for bold
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Action Card (Transaction Preview) ──────────────────

function ActionCard({ action }: { action: ActionPayload }) {
  return (
    <div className="flex gap-2.5 mb-3 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <LuShieldCheck className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-card)] border border-amber-500/15 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400">⚡ Transaction Preview</span>
              <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-elevated)] rounded-full px-2 py-0.5">
                {action.status === 'pending_confirmation' ? 'AWAITING CONFIRMATION' :
                  action.status === 'executing' ? 'EXECUTING...' : action.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-white font-medium mt-1">{action.displayName}</p>
          </div>

          {/* Summary rows */}
          <div className="px-4 py-3 space-y-2">
            {action.summary.map((row, i) => (
              <div key={i} className="flex justify-between items-start text-xs">
                <span className="text-[var(--text-muted)] shrink-0">{row.label}</span>
                <span className={`text-right ml-3 font-mono ${row.highlight ? 'text-white font-medium' : 'text-[var(--text-secondary)]'
                  } ${row.label.includes('Warning') ? 'text-amber-400' : ''}`}>
                  {row.value.length > 42 ? `${row.value.slice(0, 6)}...${row.value.slice(-4)}` : row.value}
                </span>
              </div>
            ))}
            {action.estimatedGas && (
              <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-[var(--text-muted)]">Est. Gas</span>
                <span className="text-[var(--text-secondary)] font-mono">{action.estimatedGas}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Attestation Card (Success) ─────────────────────────

function AttestationCard({ attestation }: { attestation: AttestationPayload }) {
  return (
    <div className="flex gap-2.5 mb-3 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <LuCheck className="w-3.5 h-3.5 text-emerald-400" />
      </div>
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-card)] border border-emerald-500/15 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-emerald-500/5 border-b border-emerald-500/10">
            <span className="text-xs font-semibold text-emerald-400">✅ Transaction Confirmed</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {attestation.summary.map((row, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">{row.label}</span>
                <span className="text-[var(--text-secondary)] font-mono">
                  {row.value.length > 42 ? `${row.value.slice(0, 6)}...${row.value.slice(-4)}` : row.value}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-white/5">
            <a
              href={attestation.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] text-[var(--accent-primary)] hover:underline font-medium"
            >
              View on Explorer <LuExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reputation Badge ───────────────────────────────────

export function ReputationBadge({
  trustLevel,
  score,
  size = 'sm',
}: {
  trustLevel: 'trusted' | 'neutral' | 'caution' | 'flagged';
  score: number;
  size?: 'sm' | 'md';
}) {
  const config = {
    trusted: { icon: LuShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', label: 'Trusted' },
    neutral: { icon: LuInfo, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', label: 'Neutral' },
    caution: { icon: LuAlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', label: 'Caution' },
    flagged: { icon: LuShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Flagged' },
  }[trustLevel];

  const Icon = config.icon;
  const isSmall = size === 'sm';

  return (
    <div className={`inline-flex items-center gap-1 ${config.bg} ${config.border} border rounded-full ${isSmall ? 'px-2 py-0.5' : 'px-3 py-1'}`}>
      <Icon className={`${config.color} ${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      <span className={`${config.color} font-medium ${isSmall ? 'text-[9px]' : 'text-[10px]'}`}>
        {config.label}
      </span>
      <span className={`text-[var(--text-muted)] font-mono ${isSmall ? 'text-[8px]' : 'text-[9px]'}`}>
        {score}
      </span>
    </div>
  );
}

// ── Chat Input Bar ─────────────────────────────────────

export function ChatInput({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={disabled}
        placeholder={placeholder || 'Ask PumpX AI anything...'}
        className="input flex-1 text-sm bg-[var(--bg-elevated)] border-white/5 focus:border-[var(--accent-primary)]/30"
        autoFocus
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className="btn-primary px-3 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <LuSend className="w-4 h-4" />
      </button>
    </form>
  );
}

// ── Confirm/Cancel Buttons ─────────────────────────────

export function ActionButtons({
  onConfirm,
  onCancel,
  isExecuting,
  confirmLabel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
  confirmLabel?: string;
}) {
  return (
    <div className="flex gap-2 mb-3 ml-9">
      <button
        onClick={onConfirm}
        disabled={isExecuting}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
      >
        {isExecuting ? (
          <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <LuCheck className="w-3.5 h-3.5" />
        )}
        {isExecuting ? 'Executing...' : (confirmLabel || 'Confirm & Sign')}
      </button>
      <button
        onClick={onCancel}
        disabled={isExecuting}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
      >
        <LuX className="w-3.5 h-3.5" />
        Cancel
      </button>
    </div>
  );
}

// ── Full Chat Panel ────────────────────────────────────

export function ChatPanel({
  messages,
  isLoading,
  isExecuting,
  pendingAction,
  onSend,
  onConfirm,
  onCancel,
  onClear,
  tts,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  isExecuting: boolean;
  pendingAction: ActionPayload | null;
  onSend: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onClear: () => void;
  tts?: {
    isEnabled: boolean;
    isSpeaking: boolean;
    isSupported: boolean;
    setEnabled: (enabled: boolean) => void;
    stop: () => void;
  };
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-0">
        {messages.length === 0 && (
          <WelcomeMessage onSend={onSend} />
        )}

        {messages.map(msg => (
          <React.Fragment key={msg.id}>
            <MessageBubble msg={msg} />
            {/* Show confirm/cancel after action messages */}
            {msg.type === 'action' && pendingAction && msg.action?.status === 'pending_confirmation' && (
              <ActionButtons
                onConfirm={onConfirm}
                onCancel={onCancel}
                isExecuting={isExecuting}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-4 border-t border-white/5">
        <ChatInput
          onSend={onSend}
          disabled={isLoading || isExecuting}
          placeholder={
            pendingAction ? 'Confirm or cancel the pending action above...' :
              isLoading ? 'AI is thinking...' :
                'Ask PumpX AI anything...'
          }
        />
        {messages.length > 0 && (
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <LuTrash2 className="w-3 h-3" /> Clear chat
            </button>
            {tts && (
              <VoiceToggle
                isEnabled={tts.isEnabled}
                isSpeaking={tts.isSpeaking}
                isSupported={tts.isSupported}
                onToggle={tts.setEnabled}
                compact
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Welcome Message ────────────────────────────────────

function WelcomeMessage({ onSend }: { onSend: (text: string) => void }) {
  const suggestions = [
    'Show trending markets',
    'What\'s the market sentiment?',
    'Check my portfolio',
    'Create a market for TSLA reaching $300 by June',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mb-4">
        <LuBot className="w-7 h-7 text-[var(--accent-primary)]" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1">PumpX AI Assistant</h3>
      <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm">
        Create markets, place bets, and analyze predictions — all through natural language.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSend(s)}
            className="text-left text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-white/5 rounded-lg px-3 py-2.5 hover:border-[var(--accent-primary)]/20 hover:text-white transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ChatPanel;
