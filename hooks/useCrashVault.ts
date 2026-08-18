'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { waitForTransactionReceipt } from '@wagmi/core';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi/config';
import { formatUnits, parseUnits } from 'viem';
import { CRASH_VAULT_ABI } from '@/lib/chain/crash-vault-abi';
import { ERC20_ABI } from '@/lib/chain/erc20-abi';
import {
  getPublicTokenDecimals,
  getPublicTokenAddress,
  getPublicVaultAddress,
  isVaultConfigured,
} from '@/lib/chain/public-config';
import { useWallet } from '@/lib/wallet-context';
import { DEMO_REWARDS_MODE } from '@/lib/launch-surface';
import { walletConnectParams } from '@/lib/wallet-connect-ux';

export function useCrashVault() {
  const vaultConfigured = isVaultConfigured();
  const vaultAddress = getPublicVaultAddress();
  const tokenAddress = getPublicTokenAddress();
  const decimals = getPublicTokenDecimals();

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { setBlackballsBalance, holdBonuses } = useWallet();

  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'approve' | 'deposit' | 'withdraw' | null>(null);

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const { data: walletBalanceRaw, refetch: refetchWalletBalance } = useReadContract({
    address: tokenAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(vaultConfigured && address && tokenAddress) },
  });

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    query: { enabled: Boolean(vaultConfigured && address && tokenAddress && vaultAddress) },
  });

  const { data: sessionBalanceRaw, refetch: refetchSessionBalance } = useReadContract({
    address: vaultAddress ?? undefined,
    abi: CRASH_VAULT_ABI,
    functionName: 'sessionBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(vaultConfigured && address && vaultAddress) },
  });

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const walletBalance = useMemo(
    () => (walletBalanceRaw != null ? parseFloat(formatUnits(walletBalanceRaw, decimals)) : 0),
    [walletBalanceRaw, decimals],
  );

  const sessionBalance = useMemo(
    () => (sessionBalanceRaw != null ? parseFloat(formatUnits(sessionBalanceRaw, decimals)) : 0),
    [sessionBalanceRaw, decimals],
  );

  const allowance = useMemo(
    () => (allowanceRaw != null ? parseFloat(formatUnits(allowanceRaw, decimals)) : 0),
    [allowanceRaw, decimals],
  );

  const syncSessionToGame = useCallback(async () => {
    if (DEMO_REWARDS_MODE) return;
    if (!address) return;
    const res = await fetch('/api/crash/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        balance: sessionBalance,
        stimmy: holdBonuses.stimmy,
        frenzy: holdBonuses.frenzy,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.balance === 'number') {
      setBlackballsBalance(data.balance);
    }
  }, [address, sessionBalance, holdBonuses.stimmy, holdBonuses.frenzy, setBlackballsBalance]);

  useEffect(() => {
    if (isConfirmed && txHash) {
      void refetchWalletBalance();
      void refetchAllowance();
      void refetchSessionBalance().then(() => syncSessionToGame());
      setPendingAction(null);
      setIsApproving(false);
      setIsDepositing(false);
      setIsWithdrawing(false);
    }
  }, [
    isConfirmed,
    txHash,
    refetchWalletBalance,
    refetchAllowance,
    refetchSessionBalance,
    syncSessionToGame,
  ]);

  const connectWallet = useCallback(() => {
    const injectedConnector = connectors.find(c => c.id === 'injected') ?? connectors[0];
    if (injectedConnector) connect(walletConnectParams(injectedConnector));
  }, [connect, connectors]);

  const deposit = useCallback(
    async (amountTokens: number) => {
      if (!vaultConfigured || !address || !tokenAddress || !vaultAddress) {
        setError('Vault not configured');
        return;
      }
      if (amountTokens <= 0) {
        setError('Invalid amount');
        return;
      }

      setError(null);
      const amountWei = parseUnits(amountTokens.toFixed(Math.min(decimals, 8)), decimals);

      try {
        const currentAllowance = allowanceRaw ?? BigInt(0);
        if (currentAllowance < amountWei) {
          setIsApproving(true);
          setPendingAction('approve');
          const approveHash = await writeContractAsync({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [vaultAddress, amountWei],
          });
          setTxHash(approveHash);
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
          await refetchAllowance();
          setIsApproving(false);
        }

        setIsDepositing(true);
        setPendingAction('deposit');
        const depositHash = await writeContractAsync({
          address: vaultAddress,
          abi: CRASH_VAULT_ABI,
          functionName: 'depositWager',
          args: [amountWei],
        });
        setTxHash(depositHash);
      } catch (err) {
        setIsApproving(false);
        setIsDepositing(false);
        setPendingAction(null);
        setError(err instanceof Error ? err.message : 'Deposit failed');
      }
    },
    [
      vaultConfigured,
      address,
      tokenAddress,
      vaultAddress,
      decimals,
      allowanceRaw,
      writeContractAsync,
      refetchAllowance,
    ],
  );

  const withdraw = useCallback(
    async (amountTokens: number) => {
      if (!vaultConfigured || !address || !vaultAddress) {
        setError('Vault not configured');
        return;
      }
      if (amountTokens <= 0) {
        setError('Invalid amount');
        return;
      }

      setError(null);
      setIsWithdrawing(true);
      setPendingAction('withdraw');

      try {
        const amountWei = parseUnits(amountTokens.toFixed(Math.min(decimals, 8)), decimals);
        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: CRASH_VAULT_ABI,
          functionName: 'withdrawSession',
          args: [amountWei],
        });
        setTxHash(hash);
      } catch (err) {
        setIsWithdrawing(false);
        setPendingAction(null);
        setError(err instanceof Error ? err.message : 'Withdraw failed');
      }
    },
    [vaultConfigured, address, vaultAddress, decimals, writeContractAsync],
  );

  const refreshBalances = useCallback(async () => {
    await Promise.all([refetchWalletBalance(), refetchAllowance(), refetchSessionBalance()]);
    await syncSessionToGame();
  }, [refetchWalletBalance, refetchAllowance, refetchSessionBalance, syncSessionToGame]);

  return {
    vaultConfigured,
    address,
    isConnected,
    chainId,
    walletBalance,
    sessionBalance,
    allowance,
    isApproving,
    isDepositing,
    isWithdrawing,
    isConnecting,
    isWritePending,
    isConfirming,
    pendingAction,
    txHash,
    error,
    connectWallet,
    disconnect,
    deposit,
    withdraw,
    refreshBalances,
    syncSessionToGame,
  };
}
