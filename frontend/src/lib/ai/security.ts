/**
 * PumpX AI Layer — Security & Validation
 *
 * - Parameter sanitization
 * - Input validation
 * - Rate limiting
 * - Abuse prevention
 * - NEVER auto-execute — always require confirmation
 */

import type { ValidationResult, RateLimitEntry } from './types';

// ── Rate Limiter ───────────────────────────────────────

const rateLimits = new Map<string, RateLimitEntry>();

const RATE_LIMITS = {
  chat: { maxRequests: 30, windowMs: 60_000 },        // 30 msgs/min
  function_call: { maxRequests: 10, windowMs: 60_000 }, // 10 actions/min
  transaction: { maxRequests: 5, windowMs: 300_000 },   // 5 txns/5min
} as const;

export function checkRateLimit(
  key: string,
  category: keyof typeof RATE_LIMITS
): { allowed: boolean; retryAfterMs?: number } {
  const limit = RATE_LIMITS[category];
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now - entry.windowStart > limit.windowMs) {
    rateLimits.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= limit.maxRequests) {
    const retryAfterMs = limit.windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true };
}

// ── Parameter Sanitization ─────────────────────────────

/** Strip dangerous characters, enforce types */
export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')   // strip HTML
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAddress(input: unknown): `0x${string}` | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/i.test(cleaned)) {
    return cleaned as `0x${string}`;
  }
  return null;
}

export function sanitizeAmount(input: unknown): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : typeof input === 'number' ? input : NaN;
  if (isNaN(num) || num <= 0 || num > 1_000_000) return null;
  return num;
}

export function sanitizeTimestamp(input: unknown): number | null {
  const num = typeof input === 'string' ? parseInt(input, 10) : typeof input === 'number' ? input : NaN;
  if (isNaN(num)) return null;
  // Must be in the future and within 2 years
  const now = Date.now();
  if (num < now) return null;
  if (num > now + 2 * 365 * 24 * 60 * 60 * 1000) return null;
  return num;
}

/** Parse flexible deadline: timestamps, relative ("30 days", "2 weeks"), dates ("June 2025", "March 30"), ISO strings */
export function parseFlexibleDeadline(input: unknown): number | null {
  if (typeof input === 'number') {
    return sanitizeTimestamp(input);
  }
  if (typeof input !== 'string' || !input.trim()) return null;

  const s = input.trim();
  const now = Date.now();
  const twoYears = 2 * 365 * 24 * 60 * 60 * 1000;

  // 1) Pure numeric timestamp
  const asNum = Number(s);
  if (!isNaN(asNum) && asNum > 1_000_000_000_000) {
    return sanitizeTimestamp(asNum);
  }

  // 2) Relative: "30 days", "2 weeks", "3 months", "1 year"
  const relMatch = s.match(/^(\d+)\s*(day|week|month|year)s?$/i);
  if (relMatch) {
    const n = parseInt(relMatch[1]);
    const unit = relMatch[2].toLowerCase();
    const msMap: Record<string, number> = {
      day: 86400_000,
      week: 7 * 86400_000,
      month: 30 * 86400_000,
      year: 365 * 86400_000,
    };
    const result = now + n * (msMap[unit] || 86400_000);
    return result <= now + twoYears ? result : null;
  }

  // 3) "next week", "next month", "next year"
  const nextMatch = s.match(/^next\s+(week|month|year)$/i);
  if (nextMatch) {
    const unit = nextMatch[1].toLowerCase();
    const msMap: Record<string, number> = {
      week: 7 * 86400_000,
      month: 30 * 86400_000,
      year: 365 * 86400_000,
    };
    return now + (msMap[unit] || 30 * 86400_000);
  }

  // 4) Try Date.parse for formats like "June 2025", "March 30 2025", "2025-06-30", "June 30", etc.
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    // If only month+year given and it parsed to the 1st, set to end of that month
    let ts = parsed;
    // Ensure it's in the future
    if (ts <= now) {
      // If just a month name like "June", assume next occurrence
      const d = new Date(ts);
      if (d.getFullYear() <= new Date().getFullYear()) {
        d.setFullYear(d.getFullYear() + 1);
        ts = d.getTime();
      }
    }
    if (ts > now && ts <= now + twoYears) return ts;
  }

  return null;
}

// ── Function Parameter Validators ──────────────────────

const VALIDATORS: Record<string, (params: Record<string, unknown>) => ValidationResult> = {
  create_market: (params) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: Record<string, unknown> = {};

    // Token address — accept 0x address OR a stock/crypto ticker (e.g. TSLA, BTC)
    const tokenAddr = sanitizeAddress(params.tokenAddress);
    const rawTicker = sanitizeString(params.tokenAddress, 30)
      .replace(/^\$/, '')         // strip leading $
      .replace(/\s+stock$/i, '') // strip trailing "stock"
      .replace(/\s+token$/i, '') // strip trailing "token"
      .replace(/[^a-zA-Z0-9._-]/g, '') // keep safe chars
      .toUpperCase();
    if (tokenAddr) {
      sanitized.tokenAddress = tokenAddr;
    } else if (rawTicker && rawTicker.length >= 1 && rawTicker.length <= 20) {
      // Valid ticker/symbol — pass it through
      sanitized.tokenAddress = rawTicker;
      sanitized.isTicker = true;
    } else {
      errors.push('Invalid token address or ticker symbol');
    }

    // Question
    const question = sanitizeString(params.question, 200);
    if (!question || question.length < 10) errors.push('Question must be at least 10 characters');
    else sanitized.question = question;

    // Threshold
    const threshold = sanitizeAmount(params.threshold);
    if (!threshold) errors.push('Invalid threshold amount');
    else sanitized.threshold = threshold;

    // Deadline — flexible parsing
    const deadline = parseFlexibleDeadline(params.deadline);
    if (!deadline) {
      errors.push('Invalid deadline (use a date like "June 2025", "30 days", "March 30", or a timestamp)');
    } else {
      sanitized.deadline = deadline;
    }

    return { isValid: errors.length === 0, sanitized, errors, warnings };
  },

  place_bet: (params) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: Record<string, unknown> = {};

    const marketAddress = sanitizeAddress(params.marketAddress);
    if (!marketAddress) errors.push('Invalid market address');
    else sanitized.marketAddress = marketAddress;

    const side = typeof params.side === 'string' ? params.side.toUpperCase() : '';
    if (side !== 'YES' && side !== 'NO') errors.push('Side must be YES or NO');
    else sanitized.side = side;

    const amount = sanitizeAmount(params.amount);
    if (!amount) errors.push('Invalid bet amount');
    else {
      sanitized.amount = amount;
      if (amount > 10) warnings.push(`Large bet: ${amount} ETH — please confirm carefully`);
    }

    return { isValid: errors.length === 0, sanitized, errors, warnings };
  },

  resolve_market: (params) => {
    const errors: string[] = [];
    const sanitized: Record<string, unknown> = {};

    const marketAddress = sanitizeAddress(params.marketAddress);
    if (!marketAddress) errors.push('Invalid market address');
    else sanitized.marketAddress = marketAddress;

    return { isValid: errors.length === 0, sanitized, errors, warnings: [] };
  },

  check_market_status: (params) => {
    const errors: string[] = [];
    const sanitized: Record<string, unknown> = {};

    const marketAddress = sanitizeAddress(params.marketAddress);
    if (!marketAddress) errors.push('Invalid market address');
    else sanitized.marketAddress = marketAddress;

    return { isValid: errors.length === 0, sanitized, errors, warnings: [] };
  },

  check_user_portfolio: (params) => {
    const sanitized: Record<string, unknown> = {};

    // Optionally takes an address; if not provided, uses connected wallet
    if (params.address) {
      const addr = sanitizeAddress(params.address);
      if (addr) sanitized.address = addr;
    }

    return { isValid: true, sanitized, errors: [], warnings: [] };
  },

  show_trending_markets: () => {
    return { isValid: true, sanitized: {}, errors: [], warnings: [] };
  },

  show_sentiment_index: (params) => {
    const sanitized: Record<string, unknown> = {};

    if (params.ticker) {
      sanitized.ticker = sanitizeString(params.ticker, 10).toUpperCase();
    }

    return { isValid: true, sanitized, errors: [], warnings: [] };
  },
};

export function validateFunctionParams(
  functionName: string,
  params: Record<string, unknown>
): ValidationResult {
  const validator = VALIDATORS[functionName];
  if (!validator) {
    return { isValid: false, sanitized: {}, errors: [`Unknown function: ${functionName}`], warnings: [] };
  }
  return validator(params);
}

// ── AI Output Validation ───────────────────────────────

/** Validate that AI-returned function call is legitimate */
export function validateAIFunctionCall(
  name: string,
  argsString: string,
  registeredFunctions: string[]
): { valid: boolean; args: Record<string, unknown> | null; error?: string } {
  // Check function exists
  if (!registeredFunctions.includes(name)) {
    return { valid: false, args: null, error: `Unknown function: ${name}` };
  }

  // Handle empty/missing arguments — valid for functions with no required params
  if (!argsString || argsString.trim() === '' || argsString.trim() === '""') {
    return { valid: true, args: {} };
  }

  // Parse JSON args safely
  try {
    let args = JSON.parse(argsString);

    // Handle double-encoded JSON strings (e.g. the AI returned a string instead of an object)
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        // Not nested JSON — default to empty object
        args = {};
      }
    }

    // If still not a plain object, default to empty (parameter validators will catch missing required fields)
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      return { valid: true, args: {} };
    }
    return { valid: true, args };
  } catch {
    return { valid: false, args: null, error: 'Invalid JSON in function arguments' };
  }
}

// ── Transaction Safety ─────────────────────────────────

/** Check if a transaction should require extra confirmation */
export function getTransactionRiskLevel(
  functionName: string,
  params: Record<string, unknown>
): 'low' | 'medium' | 'high' {
  // All write operations require confirmation — but flag risk level
  const amount = typeof params.amount === 'number' ? params.amount : parseFloat(String(params.amount || '0'));

  if (functionName === 'create_market') return 'medium';
  if (functionName === 'resolve_market') return 'high';

  if (functionName === 'place_bet') {
    if (amount > 5) return 'high';
    if (amount > 1) return 'medium';
    return 'low';
  }

  return 'low';
}
