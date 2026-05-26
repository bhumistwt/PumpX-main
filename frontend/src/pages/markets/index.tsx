"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useSwitchChain } from "wagmi";
import dayjs, { Dayjs } from "dayjs";
import confetti from "canvas-confetti";
import { Market, TokenInfo } from "../../types/market";
import { MARKET_FACTORY_ABI, getFactoryForChain } from "../../constants/contracts";
import { decodeEventLog, isAddress, getAddress } from "viem";
import { useStockSearch, useStockQuote } from "../../hooks/useStockData";
import { StockPriceTicker, Sparkline } from "../../components/ui/stockWidgets";
import { AIMarketCreator } from "../../components/AIMarketCreator";
import { VoiceButton } from "../../components/VoiceInput";

// Minimal ERC-20 ABI for reading token metadata on-chain
const ERC20_ABI = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

/* ── Step indicator ──────────────────────────────────── */
const STEPS = [
  { key: 'input', label: 'Token', num: 1 },
  { key: 'configure', label: 'Configure', num: 2 },
  { key: 'deploying', label: 'Deploy', num: 3 },
  { key: 'success', label: 'Done', num: 4 },
] as const;

function StepIndicator({ current }: { current: string }) {
  const idx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${i <= idx
            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
            : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-white/5'
            }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i < idx ? 'bg-[var(--accent-primary)] text-black' :
              i === idx ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' :
                'bg-white/5 text-[var(--text-muted)]'
              }`}>
              {i < idx ? '✓' : s.num}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px ${i < idx ? 'bg-[var(--accent-primary)]' : 'bg-white/10'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function MarketsCreate() {
  const [isMounted, setIsMounted] = useState(false);
  const { address, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();

  // Supported chains: Base Sepolia (84532) and Base Mainnet (8453)
  const SUPPORTED_CHAINS = [
    { id: 84532, name: 'Base Sepolia', label: 'Testnet' },
    { id: 8453, name: 'Base', label: 'Mainnet' },
  ];
  const currentFactory = chain ? getFactoryForChain(chain.id) : null;
  const isUnsupportedChain = !!chain && !currentFactory;

  const [step, setStep] = useState<'input' | 'configure' | 'deploying' | 'success'>('input');
  const [tokenAddress, setTokenAddress] = useState("");
  const [question, setQuestion] = useState("");
  const [threshold, setThreshold] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdMarket, setCreatedMarket] = useState<Market | null>(null);
  const [newMarketAddress, setNewMarketAddress] = useState<string>("");

  // Using wagmi's publicClient for on-chain calls (auto-detects connected chain)

  // Stock ticker linking
  const [stockQuery, setStockQuery] = useState("");
  const [linkedTicker, setLinkedTicker] = useState<string | null>(null);
  const { results: stockSearchResults, loading: stockSearching } = useStockSearch(stockQuery);
  const { data: linkedQuote } = useStockQuote(linkedTicker);

  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    setIsMounted(true);
    // Default deadline = 7 days from now
    const d = dayjs().add(7, 'day');
    setDeadlineDate(d.format('YYYY-MM-DD'));
    setDeadlineTime(d.format('HH:mm'));

    // Auto-switch to Base Sepolia if current chain has no factory
    if (chain && !getFactoryForChain(chain.id)) {
      try { switchChain({ chainId: 84532 }); } catch { }
    }
  }, []);

  // Handle contract deployment success
  useEffect(() => {
    async function handleDeployment() {
      if (isConfirmed && hash && publicClient && tokenInfo) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: MARKET_FACTORY_ABI,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === "MarketCreated") {
                const marketAddress = decoded.args.market as string;
                setNewMarketAddress(marketAddress);

                const thresholdInBaseUnits = BigInt(Math.floor(Number(threshold))) * (10n ** BigInt(tokenInfo.decimals));
                const selectedDate = dayjs(`${deadlineDate} ${deadlineTime}`);

                // ── Save to DB via API ──────────────────────────
                try {
                  await fetch('/api/markets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contractAddress: marketAddress,
                      chainId: chain?.id ?? 84532,
                      tokenAddress,
                      question: question.trim(),
                      threshold: thresholdInBaseUnits.toString(),
                      deadline: selectedDate.toISOString(),
                      initialSupply: tokenInfo.totalSupply || '0',
                      txHash: hash,
                      blockNumber: Number(receipt.blockNumber),
                      stockTicker: linkedTicker ?? undefined,
                    }),
                  });
                } catch {
                  // Non-fatal: market creation succeeded on-chain — just logging fallback
                  console.warn('[PumpX] Failed to save market to DB, using localStorage fallback');
                  const existingMarkets = localStorage.getItem('prediction-markets');
                  const markets = existingMarkets ? JSON.parse(existingMarkets) : [];
                  markets.push({ id: marketAddress, question: question.trim(), contractAddress: marketAddress });
                  localStorage.setItem('prediction-markets', JSON.stringify(markets));
                }

                const market: Market = {
                  id: marketAddress,
                  question: question.trim(),
                  tokenAddress,
                  tokenName: tokenInfo?.name || "",
                  tokenSymbol: tokenInfo?.symbol || "",
                  tokenDecimals: tokenInfo?.decimals || 18,
                  contractCreator: tokenInfo?.creator || "",
                  totalSupply: tokenInfo?.totalSupply || "0",
                  threshold: Number(thresholdInBaseUnits),
                  deadline: selectedDate.valueOf(),
                  yesPool: 0,
                  noPool: 0,
                  bets: [],
                  resolved: false,
                  reached: false,
                  createdAt: Date.now(),
                  marketContract: marketAddress,
                  stockTicker: linkedTicker || undefined,
                  stockName: linkedQuote ? `${linkedQuote.symbol}` : undefined,
                  stockPriceAtCreation: linkedQuote?.price,
                };

                setCreatedMarket(market);
                setStep('success');
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                break;
              }
            } catch { }
          }
        } catch {
          setValidationError('Failed to get market address from transaction');
          setStep('configure');
        }
      }
    }
    handleDeployment();
  }, [isConfirmed, hash, publicClient, question, tokenAddress, tokenInfo, threshold, deadlineDate, deadlineTime, chain, linkedTicker, linkedQuote]);




  if (!isMounted) return null;

  const handleValidateToken = async () => {
    setValidationError(null);
    setIsValidating(true);
    try {
      if (!isAddress(tokenAddress)) throw new Error('Invalid Ethereum address format');
      if (!publicClient) throw new Error('Please connect your wallet first');

      const addr = getAddress(tokenAddress);
      const code = await publicClient.getBytecode({ address: addr });
      if (!code || code === '0x') throw new Error('Address is not a contract on the current network. Check that you are connected to the right chain.');

      let name = 'Unknown Token', symbol = 'TOKEN', decimals = 18, totalSupply = '0';
      try {
        const [n, s, d] = await Promise.all([
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'name' }),
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'symbol' }),
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'decimals' }),
        ]);
        name = (n as string) || name;
        symbol = (s as string) || symbol;
        decimals = Number(d) || decimals;
      } catch { }
      try {
        const ts = await publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'totalSupply' });
        totalSupply = ts.toString();
      } catch { }
      const creator = 'Unknown';

      setTokenInfo({ address: tokenAddress, name, symbol, decimals, creator, totalSupply });
      setStep('configure');
      confetti({ particleCount: 30, spread: 40, origin: { y: 0.6 } });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCreateMarket = async () => {
    if (!tokenInfo || !question) return;
    const selectedDate = dayjs(`${deadlineDate} ${deadlineTime}`);

    try {
      if (!question.trim()) { setValidationError('Enter a prediction question'); return; }
      if (!threshold || isNaN(Number(threshold)) || Number(threshold) <= 0) {
        setValidationError('Enter a valid threshold amount (must be > 0)'); return;
      }

      // ── Chain guard: must be on a supported chain with a factory ───────
      if (!chain || !currentFactory) {
        setValidationError(
          `Unsupported network! Please switch to Base or Base Sepolia. Current chain: ${chain?.name ?? 'Unknown'}`
        );
        return;
      }

      if (selectedDate.valueOf() <= Date.now()) {
        setValidationError('Deadline must be in the future');
        return;
      }

      // ── Build args ────────────────────────────────────────
      // threshold is in human-readable token units — multiply by decimals
      let realSupply: bigint = BigInt(tokenInfo.totalSupply || '0');
      let realDecimals: number = tokenInfo.decimals;

      // Re-fetch on-chain for freshness
      try {
        if (publicClient) {
          const addr = getAddress(tokenAddress);
          const [d, ts] = await Promise.all([
            publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'decimals' }),
            publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'totalSupply' }),
          ]);
          realDecimals = Number(d) || realDecimals;
          realSupply = ts as bigint;
        }
      } catch { /* use cached values */ }

      // Convert human-readable threshold to base units (wei-like)
      let thresholdInBaseUnits: bigint;
      try {
        thresholdInBaseUnits = BigInt(Math.floor(Number(threshold))) * (10n ** BigInt(realDecimals));
      } catch {
        setValidationError('Invalid threshold value');
        return;
      }

      if (thresholdInBaseUnits <= 0n) {
        setValidationError('Threshold must be greater than 0');
        return;
      }

      setValidationError(null);
      setStep('deploying');
      const deadlineSeconds = BigInt(Math.floor(selectedDate.valueOf() / 1000));

      writeContract({
        address: currentFactory!,
        abi: MARKET_FACTORY_ABI,
        functionName: 'createMarket',
        args: [tokenAddress as `0x${string}`, thresholdInBaseUnits, deadlineSeconds, realSupply],
      });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to create market');
      setStep('configure');
    }
  };

  const handleReset = () => {
    setStep('input');
    setTokenAddress('');
    setQuestion('');
    setThreshold('');
    const d = dayjs().add(7, 'day');
    setDeadlineDate(d.format('YYYY-MM-DD'));
    setDeadlineTime(d.format('HH:mm'));
    setTokenInfo(null);
    setValidationError(null);
    setCreatedMarket(null);
    setNewMarketAddress('');
    setStockQuery('');
    setLinkedTicker(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-fade-in">
      <h1 className="text-2xl font-bold text-white text-center mb-2">Create Market</h1>
      <p className="text-sm text-[var(--text-muted)] text-center mb-6">Deploy an on-chain prediction market backed by token supply data</p>

      <StepIndicator current={step} />

      {/* Unsupported chain warning — only shows for chains that aren't Base or Base Sepolia */}
      {isUnsupportedChain && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-red-400 font-semibold text-sm">Unsupported Network</p>
              <p className="text-red-400/80 text-xs mt-1">
                PumpX supports <strong>Base</strong> and <strong>Base Sepolia</strong>. You are connected to <strong>{chain?.name}</strong>.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {SUPPORTED_CHAINS.map(c => (
              <button
                key={c.id}
                onClick={() => switchChain({ chainId: c.id })}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: c.id === 84532 ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'linear-gradient(135deg, #0052ff, #00ff66)' }}
              >
                🔄 {c.name} ({c.label})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current chain indicator */}
      {chain && currentFactory && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[var(--text-secondary)]">
            Connected to <strong className="text-[var(--accent-primary)]">{chain.name}</strong>
          </span>
          {SUPPORTED_CHAINS.filter(c => c.id !== chain.id).map(c => (
            <button
              key={c.id}
              onClick={() => switchChain({ chainId: c.id })}
              className="ml-auto text-[var(--accent-primary)] hover:underline text-xs"
            >
              Switch to {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        {/* Step 1: Token Address Input */}
        {step === 'input' && (
          <div className="space-y-5">
            {/* AI Market Creator */}
            <AIMarketCreator
              onParsed={(parsed) => {
                if (parsed.tokenAddress) setTokenAddress(parsed.tokenAddress);
                if (parsed.question) setQuestion(parsed.question || parsed.suggestedQuestion || '');
                if (parsed.threshold) setThreshold(String(parsed.threshold));
                if (parsed.deadline) {
                  const d = dayjs(parsed.deadline);
                  if (d.isValid()) {
                    setDeadlineDate(d.format('YYYY-MM-DD'));
                    setDeadlineTime(d.format('HH:mm'));
                  }
                }
              }}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--bg-primary)] px-3 text-xs text-[var(--text-muted)]">or enter manually</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">ERC-20 Token Address</label>
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x…"
                className="input w-full font-mono text-sm"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Paste the contract address of any ERC-20 token on Base</p>
            </div>

            {validationError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                {validationError}
              </div>
            )}

            <button
              className="btn-primary w-full"
              onClick={handleValidateToken}
              disabled={!tokenAddress || isValidating}
            >
              {isValidating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Validating…
                </span>
              ) : 'Validate & Continue →'}
            </button>
          </div>
        )}

        {/* Step 2: Configure Market */}
        {step === 'configure' && tokenInfo && (
          <div className="space-y-5">
            {/* Token Info Card */}
            <div className="bg-[var(--bg-elevated)] rounded-lg p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Token Verified</h3>
                <span className="badge text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">✓ Valid</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[var(--text-muted)]">Name</p>
                  <p className="text-white font-medium mt-0.5">{tokenInfo.name}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">Symbol</p>
                  <p className="text-white font-medium mt-0.5">{tokenInfo.symbol}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">Decimals</p>
                  <p className="text-white font-mono font-medium mt-0.5">{tokenInfo.decimals}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">Total Supply</p>
                  <p className="text-white font-mono font-medium mt-0.5">
                    {(Number(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Prediction Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Will ${tokenInfo.symbol} reach the threshold before deadline?`}
                className="input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Threshold <span className="text-[var(--text-muted)]">(in {tokenInfo.symbol} tokens)</span>
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder={`e.g., ${Math.ceil((Number(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals)) * 1.5)}`}
                className="input w-full font-mono text-sm"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Current supply: {(Number(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals)).toLocaleString(undefined, { maximumFractionDigits: 0 })} {tokenInfo.symbol}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Deadline Date</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Deadline Time</label>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
            </div>

            {/* ── Stock Ticker Link (Optional Intelligence Layer) ── */}
            <div className="border border-dashed border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">Link Stock Ticker <span className="text-[var(--text-muted)]">(Optional)</span></p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Connect a real stock to show live price intelligence</p>
                </div>
                {linkedTicker && (
                  <button onClick={() => { setLinkedTicker(null); setStockQuery(''); }} className="text-[10px] text-red-400 hover:text-red-300">
                    Remove
                  </button>
                )}
              </div>

              {linkedTicker && linkedQuote ? (
                <div className="flex items-center justify-between bg-[var(--bg-elevated)] rounded-lg p-3 border border-white/5">
                  <div>
                    <span className="text-xs font-semibold text-[var(--accent-primary)]">{linkedTicker}</span>
                    <div className="mt-1">
                      <StockPriceTicker quote={linkedQuote} size="sm" />
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded">✓ Linked</div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={stockQuery}
                    onChange={(e) => setStockQuery(e.target.value)}
                    placeholder="Search… e.g. AAPL, TSLA, MSFT"
                    className="input w-full text-sm"
                  />
                  {stockSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-[var(--accent-primary)] rounded-full animate-spin" />
                    </div>
                  )}
                  {stockSearchResults.length > 0 && !linkedTicker && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {stockSearchResults.slice(0, 6).map((r) => (
                        <button
                          key={r.symbol}
                          type="button"
                          onClick={() => { setLinkedTicker(r.symbol); setStockQuery(''); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--bg-elevated)] transition-colors border-b border-white/5 last:border-0"
                        >
                          <div>
                            <span className="text-sm font-semibold text-[var(--accent-primary)]">{r.symbol}</span>
                            <span className="text-xs text-[var(--text-muted)] ml-2">{r.name}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)]">{r.region}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {validationError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm whitespace-pre-line">
                {validationError}
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={handleReset}>← Back</button>
              <button
                className="btn-primary flex-1"
                onClick={handleCreateMarket}
                disabled={!threshold || !deadlineDate || !question}
              >
                Deploy Market →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Deploying */}
        {step === 'deploying' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-white font-medium">Deploying Market Contract</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {isPending ? 'Confirm the transaction in your wallet…' : 'Waiting for on-chain confirmation…'}
              </p>
            </div>
            {writeError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
                <p className="text-red-400 text-sm font-medium mb-1">Transaction Failed</p>
                <p className="text-red-400/80 text-xs">{writeError.message?.slice(0, 120)}</p>
                <button onClick={() => setStep('configure')} className="btn-secondary text-xs mt-3">← Go Back</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && createdMarket && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-emerald-400 text-2xl">✓</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Market Deployed</h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">Your prediction market is live on-chain</p>
            </div>

            <div className="bg-[var(--bg-elevated)] rounded-lg p-4 border border-white/5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Question</span>
                <span className="text-white text-right max-w-[60%]">{createdMarket.question}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Contract</span>
                <span className="text-[var(--accent-primary)] font-mono text-xs">{newMarketAddress.slice(0, 10)}…{newMarketAddress.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Token</span>
                <span className="text-white">{createdMarket.tokenName} ({createdMarket.tokenSymbol})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Threshold</span>
                <span className="text-white font-mono">
                  {(createdMarket.threshold / Math.pow(10, createdMarket.tokenDecimals)).toLocaleString()} {createdMarket.tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Deadline</span>
                <span className="text-white">{new Date(createdMarket.deadline).toLocaleString()}</span>
              </div>
              {createdMarket.stockTicker && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Linked Stock</span>
                  <span className="text-[var(--accent-primary)] font-semibold">{createdMarket.stockTicker}</span>
                </div>
              )}
              {createdMarket.stockPriceAtCreation && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Stock Price at Creation</span>
                  <span className="text-white font-mono">${createdMarket.stockPriceAtCreation.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={handleReset}>Create Another</button>
              <a href="/markets/view" className="btn-primary flex-1 text-center">View Markets →</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
