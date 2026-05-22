/**
 * PumpX — JWT Utilities
 * Signs and verifies httpOnly cookie JWTs using jose (edge-compatible).
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const ALGORITHM = 'HS256';
const EXPIRY = '7d';

export interface AuthPayload extends JWTPayload {
  address: string;
  role: 'USER' | 'ORACLE' | 'ADMIN';
  hasProfile: boolean;
}

export async function signToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
  return payload as AuthPayload;
}

export const COOKIE_NAME = 'pumpx_auth';

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
};
