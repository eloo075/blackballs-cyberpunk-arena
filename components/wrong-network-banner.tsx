'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { robinhoodChain } from '@/lib/wagmi/chains';
import { REQUIRE_GAME_CHAIN } from '@/lib/launch-surface';

/** Prompt a connected wallet on the wrong chain to switch — do not fail silently. */
export function WrongNetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  if (!REQUIRE_GAME_CHAIN) return null;
  if (!isConnected || chainId == null || chainId === robinhoodChain.id) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 z-[70] sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-sm rounded-xl border border-amber-400/40 bg-[#12141a] p-3 font-arcade shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
      <div className="text-[12px] font-extrabold text-amber-200">Switch network</div>
      <p className="mt-1 text-[11px] font-bold text-white/60">
        This game uses {robinhoodChain.name} (chain {robinhoodChain.id}). Your wallet is on chain{' '}
        {chainId}.
      </p>
      <button
        type="button"
        disabled={isPending || !switchChain}
        onClick={() => switchChain?.({ chainId: robinhoodChain.id })}
        className="mt-2 w-full py-2 rounded-lg bg-amber-400 text-black text-[12px] font-black disabled:opacity-50"
      >
        {isPending ? 'Switching…' : `Switch to ${robinhoodChain.name}`}
      </button>
      {error && (
        <p className="mt-2 text-[10px] font-bold text-rose-400">
          Could not switch automatically. Open your wallet and select {robinhoodChain.name}.
        </p>
      )}
    </div>
  );
}
