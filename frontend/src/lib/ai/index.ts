/**
 * PumpX AI Layer — Barrel Export
 */

// Types
export type {
  ChatMessage,
  MessageType,
  ActionPayload,
  AttestationPayload,
  ActionSummary,
  AIFunctionSchema,
  FunctionCallResult,
  FunctionExecutionContext,
  AIRequestMessage,
  AIResponse,
  ReputationData,
  ReputationFlag,
  TrustLevel,
  ValidationResult,
} from './types';

// Function Registry
export {
  availableFunctions,
  FUNCTION_NAMES,
  executeFunction,
  requiresOnChainExecution,
  onChainExecutors,
} from './functions';

// System Prompt
export { buildSystemPrompt } from './prompt';

// Security
export {
  checkRateLimit,
  validateFunctionParams,
  validateAIFunctionCall,
  getTransactionRiskLevel,
  sanitizeString,
  sanitizeAddress,
  sanitizeAmount,
} from './security';

// Reputation
export {
  getReputation,
  recordMarketCreated,
  recordMarketResolved,
  recordBet,
  recordWin,
  upvoteAddress,
  flagAddress,
  getFlags,
  getLeaderboard,
} from './reputation';
