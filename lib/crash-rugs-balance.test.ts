import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrashManager } from './crash-manager';
import { calcLotsPnl } from './crash-pnl';
import {
  guardCashoutOnStream,
  resolveClientSyncBalance,
  resolvePlayableBalance,
  shouldApplyServerBalance,
} from './session-balance';
import type { FullState } from './crash-types';

vi.mock('server-only', () => ({}));

type Harness = {
  timer: ReturnType<typeof setInterval> | null;
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  gameId: number;
  syncPlayer: CrashManager['syncPlayer'];
  trade: CrashManager['trade'];
  cashOut: CrashManager['cashOut'];
  clientPlayerView: CrashManager['clientPlayerView'];
  crash: () => void;
};

const managers: Harness[] = [];

function manager(): Harness {
  const instance = new CrashManager('continuous') as unknown as Harness;
  if (instance.timer) clearInterval(instance.timer);
  instance.timer = null;
  managers.push(instance);
  return instance;
}

afterEach(() => {
  for (const instance of managers.splice(0)) {
    if (instance.timer) clearInterval(instance.timer);
  }
});

function baseState(over: Partial<FullState> = {}): FullState {
  return {
    phase: 'running',
    gameId: 1,
    mult: 2,
    waitLeft: 0,
    hasPosition: true,
    hasLivePosition: true,
    entryPending: false,
    positionSide: 'buy',
    positionAmount: 1000,
    positionLeverage: 1,
    positionEntryPrice: 2,
    positionLots: [{ amount: 1000, entry: 2, leverage: 1 }],
    balance: 3000,
    lastResult: null,
    autoSell: null,
    currentRound: {
      id: 1,
      mode: 'continuous',
      crashPoint: null,
      revealed: false,
      seed: 's',
      nonce: 1,
      hash: 'h',
    },
    ...over,
  } as FullState;
}

describe('rugs.fun balance & PnL rules', () => {
  it('BUY deducts stake immediately and records entry mult', () => {
    const game = manager();
    game.syncPlayer('demo-buy', 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 2.0;

    expect(game.trade('demo-buy', 'buy', 1000, 1).ok).toBe(true);
    const v = game.clientPlayerView('demo-buy');
    expect(v.balance).toBeCloseTo(4000, 2);
    expect(v.positionAmount).toBeCloseTo(1000, 2);
    expect(v.positionLots).toHaveLength(1);
    expect(v.positionLots?.[0]?.entry).toBeCloseTo(2.0, 3);
  });

  it('allows multiple buys at different entries and sums unrealized PnL', () => {
    const game = manager();
    game.syncPlayer('demo-stack', 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 2.0;
    expect(game.trade('demo-stack', 'buy', 1000, 1).ok).toBe(true);
    game.mult = 3.0;
    expect(game.trade('demo-stack', 'buy', 1000, 1).ok).toBe(true);

    const v = game.clientPlayerView('demo-stack');
    expect(v.balance).toBeCloseTo(3000, 2);
    expect(v.positionAmount).toBeCloseTo(2000, 2);
    expect(v.positionLots).toHaveLength(2);

    game.mult = 4.0;
    // 1000*(4/2-1) + 1000*(4/3-1) = 1000 + 333.333 = 1333.333
    const pnl = calcLotsPnl('buy', v.positionLots, 4.0);
    expect(pnl).toBeCloseTo(1333.333, 2);

    game.mult = 1.5;
    // price under entries → unrealized loss only, position stays open
    const loss = calcLotsPnl('buy', v.positionLots, 1.5);
    expect(loss).toBeLessThan(0);
    expect(game.clientPlayerView('demo-stack').hasPosition).toBe(true);
    expect(game.clientPlayerView('demo-stack').balance).toBeCloseTo(3000, 2);
  });

  it('SELL returns bet + realized PnL to balance', () => {
    const game = manager();
    game.syncPlayer('demo-sell-win', 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 2.0;
    expect(game.trade('demo-sell-win', 'buy', 1000, 1).ok).toBe(true);
    game.mult = 3.0;
    // PnL = 1000*(3/2-1) = 500 → return 1500
    const sold = game.cashOut('demo-sell-win', 1);
    expect(sold.ok).toBe(true);
    const v = game.clientPlayerView('demo-sell-win');
    expect(v.hasPosition).toBe(false);
    expect(v.balance).toBeCloseTo(5500, 2);
  });

  it('partial SELL then hold to rug loses only remaining stake', () => {
    const game = manager();
    game.syncPlayer('demo-partial-rug', 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 2.0;
    expect(game.trade('demo-partial-rug', 'buy', 2000, 1).ok).toBe(true);
    game.mult = 3.0;
    // sell 50% = 1000 margin; pnl = 1000*(3/2-1)=500; return 1500 → bal 3000+1500=4500
    expect(game.cashOut('demo-partial-rug', 0.5).ok).toBe(true);
    const mid = game.clientPlayerView('demo-partial-rug');
    expect(mid.positionAmount).toBeCloseTo(1000, 2);
    expect(mid.balance).toBeCloseTo(4500, 2);

    game.crash();
    const after = game.clientPlayerView('demo-partial-rug');
    expect(after.hasPosition).toBe(false);
    expect(after.balance).toBeCloseTo(4500, 2);
    expect(after.lastResult).toMatchObject({ won: false, amount: -1000 });
  });

  it('holding stacked buys until rug loses full locked amount (balance never increases)', () => {
    const game = manager();
    game.syncPlayer('demo-full-rug', 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 2.0;
    expect(game.trade('demo-full-rug', 'buy', 1000, 1).ok).toBe(true);
    game.mult = 3.0;
    expect(game.trade('demo-full-rug', 'buy', 1000, 1).ok).toBe(true);
    expect(game.clientPlayerView('demo-full-rug').balance).toBeCloseTo(3000, 2);

    game.crash();
    const after = game.clientPlayerView('demo-full-rug');
    expect(after.hasPosition).toBe(false);
    expect(after.balance).toBeCloseTo(3000, 2);
    expect(after.lastResult).toMatchObject({ won: false, amount: -2000 });
  });

  it('syncPlayer cannot mint demo credits while a position is open', () => {
    const game = manager();
    game.syncPlayer('demo-no-mint', 1000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.5;
    expect(game.trade('demo-no-mint', 'buy', 1000, 1).ok).toBe(true);
    expect(game.clientPlayerView('demo-no-mint').balance).toBeCloseTo(0, 2);

    // Simulated auto-refill push while locked
    game.syncPlayer('demo-no-mint', 100, undefined, { boot: false });
    expect(game.clientPlayerView('demo-no-mint').balance).toBeCloseTo(0, 2);

    game.crash();
    expect(game.clientPlayerView('demo-no-mint').balance).toBeCloseTo(0, 2);
  });

  it('sell at a loss returns residual equity only', () => {
    const game = manager();
    game.syncPlayer('demo-sell-loss', 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 2.0;
    expect(game.trade('demo-sell-loss', 'buy', 1000, 1).ok).toBe(true);
    game.mult = 1.0;
    // pnl = 1000*(1/2-1) = -500 → return 500
    expect(game.cashOut('demo-sell-loss', 1).ok).toBe(true);
    expect(game.clientPlayerView('demo-sell-loss').balance).toBeCloseTo(4500, 2);
  });
});

describe('client sync guards (rugs.fun)', () => {
  it('playable balance trusts server 0 after all-in', () => {
    expect(
      resolvePlayableBalance(
        { connected: true, blackballsBalance: 100, isRealWallet: false },
        0,
      ),
    ).toBe(0);
  });

  it('shouldApplyServerBalance accepts post-rug zero', () => {
    expect(shouldApplyServerBalance(0, 100, true)).toBe(true);
  });

  it('resolveClientSyncBalance does not auto-refill 0 by default', () => {
    expect(
      resolveClientSyncBalance({ connected: true, blackballsBalance: 0, isRealWallet: false }),
    ).toBe(0);
    expect(
      resolveClientSyncBalance(
        { connected: true, blackballsBalance: 0, isRealWallet: false },
        { allowRefill: true },
      ),
    ).toBe(100);
  });

  it('cashout guard does not undo a stack-buy debit', () => {
    const prev = baseState({ balance: 3000, positionAmount: 1000 });
    const next = baseState({
      balance: 2000,
      positionAmount: 2000,
      positionLots: [
        { amount: 1000, entry: 2, leverage: 1 },
        { amount: 1000, entry: 3, leverage: 1 },
      ],
    });
    const guarded = guardCashoutOnStream(prev, next, Date.now() + 10_000, false);
    expect(guarded.balance).toBeCloseTo(2000, 2);
    expect(guarded.positionAmount).toBeCloseTo(2000, 2);
    expect(guarded.positionLots).toHaveLength(2);
  });
});
