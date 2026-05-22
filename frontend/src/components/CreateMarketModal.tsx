import React, { useState } from 'react';
import { TokenInfo } from '../types/market';
import { useMarket } from '../hooks/useMarket';
import { useGamification } from '../hooks/useGamification';

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (marketId: string) => void;
}

export default function CreateMarketModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateMarketModalProps) {
  const { fetchTokenInfo, createMarket, loading, error } = useMarket();
  const { onMarketCreated, isAuthenticated } = useGamification();

  const [step, setStep] = useState<'input' | 'validate' | 'configure'>('input');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [question, setQuestion] = useState('');
  const [threshold, setThreshold] = useState('');
  const [deadline, setDeadline] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleValidateToken = async () => {
    setValidationError(null);

    try {
      setStep('validate');
      const info = await fetchTokenInfo(tokenAddress);
      setTokenInfo(info);
      setStep('configure');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      setValidationError(message);
      setStep('input');
    }
  };

  const handleCreateMarket = async () => {
    if (!tokenInfo) return;

    try {
      const thresholdNum = Number(threshold);
      const deadlineMs = new Date(deadline).getTime();

      const market = await createMarket(
        tokenAddress,
        question,
        thresholdNum,
        deadlineMs
      );

      onSuccess?.(market.id);

      // Trigger gamification XP for market creation
      if (isAuthenticated) {
        await onMarketCreated();
      }

      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create market';
      setValidationError(message);
    }
  };

  const handleClose = () => {
    setStep('input');
    setTokenAddress('');
    setTokenInfo(null);
    setThreshold('');
    setDeadline('');
    setValidationError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Create Prediction Market</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: Token Address Input */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ERC20 Token Contract Address
                </label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {validationError && (
                  <p className="mt-2 text-sm text-red-600">{validationError}</p>
                )}
              </div>

              <button
                onClick={handleValidateToken}
                disabled={!tokenAddress || loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Validating...' : 'Validate Token'}
              </button>
            </div>
          )}

          {/* Step 2: Loading */}
          {step === 'validate' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Fetching token information...</p>
            </div>
          )}

          {/* Step 3: Configure Market */}
          {step === 'configure' && tokenInfo && (
            <div className="space-y-6">
              {/* Token Info Display */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-lg mb-3">Token Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Token Name</p>
                    <p className="font-medium">{tokenInfo.name}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Symbol</p>
                    <p className="font-medium">{tokenInfo.symbol}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Decimals</p>
                    <p className="font-medium">{tokenInfo.decimals}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Current Total Supply</p>
                    <p className="font-medium">
                      {(Number(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals)).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Contract Creator</p>
                  <p className="font-mono text-sm break-all">{tokenInfo.creator}</p>
                </div>
              </div>

              {/* Market Configuration */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Market Configuration</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bonding Curve Threshold (in token units)
                  </label>
                  <input
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder="e.g., 1000000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Market resolves TRUE if total supply reaches this threshold before deadline
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Market resolves FALSE if deadline passes without reaching threshold
                  </p>
                </div>

                {validationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{validationError}</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('input');
                    setTokenInfo(null);
                    setThreshold('');
                    setDeadline('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateMarket}
                  disabled={!threshold || !deadline || loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Deploy Market'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
