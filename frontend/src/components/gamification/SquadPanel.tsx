/**
 * SquadPanel — Squad management and leaderboard.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSquad } from '@/hooks/useSquad';
import { useAccount } from 'wagmi';
import type { Squad } from '@/lib/gamification';

interface SquadPanelProps {
  className?: string;
}

export function SquadPanel({ className = '' }: SquadPanelProps) {
  const { address } = useAccount();
  const {
    squads,
    userSquad,
    isLoading,
    create,
    join,
    leave,
    refresh,
  } = useSquad();

  const inSquad = !!userSquad;
  const isLeader = !!(userSquad && address && userSquad.leaderAddress?.toLowerCase() === address.toLowerCase());

  const [view, setView] = useState<'squad' | 'leaderboard' | 'create' | 'join'>('squad');

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden ${className}`}>
      {/* Tab Header */}
      <div className="flex border-b border-white/5">
        <TabButton
          label="My Squad"
          active={view === 'squad'}
          onClick={() => setView('squad')}
        />
        <TabButton
          label="Leaderboard"
          active={view === 'leaderboard'}
          onClick={() => setView('leaderboard')}
        />
        {!inSquad && (
          <>
            <TabButton
              label="Create"
              active={view === 'create'}
              onClick={() => setView('create')}
            />
            <TabButton
              label="Join"
              active={view === 'join'}
              onClick={() => setView('join')}
            />
          </>
        )}
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          {view === 'squad' && (
            <motion.div key="squad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {inSquad && userSquad ? (
                <SquadDetails
                  squad={userSquad}
                  isLeader={isLeader}
                  onLeave={() => { if (userSquad) leave(userSquad.id); }}
                />
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl mb-3 block">👥</span>
                  <p className="text-sm text-[var(--text-muted)]">You're not in a squad yet</p>
                  <div className="flex gap-2 justify-center mt-3">
                    <button
                      onClick={() => setView('create')}
                      className="px-4 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 transition-colors"
                    >
                      Create Squad
                    </button>
                    <button
                      onClick={() => setView('join')}
                      className="px-4 py-1.5 rounded-lg bg-white/10 text-[var(--text-muted)] text-sm hover:bg-white/15 transition-colors"
                    >
                      Join Squad
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === 'leaderboard' && (
            <motion.div key="lb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SquadLeaderboard squads={squads} />
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CreateSquadForm onCreate={async (name: string, tag: string) => { return create(name, tag); }} onSuccess={() => setView('squad')} />
            </motion.div>
          )}

          {view === 'join' && (
            <motion.div key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <JoinSquadForm onJoin={async (code: string) => { return join(code); }} onSuccess={() => setView('squad')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sub Components ─────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
        active
          ? 'text-white border-b-2 border-blue-500 bg-white/5'
          : 'text-[var(--text-muted)] hover:text-white hover:bg-white/[0.02]'
      }`}
    >
      {label}
    </button>
  );
}

function SquadDetails({
  squad,
  isLeader,
  onLeave,
}: {
  squad: Squad;
  isLeader: boolean;
  onLeave: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">👥</span>
        <div>
          <h3 className="text-lg font-bold text-white">{squad.name}</h3>
          <span className="text-xs text-[var(--text-muted)]">[{squad.tag}]</span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-sm font-mono text-blue-400">
            {squad.totalXP.toLocaleString()} XP
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {squad.members.length}/{squad.maxMembers} members
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="space-y-1 mb-3">
        {squad.members.map((member) => (
          <div key={member.address} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs">{member.role === 'leader' ? '👑' : '🎮'}</span>
              <span className="text-sm font-mono text-white">
                {member.address.slice(0, 6)}…{member.address.slice(-4)}
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              {member.contributedXP.toLocaleString()} XP contrib
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-white/5">
        {isLeader && squad.inviteCode && (
          <span className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-[var(--text-muted)]">
            Code: {squad.inviteCode}
          </span>
        )}
        <button
          onClick={onLeave}
          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-colors ml-auto"
        >
          Leave Squad
        </button>
      </div>
    </div>
  );
}

function SquadLeaderboard({ squads }: { squads: Squad[] }) {
  return (
    <div className="space-y-1">
      {squads.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">No squads yet</p>
      )}
      {squads.map((squad, idx) => (
        <div
          key={squad.id}
          className="flex items-center justify-between py-2 px-2 rounded hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${
              idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-[var(--text-muted)]'
            }`}>
              #{idx + 1}
            </span>
            <span className="text-lg">👥</span>
            <div>
              <span className="text-sm text-white font-semibold">{squad.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-1">[{squad.tag}]</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-blue-400">{squad.totalXP.toLocaleString()}</div>
            <div className="text-xs text-[var(--text-muted)]">{squad.members.length} members</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateSquadForm({
  onCreate,
  onSuccess,
}: {
  onCreate: (name: string, tag: string) => Promise<any>;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !tag.trim()) {
      setError('Name and tag are required');
      return;
    }
    const result = await onCreate(name.trim(), tag.trim().toUpperCase());
    if (result) {
      onSuccess();
    } else {
      setError('Failed to create squad.');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-[var(--text-muted)] block mb-1">Squad Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alpha Traders"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500/50 focus:outline-none"
          maxLength={24}
        />
      </div>
      <div>
        <label className="text-xs text-[var(--text-muted)] block mb-1">Tag (3-5 chars)</label>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
          placeholder="e.g. ALPHA"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:border-blue-500/50 focus:outline-none"
          maxLength={5}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <motion.button
        onClick={handleSubmit}
        className="w-full py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-semibold hover:bg-blue-500/30 transition-colors"
        whileTap={{ scale: 0.98 }}
      >
        Create Squad
      </motion.button>
    </div>
  );
}

function JoinSquadForm({
  onJoin,
  onSuccess,
}: {
  onJoin: (code: string) => Promise<boolean>;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Enter a squad ID or invite code');
      return;
    }
    const result = await onJoin(code.trim());
    if (result) {
      onSuccess();
    } else {
      setError('Failed to join squad');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-[var(--text-muted)] block mb-1">Invite Code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter invite code"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:border-blue-500/50 focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <motion.button
        onClick={handleSubmit}
        className="w-full py-2 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-semibold hover:bg-blue-500/30 transition-colors"
        whileTap={{ scale: 0.98 }}
      >
        Join Squad
      </motion.button>
    </div>
  );
}
