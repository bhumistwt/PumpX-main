/**
 * PumpX — Session Configuration (iron-session v8)
 *
 * Encrypted cookie-based sessions for SIWE authentication.
 * No client-side trust — session is server-verified on every request.
 */

import type { SessionOptions } from 'iron-session';

export interface SessionData {
  address?: string;   // lowercase 0x-prefixed wallet address
  chainId?: number;
  nonce?: string;     // SIWE nonce (consumed after verify)
  isLoggedIn: boolean;
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_replace_me',
  cookieName: 'pumpx-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
