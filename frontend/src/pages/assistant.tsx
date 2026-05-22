/**
 * PumpX — AI Assistant Page
 *
 * Full-page chat interface for the AI-powered prediction market assistant.
 * Features:
 *   - Chat panel with full message history
 *   - Wallet status display
 *   - Quick action sidebar
 *   - Transaction preview + confirmation flow
 *   - On-chain explorer links
 *   - Mobile responsive
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ChatPanel, ReputationBadge } from '../components/ai/ChatPanel';
import { VoiceToggle } from '../components/ai/VoiceToggle';
import { useAIChat, useReputation } from '../hooks/useAI';
import { VoiceInput } from '../components/VoiceInput';
import { RiskScore } from '../components/RiskScore';
import { LiveIndicator } from '../components/ui/primitives';
import {
  LuBot,
  LuWallet,
  LuTrendingUp,
  LuPlusCircle,
  LuBarChart3,
  LuTarget,
  LuLineChart,
  LuShieldCheck,
  LuZap,
  LuMessageSquare,
} from 'react-icons/lu';

// Quick actions for the sidebar
const QUICK_ACTIONS = [
  { icon: LuTrendingUp, label: 'Trending Markets', prompt: 'Show me the trending markets' },
  { icon: LuBarChart3, label: 'Market Sentiment', prompt: 'Show the overall sentiment index' },
  { icon: LuTarget, label: 'My Portfolio', prompt: 'Check my portfolio' },
  { icon: LuPlusCircle, label: 'Create Market', prompt: 'I want to create a new prediction market' },
  { icon: LuLineChart, label: 'Stock Intel', prompt: 'Show sentiment for TSLA' },
  { icon: LuShieldCheck, label: 'My Reputation', prompt: 'What\'s my reputation score?' },
];

export default function AIAssistantPage() {
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: reputation } = useReputation(address);

  const chat = useAIChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Market stats for header
  const marketStats = useMemo(() => {
    if (typeof window === 'undefined') return { active: 0, volume: 0 };
    try {
      const markets = JSON.parse(localStorage.getItem('prediction-markets') || '[]');
      const active = markets.filter((m: any) => !m.resolved).length;
      const volume = markets.reduce((s: number, m: any) => s + (m.yesPool || 0) + (m.noPool || 0), 0);
      return { active, volume: parseFloat(volume.toFixed(4)) };
    } catch {
      return { active: 0, volume: 0 };
    }
  }, [chat.messages.length]);

  const handleQuickAction = (prompt: string) => {
    chat.sendMessage(prompt);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 h-[calc(100vh-80px)] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center">
            <LuBot className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">AI Assistant</h1>
              <LiveIndicator />
              <VoiceToggle
                isEnabled={chat.tts.isEnabled}
                isSpeaking={chat.tts.isSpeaking}
                isSupported={chat.tts.isSupported}
                onToggle={chat.tts.setEnabled}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {marketStats.active} active markets · {marketStats.volume} ETH volume
            </p>
          </div>
        </div>

        {/* Wallet status */}
        <div className="flex items-center gap-3">
          {isConnected && reputation && (
            <ReputationBadge trustLevel={reputation.trustLevel} score={reputation.score} />
          )}
          <div className="text-right hidden sm:block">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="text-[10px] text-[var(--text-muted)]">{chain?.name || 'Unknown'}</p>
                  <p className="text-xs text-white font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)} · {balance?.formatted?.slice(0, 6)} ETH
                  </p>
                </div>
              </div>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    <LuWallet className="w-3.5 h-3.5" /> Connect Wallet
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-4 h-[calc(100%-60px)]">
        {/* Sidebar — Quick Actions */}
        <div className={`${sidebarOpen ? 'w-52' : 'w-0'} shrink-0 transition-all duration-200 overflow-hidden hidden lg:block`}>
          <div className="card h-full p-3 flex flex-col">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 px-1">
              Quick Actions
            </h3>
            <div className="space-y-1 flex-1">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={chat.isLoading || chat.isExecuting}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-white transition-all disabled:opacity-40"
                >
                  <action.icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Sidebar footer */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <Link
                href="/intelligence"
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)] transition-all"
              >
                <LuLineChart className="w-3.5 h-3.5" />
                Stock Intelligence
              </Link>
              <Link
                href="/markets"
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)] transition-all"
              >
                <LuPlusCircle className="w-3.5 h-3.5" />
                Create Market
              </Link>
            </div>

            {/* AI model indicator */}
            <div className="mt-3 pt-3 border-t border-white/5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[9px] text-[var(--text-muted)]">
                <LuZap className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>Powered by AI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 card overflow-hidden">
          <ChatPanel
            messages={chat.messages}
            isLoading={chat.isLoading}
            isExecuting={chat.isExecuting}
            pendingAction={chat.pendingAction}
            onSend={chat.sendMessage}
            onConfirm={chat.confirmAction}
            onCancel={chat.cancelAction}
            onClear={chat.clearMessages}
            tts={chat.tts}
          />
        </div>

        {/* Right Sidebar — Context Panel (desktop only) */}
        <div className="w-56 shrink-0 hidden xl:flex flex-col gap-3">
          {/* Wallet Card */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <LuWallet className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Wallet</h4>
            </div>
            {isConnected ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Address</span>
                  <span className="text-white font-mono text-[10px]">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Balance</span>
                  <span className="text-white font-mono">{balance?.formatted?.slice(0, 8)} ETH</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Chain</span>
                  <span className="text-white">{chain?.name}</span>
                </div>
                {reputation && (
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-[var(--text-muted)]">Trust</span>
                    <ReputationBadge trustLevel={reputation.trustLevel} score={reputation.score} size="sm" />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] text-center py-3">Not connected</p>
            )}
          </div>

          {/* Protocol Stats */}
          <div className="card p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Protocol</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Active Markets</span>
                <span className="text-white font-mono">{marketStats.active}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Total Volume</span>
                <span className="text-white font-mono">{marketStats.volume} ETH</span>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <LuShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Security</h4>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              All transactions require your explicit confirmation. The AI never auto-executes.
              Review every transaction preview carefully before signing.
            </p>
          </div>

          {/* Chat Stats */}
          <div className="card p-4 mt-auto">
            <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)]">
              <LuMessageSquare className="w-3 h-3" />
              <span>{chat.messages.length} messages this session</span>
            </div>
          </div>

          {/* Voice Input */}
          <div className="card p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">🎙 Voice Input</h4>
            <VoiceInput
              onTranscript={(text: string) => chat.sendMessage(text)}
            />
          </div>

          {/* Quick Risk Check */}
          <div className="card p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">🛡 Risk Check</h4>
            <RiskScore compact />
          </div>
        </div>
      </div>
    </div>
  );
}
