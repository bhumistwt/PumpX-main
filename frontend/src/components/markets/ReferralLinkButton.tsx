import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { LuLink, LuCheck } from 'react-icons/lu';

export default function ReferralLinkButton({ marketId }: { marketId: string }) {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);

  if (!isConnected || !address) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        Connect wallet to copy your referral link.
      </p>
    );
  }

  const copyLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/m/${marketId}?ref=${address}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copyLink}
      className="btn-secondary flex items-center gap-2 text-sm w-full sm:w-auto justify-center"
    >
      {copied ? (
        <>
          <LuCheck className="w-4 h-4 text-emerald-400" />
          Copied!
        </>
      ) : (
        <>
          <LuLink className="w-4 h-4" />
          Copy referral link
        </>
      )}
    </button>
  );
}
