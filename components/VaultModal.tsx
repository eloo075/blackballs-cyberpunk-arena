'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useCrashVault } from '@/hooks/useCrashVault';

const QUICK_DEPOSITS = [1000, 5000, 10000];

interface VaultModalProps {
  open: boolean;
  onClose: () => void;
}

export function VaultModal({ open, onClose }: VaultModalProps) {
  const vault = useCrashVault();
  const [customAmount, setCustomAmount] = useState('1000');

  useEffect(() => {
    if (open) void vault.refreshBalances();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = vault.isApproving || vault.isDepositing || vault.isWithdrawing || vault.isConfirming;
  const parsed = parseFloat(customAmount) || 0;

  const handleDeposit = async () => {
    await vault.deposit(parsed);
  };

  const handleWithdraw = async () => {
    await vault.withdraw(vault.sessionBalance);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="cp-panel w-full sm:max-w-md font-mono border border-cp-cyan/30 overflow-hidden safe-bottom"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-cp-cyan/20 bg-black/40">
              <div>
                <div className="text-xs font-black tracking-[0.2em] neon-cyan">VAULT ESCROW</div>
                <div className="text-[9px] text-white/40">CrashVault · Robinhood Chain</div>
              </div>
              <button
                onClick={onClose}
                className="cp-btn px-3 py-1.5 text-[10px] border border-white/20 text-white/60"
              >
                CLOSE
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!vault.vaultConfigured && (
                <div className="text-[11px] text-cp-yellow border border-cp-yellow/30 bg-cp-yellow/5 p-3 rounded">
                  Vault not configured. Set NEXT_PUBLIC_CRASH_VAULT_ADDRESS and token RPC env vars.
                  Demo mode uses off-chain balance.
                </div>
              )}

              {vault.vaultConfigured && !vault.isConnected && (
                <div className="space-y-3 text-center py-4">
                  <p className="text-[11px] text-white/50">Connect your wallet to deposit $BLACKBALLS</p>
                  <button
                    onClick={vault.connectWallet}
                    disabled={vault.isConnecting}
                    className="cp-btn w-full py-3 text-xs font-black bg-gradient-to-r from-cp-cyan to-cp-purple text-white"
                  >
                    {vault.isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
                  </button>
                </div>
              )}

              {vault.vaultConfigured && vault.isConnected && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <BalanceCard label="WALLET BlackBalls" value={vault.walletBalance} accent="cyan" />
                    <BalanceCard label="ESCROW SESSION" value={vault.sessionBalance} accent="yellow" />
                  </div>

                  <div className="text-[9px] text-white/35 truncate">
                    {vault.address} · Allowance {vault.allowance.toFixed(2)} BlackBalls
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/40 uppercase tracking-wider">Deposit amount</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      disabled={busy}
                      className="w-full bg-black/50 border border-cp-cyan/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cp-cyan/60"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {QUICK_DEPOSITS.map(v => (
                        <button
                          key={v}
                          onClick={() => setCustomAmount(String(v))}
                          disabled={busy}
                          className="cp-btn py-2 text-[10px] font-bold border border-white/10 text-white/50 hover:border-cp-cyan/40 hover:text-cp-cyan"
                        >
                          {v >= 1000 ? `${v / 1000}K` : v}
                        </button>
                      ))}
                      <button
                        onClick={() => setCustomAmount(String(Math.floor(vault.walletBalance)))}
                        disabled={busy}
                        className="cp-btn py-2 text-[10px] font-bold border border-cp-yellow/40 text-cp-yellow"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleDeposit}
                    disabled={busy || parsed <= 0 || parsed > vault.walletBalance}
                    className="cp-btn w-full py-3.5 text-sm font-black bg-gradient-to-r from-cp-green to-cp-cyan text-black disabled:opacity-40"
                  >
                    {vault.isApproving
                      ? 'APPROVING...'
                      : vault.isDepositing || vault.pendingAction === 'deposit'
                        ? 'DEPOSITING...'
                        : vault.isConfirming
                          ? 'CONFIRMING...'
                          : 'DEPOSIT & PLAY'}
                  </button>

                  <button
                    onClick={handleWithdraw}
                    disabled={busy || vault.sessionBalance <= 0}
                    className="cp-btn w-full py-2.5 text-[11px] font-bold border border-cp-magenta/40 text-cp-magenta disabled:opacity-40"
                  >
                    {vault.isWithdrawing ? 'WITHDRAWING...' : `WITHDRAW ${vault.sessionBalance.toFixed(2)} BlackBalls`}
                  </button>

                  {vault.txHash && (
                    <div className="text-[9px] text-cp-green break-all">TX: {vault.txHash}</div>
                  )}
                  {vault.error && (
                    <div className="text-[10px] text-cp-magenta border border-cp-magenta/30 bg-cp-magenta/5 p-2 rounded">
                      {vault.error}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BalanceCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'cyan' | 'yellow';
}) {
  const color = accent === 'cyan' ? 'text-cp-cyan' : 'text-cp-yellow';
  return (
    <div className="bg-black/40 border border-white/10 p-3 rounded">
      <div className="text-[9px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-black ${color}`}>{value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
      <div className="text-[9px] text-white/30">$BLACKBALLS</div>
    </div>
  );
}
