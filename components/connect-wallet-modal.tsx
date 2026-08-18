'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { isLikelyMobileDevice } from '@/hooks/use-page-visibility';
import {
  friendlyWalletConnectError,
  getWalletConnectProjectId,
  hasInjectedProvider,
  metamaskDappLink,
  shouldShowInjectedConnect,
  walletConnectParams,
} from '@/lib/wallet-connect-ux';

interface ConnectWalletModalProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({ open, onClose }: ConnectWalletModalProps) {
  const { connect, connectors, isPending, error } = useConnect();
  const { isConnected } = useAccount();
  const [isMobile, setIsMobile] = useState(false);
  const [injectedReady, setInjectedReady] = useState(false);

  useEffect(() => {
    setIsMobile(isLikelyMobileDevice());
    setInjectedReady(hasInjectedProvider());
  }, [open]);

  useEffect(() => {
    if (open && isConnected) onClose();
  }, [open, isConnected, onClose]);

  if (!open) return null;

  const injected = connectors.find(c => c.id === 'injected');
  const walletConnect = connectors.find(c => c.id === 'walletConnect');
  const wcConfigured = Boolean(getWalletConnectProjectId());
  const showInjected = shouldShowInjectedConnect(isMobile, injectedReady);
  const showWalletConnect = Boolean(walletConnect) && wcConfigured;
  const showOpenInWallet = isMobile && !injectedReady;

  const connectWith = (connector: (typeof connectors)[number]) => {
    connect(walletConnectParams(connector));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-2xl border border-amber-400/25 bg-[#12141a] p-5 font-arcade"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-extrabold text-white">Connect wallet</div>
            <div className="text-[11px] text-white/45 mt-1">
              Play-money credits are tied to this address. Real tokens are prizes only — never
              deposited or cashed out here.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-extrabold text-white/50 px-2 py-1"
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {showWalletConnect && isMobile && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => walletConnect && connectWith(walletConnect)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-black border-b-[3px] border-emerald-700 disabled:opacity-50"
            >
              {isPending ? 'Connecting…' : 'WalletConnect'}
            </button>
          )}

          {showInjected && injected && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => connectWith(injected)}
              className={`w-full py-3 rounded-xl text-sm font-black border-b-[3px] disabled:opacity-50 ${
                isMobile && showWalletConnect
                  ? 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-700'
              }`}
            >
              {isPending ? 'Connecting…' : 'Browser wallet'}
            </button>
          )}

          {showWalletConnect && !isMobile && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => walletConnect && connectWith(walletConnect)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-black border-b-[3px] border-white/20 disabled:opacity-50"
            >
              {isPending ? 'Connecting…' : 'WalletConnect'}
            </button>
          )}

          {showOpenInWallet && (
            <a
              href={metamaskDappLink(typeof window !== 'undefined' ? window.location.href : undefined)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-black border-b-[3px] border-white/20 text-center"
            >
              Open in wallet app
            </a>
          )}
        </div>

        {isMobile && !injectedReady && (
          <p className="mt-3 text-[11px] font-bold text-white/45">
            Phone browsers don’t have a wallet extension. Use WalletConnect, or open this site inside
            MetaMask / Trust Wallet.
          </p>
        )}

        {!showWalletConnect && isMobile && !injectedReady && (
          <p className="mt-2 text-[11px] font-bold text-amber-300">
            WalletConnect is not configured yet. Open this page in your wallet app to play.
          </p>
        )}

        {error && (
          <p className="mt-3 text-[11px] font-bold text-rose-400">
            {friendlyWalletConnectError(error.message)}
          </p>
        )}
      </div>
    </div>
  );
}
