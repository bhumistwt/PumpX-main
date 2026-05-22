/**
 * PumpX AI Layer — Type Definitions
 *
 * Core types for the AI assistant, function calling, chat, and reputation systems.
 */

// ── Chat Message Types ─────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'function';

export type MessageType =
  | 'user'        // User text input
  | 'bot'         // AI text response
  | 'system'      // Processing/status pill
  | 'action'      // Requires user confirmation (tx preview)
  | 'attestation' // Success confirmation (tx complete)
  | 'error';      // Error display

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  // For action messages
  action?: ActionPayload;
  // For attestation messages
  attestation?: AttestationPayload;
}

export interface ActionPayload {
  functionName: string;
  displayName: string;
  params: Record<string, unknown>;
  // Pre-validated summary for display
  summary: ActionSummary[];
  // Estimated gas (if applicable)
  estimatedGas?: string;
  // Status
  status: 'pending_confirmation' | 'executing' | 'confirmed' | 'cancelled' | 'failed';
}

export interface ActionSummary {
  label: string;
  value: string;
  highlight?: boolean; // Emphasize in UI
}

export interface AttestationPayload {
  txHash: string;
  explorerUrl: string;
  summary: ActionSummary[];
  blockNumber?: number;
}

// ── Function Calling Types ─────────────────────────────

export interface AIFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIFunctionParam>;
    required: string[];
  };
}

export interface AIFunctionParam {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  minimum?: number;
  maximum?: number;
}

export interface FunctionCallResult {
  success: boolean;
  type: string;
  status: 'pending_confirmation' | 'ready' | 'error';
  data?: Record<string, unknown>;
  displayName?: string;
  summary?: ActionSummary[];
  estimatedGas?: string;
  error?: string;
  needsWallet?: boolean;
  missing?: string[];
}

export interface FunctionExecutionContext {
  userAddress: `0x${string}` | undefined;
  chainId: number | undefined;
  writeContract: (args: any) => Promise<`0x${string}`>;
  sendTransaction: (args: any) => Promise<`0x${string}`>;
  publicClient: any;
}

// ── AI API Types ───────────────────────────────────────

export interface AIRequestMessage {
  role: MessageRole;
  content: string;
  name?: string;        // For function role messages
  function_call?: {     // For assistant function calls
    name: string;
    arguments: string;  // JSON string
  };
}

export interface AIResponse {
  type: 'message' | 'function_call';
  message?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

// ── Reputation Types ───────────────────────────────────

export type TrustLevel = 'trusted' | 'neutral' | 'caution' | 'flagged';

export interface ReputationData {
  address: string;
  score: number;            // 0-100
  trustLevel: TrustLevel;
  successfulTxCount: number;
  marketsCreated: number;
  marketsResolved: number;
  totalBetVolume: number;   // In ETH
  winRate: number;          // 0-100%
  upvotes: number;
  flags: number;
  lastActivity: number;     // timestamp
}

export interface ReputationFlag {
  targetAddress: string;
  flaggerAddress: string;
  reason: string;
  timestamp: number;
}

// ── Security Types ─────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  sanitized: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

export interface RateLimitEntry {
  count: number;
  windowStart: number;
}
