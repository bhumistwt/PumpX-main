import { useAccount, useReadContract } from "wagmi";
import { useEffect } from "react";

// USDC on Base Sepolia
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;

export default function useToken() {
  const { address: ownerAddress, chainId } = useAccount();

  const { data: walletBalanceData, refetch: refetchBalance } = useReadContract({
    chainId: chainId,
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: ownerAddress ? [ownerAddress] : undefined,
  });

  useEffect(() => {
    if (chainId && ownerAddress) refetchBalance();
  }, [chainId, ownerAddress, refetchBalance]);

  return {
    userBalance: walletBalanceData ?? BigInt(0),
    refetchBalance,
  };
}
