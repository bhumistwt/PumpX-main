import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { isValidEthAddress } from '../../lib/addresses';

/**
 * Referral landing: /m/[marketId]?ref=[walletAddress]
 * Tracks referral then redirects to market detail.
 */
export default function ReferralLandingPage() {
  const router = useRouter();
  const { marketId, ref } = router.query;
  const { address, isConnected } = useAccount();
  const tracked = useRef(false);

  useEffect(() => {
    if (!router.isReady || !marketId || tracked.current) return;

    const id = String(marketId).toLowerCase();
    const referrer = typeof ref === 'string' ? ref.toLowerCase() : '';

    if (referrer && isValidEthAddress(referrer)) {
      try {
        sessionStorage.setItem(`pumpx.ref.${id}`, referrer);
      } catch {
        /* ignore */
      }
    }

    async function track() {
      if (!referrer || !isValidEthAddress(referrer)) {
        router.replace(`/markets/${id}`);
        return;
      }

      tracked.current = true;

      try {
        await fetch('/api/referrals/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId: id,
            referrerId: referrer,
            refereeId: isConnected && address ? address : undefined,
          }),
        });
      } catch {
        /* best-effort */
      }

      router.replace(`/markets/${id}`);
    }

    track();
  }, [router.isReady, marketId, ref, isConnected, address, router]);

  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-[var(--text-muted)]">Loading market…</p>
    </div>
  );
}
