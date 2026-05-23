/**
 * PumpX — useAuth Hook
 * SIWE sign-in flow wrapper: get nonce → sign → verify → session.
 */
import { useState, useCallback, useEffect } from 'react';
import { useAccount, useDisconnect, useWalletClient, useSignMessage } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { SiweMessage } from 'siwe';
import { useRouter } from 'next/router';

export interface AuthUser {
  isLoggedIn: boolean;
  address: string | null;
  role: 'USER' | 'ORACLE' | 'ADMIN' | null;
  hasProfile: boolean;
  username: string | null;
  avatarUrl: string | null;
}

export interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const defaultUser: AuthUser = {
  isLoggedIn: false,
  address: null,
  role: null,
  hasProfile: false,
  username: null,
  avatarUrl: null,
};

export function useAuth(): UseAuthReturn {
  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.isLoggedIn) {
        setUser({
          isLoggedIn: true,
          address: data.address,
          role: data.role,
          hasProfile: data.hasProfile,
          username: data.username,
          avatarUrl: data.avatarUrl,
        });
      } else {
        setUser(defaultUser);
      }
    } catch {
      setUser(defaultUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const signIn = useCallback(async () => {
    if (!address) {
      setError('Please connect your wallet first.');
      return;
    }

    // Prevent double-signing
    if (isSigningIn) return;

    setError(null);
    setIsSigningIn(true);

    // Safety timeout — if wallet never responds, reset after 30s
    const timeoutId = setTimeout(() => {
      setIsSigningIn(false);
      setError('Wallet did not respond. Please try again and check your wallet extension popup.');
    }, 30_000);

    try {
      // 1. Get nonce from server
      console.log('[PumpX] Fetching nonce...');
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!nonceRes.ok) {
        const errBody = await nonceRes.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to get nonce');
      }
      const { nonce } = await nonceRes.json();
      console.log('[PumpX] Nonce received, requesting signature...');

      // 2. Build SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to PumpX. The decentralized prediction market.',
        uri: window.location.origin,
        version: '1',
        chainId: chain?.id ?? baseSepolia.id,
        nonce,
      });

      const preparedMessage = message.prepareMessage();

      // 3. Request wallet signature
      let signature: string;
      try {
        if (walletClient) {
          signature = await walletClient.signMessage({
            account: address,
            message: preparedMessage,
          });
        } else {
          signature = await signMessageAsync({ message: preparedMessage });
        }
      } catch (signErr) {
        // Some wallet sessions (especially WalletConnect / injected wallets on
        // unsupported networks) can fail chain switching inside wagmi.
        // Fall back to a direct EIP-1193 personal_sign request.
        if (typeof window !== 'undefined' && (window as any).ethereum?.request) {
          signature = await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [preparedMessage, address],
          });
        } else {
          throw signErr;
        }
      }
      console.log('[PumpX] Signature received, verifying...');

      // 4. Verify on server
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: preparedMessage, signature }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error ?? 'Verification failed');
      }
      console.log('[PumpX] Verified! Redirecting...');

      // 5. Refresh user state
      await fetchMe();

      // 6. Route based on profile status
      const freshRes = await fetch('/api/auth/me');
      const freshUser = await freshRes.json();
      if (!freshUser.hasProfile) {
        router.push('/register');
      } else {
        const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
        router.push(callbackUrl ?? '/dashboard');
      }
    } catch (err) {
      console.error('[PumpX] Sign-in error:', err);
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      // Don't show error for intentional user rejections
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('user denied')) {
        setError(msg);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSigningIn(false);
    }
  }, [address, chain, isSigningIn, walletClient, fetchMe, router]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    disconnect();
    setUser(defaultUser);
    router.push('/login');
  }, [disconnect, router]);

  return {
    user,
    isLoading,
    isSigningIn,
    error,
    signIn,
    signOut,
    refetch: fetchMe,
  };
}
