'use client';

import { useConnect } from 'wagmi';

interface ConnectWalletModalProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectWalletModal({ open, onClose }: ConnectWalletModalProps) {
  const { connect, connectors, isPending, error } = useConnect();

  if (!open) return null;

  const injected = connectors.find(c => c.id === 'injected') ?? connectors[0];

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
              Play-money credits are tied to this address. Real tokens are prizes only — never deposited or cashed out here.
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
        <button
          type="button"
          disabled={!injected || isPending}
          onClick={() => {
            if (!injected) return;
            connect({ connector: injected });
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-black border-b-[3px] border-emerald-700 disabled:opacity-50"
        >
          {isPending ? 'Connecting…' : 'Connect browser wallet'}
        </button>
        {error && (
          <p className="mt-3 text-[11px] font-bold text-rose-400">{error.message}</p>
        )}
        {!injected && (
          <p className="mt-3 text-[11px] font-bold text-amber-300">
            No injected wallet found. Install MetaMask or another 0x wallet.
          </p>
        )}
      </div>
    </div>
  );
}
