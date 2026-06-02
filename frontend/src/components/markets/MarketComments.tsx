import React, { useCallback, useEffect, useState } from 'react';
import { useEnsName } from 'wagmi';
import { useAuth } from '../../hooks/useAuth';
import { truncateAddress } from '../../lib/addresses';
import { LuMessageSquare, LuSend } from 'react-icons/lu';

export interface MarketComment {
  id: string;
  marketId: string;
  walletAddress: string;
  content: string;
  createdAt: string;
  pending?: boolean;
}

function CommentAuthor({ address }: { address: string }) {
  const { data: ensName } = useEnsName({ address: address as `0x${string}` });
  const label = ensName || truncateAddress(address);

  return (
    <span className="font-mono text-xs text-[var(--accent-primary)]" title={address}>
      {label}
    </span>
  );
}

function CommentRow({ comment }: { comment: MarketComment }) {
  return (
    <div
      className={`p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] ${
        comment.pending ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <CommentAuthor address={comment.walletAddress} />
        <time className="text-[10px] text-[var(--text-muted)]" dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
      </div>
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">{comment.content}</p>
    </div>
  );
}

export default function MarketComments({ marketId }: { marketId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<MarketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/markets/${marketId}/comments`);
      if (!res.ok) throw new Error('Failed to load comments');
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    if (marketId) loadComments();
  }, [marketId, loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !user?.isLoggedIn || !user.address) return;

    setError(null);
    setSubmitting(true);

    const optimistic: MarketComment = {
      id: `temp-${Date.now()}`,
      marketId,
      walletAddress: user.address,
      content,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setComments((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const res = await fetch(`/api/markets/${marketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to post comment');
      }

      const { comment } = await res.json();
      setComments((prev) =>
        prev.map((c) => (c.id === optimistic.id ? comment : c)),
      );
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setDraft(content);
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-6 mt-8">
      <div className="flex items-center gap-2 mb-4">
        <LuMessageSquare className="w-4 h-4 text-[var(--accent-primary)]" />
        <h2 className="font-semibold text-[var(--text-primary)]">Discussion</h2>
        <span className="text-xs text-[var(--text-muted)]">({comments.filter((c) => !c.pending).length})</span>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-lg" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-6 text-center">Be the first to comment</p>
      ) : (
        <div className="space-y-3 mb-6 max-h-[420px] overflow-y-auto pr-1">
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </div>
      )}

      {user?.isLoggedIn ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share your take on this market…"
            rows={2}
            maxLength={1000}
            className="flex-1 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]/50"
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            className="btn-primary px-4 self-end disabled:opacity-50 flex items-center gap-1.5"
          >
            <LuSend className="w-4 h-4" />
            Post
          </button>
        </form>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">
          <a href={`/login?callbackUrl=${encodeURIComponent(`/markets/${marketId}`)}`} className="text-[var(--accent-primary)] hover:underline">
            Sign in
          </a>{' '}
          to join the discussion.
        </p>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
