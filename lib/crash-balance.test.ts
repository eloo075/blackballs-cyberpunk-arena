import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrashManager } from './crash-manager';

vi.mock('server-only', () => ({}));

type Harness = {
  timer: ReturnType<typeof setInterval> | null;
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  gameId: number;
  lastSettledRoundId: number;
  syncPlayer: CrashManager['syncPlayer'];
  trade: CrashManager['trade'];
  cancelCountdownEntry: CrashManager['cancelCountdownEntry'];
  clientPlayerView: CrashManager['clientPlayerView'];
  crash: () => void;
  beginRound: () => void;
  reconcilePlayerFromClient: CrashManager['reconcilePlayerFromClient'];
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

describe('Demo balance integrity (open / rug / cancel)', () => {
  it('deducts on open and never credits on rug loss', () => {
    const game = manager();
    const address = 'demo-rug-loss';
    game.syncPlayer(address, 140.18, undefined, { boot: true });

    game.phase = 'running';
    game.mult = 1.05;
    const opened = game.trade(address, 'buy', 106, 1);
    expect(opened.ok).toBe(true);
    expect(opened.balance).toBeCloseTo(34.18, 2);

    game.crash();
    const after = game.clientPlayerView(address);
    expect(after.hasPosition).toBe(false);
    expect(after.entryPending).toBe(false);
    expect(after.balance).toBeCloseTo(34.18, 2);
    expect(after.balance).toBeLessThan(140.18);
  });

  it('cancel during presale refunds exactly once', () => {
    const game = manager();
    const address = 'demo-cancel-once';
    game.syncPlayer(address, 140.18, undefined, { boot: true });
    game.phase = 'waiting';

    expect(game.trade(address, 'buy', 106, 1).ok).toBe(true);
    expect(game.clientPlayerView(address).balance).toBeCloseTo(34.18, 2);
    expect(game.clientPlayerView(address).entryPending).toBe(true);

    const cancelled = game.cancelCountdownEntry(address);
    expect(cancelled.ok).toBe(true);
    expect(cancelled.balance).toBeCloseTo(140.18, 2);

    const again = game.cancelCountdownEntry(address);
    expect(again.ok).toBe(true);
    expect(again.balance).toBeCloseTo(140.18, 2);
    expect(game.clientPlayerView(address).balance).toBeCloseTo(140.18, 2);
  });

  it('stale client reconcile after rug cannot mint a free refund', () => {
    const game = manager();
    const address = 'demo-ghost-reconcile';
    game.syncPlayer(address, 140.18, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.2;
    expect(game.trade(address, 'buy', 106, 1).ok).toBe(true);
    game.crash();
    expect(game.clientPlayerView(address).balance).toBeCloseTo(34.18, 2);

    game.phase = 'waiting';
    game.gameId = game.gameId + 1;
    game.lastSettledRoundId = game.gameId - 1;

    const revived = game.reconcilePlayerFromClient(address, {
      gameId: game.gameId,
      phase: 'waiting',
      entryPending: true,
      hasPosition: true,
      positionAmount: 106,
      positionLeverage: 1,
      balance: 140.18,
    });
    expect(revived).toBe(false);
    expect(game.clientPlayerView(address).entryPending).toBe(false);
    expect(game.clientPlayerView(address).balance).toBeCloseTo(34.18, 2);

    game.cancelCountdownEntry(address);
    expect(game.clientPlayerView(address).balance).toBeCloseTo(34.18, 2);
  });

  it('presale buy that rugs after round start loses the stake', () => {
    const game = manager();
    const address = 'demo-presale-rug';
    game.syncPlayer(address, 200, undefined, { boot: true });
    game.phase = 'waiting';
    expect(game.trade(address, 'buy', 50, 1).ok).toBe(true);
    expect(game.clientPlayerView(address).balance).toBeCloseTo(150, 2);

    game.beginRound();
    expect(game.clientPlayerView(address).hasPosition).toBe(true);
    expect(game.clientPlayerView(address).balance).toBeCloseTo(150, 2);

    game.crash();
    expect(game.clientPlayerView(address).balance).toBeCloseTo(150, 2);
    expect(game.clientPlayerView(address).hasPosition).toBe(false);
    expect(game.clientPlayerView(address).lastResult).toMatchObject({
      won: false,
      amount: -50,
    });
  });

  it('stacked live buys that never cash out lose 100% of remaining stake', () => {
    const game = manager();
    const address = 'demo-full-rug-loss';
    game.syncPlayer(address, 1000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.5;
    expect(game.trade(address, 'buy', 200, 1).ok).toBe(true);
    game.mult = 2.4;
    expect(game.trade(address, 'buy', 100, 1).ok).toBe(true);

    const beforeRug = game.clientPlayerView(address);
    expect(beforeRug.balance).toBeCloseTo(700, 2);
    expect(beforeRug.positionAmount).toBeCloseTo(300, 2);

    game.crash();
    const after = game.clientPlayerView(address);
    expect(after.hasPosition).toBe(false);
    // No residual equity credited from the 0.01x floor — stake stays spent.
    expect(after.balance).toBeCloseTo(700, 2);
    expect(after.lastResult).toMatchObject({
      won: false,
      amount: -300,
    });
  });

  it('optimistic client reconcile before live buy does not create a second lot', () => {
    const game = manager();
    const address = 'demo-no-double-lot';
    game.syncPlayer(address, 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 4.02;

    // Mimic old bug: client already showed the optimistic open, then enter reconciled it
    // before placeLiveEntry — that used to stack a duplicate lot.
    const reconciled = game.reconcilePlayerFromClient(address, {
      gameId: game.gameId,
      phase: 'running',
      hasPosition: true,
      hasLivePosition: true,
      entryPending: false,
      positionSide: 'buy',
      positionAmount: 1000,
      positionLeverage: 1,
      positionEntryPrice: 4.02,
      balance: 4000,
    });
    expect(reconciled).toBe(false);
    expect(game.clientPlayerView(address).hasPosition).toBe(false);

    expect(game.trade(address, 'buy', 1000, 1).ok).toBe(true);
    const view = game.clientPlayerView(address);
    expect(view.positionAmount).toBeCloseTo(1000, 2);
    expect(view.positionLots).toHaveLength(1);
    expect(view.positionLots?.[0]?.amount).toBeCloseTo(1000, 2);
    expect(view.balance).toBeCloseTo(4000, 2);
  });

  it('partial cash-out then rug loses only the remaining open stake', () => {
    const game = manager();
    const address = 'demo-partial-then-rug';
    game.syncPlayer(address, 1000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.2;
    expect(game.trade(address, 'buy', 200, 1).ok).toBe(true);
    game.mult = 2.0;
    const cashed = game.cashOut(address, 0.5);
    expect(cashed.ok).toBe(true);

    const mid = game.clientPlayerView(address);
    expect(mid.hasPosition).toBe(true);
    expect(mid.positionAmount).toBeCloseTo(100, 2);
    const balanceAfterPartial = mid.balance;

    game.crash();
    const after = game.clientPlayerView(address);
    expect(after.hasPosition).toBe(false);
    expect(after.balance).toBeCloseTo(balanceAfterPartial, 2);
    expect(after.lastResult).toMatchObject({
      won: false,
      amount: -100,
    });
  });
});
