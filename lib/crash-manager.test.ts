import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrashManager } from './crash-manager';

vi.mock('server-only', () => ({}));

type TestableManager = {
  timer: ReturnType<typeof setInterval> | null;
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  syncPlayer: CrashManager['syncPlayer'];
  trade: CrashManager['trade'];
  clientPlayerView: CrashManager['clientPlayerView'];
};

const managers: TestableManager[] = [];

function manager(): TestableManager {
  const instance = new CrashManager('continuous') as unknown as TestableManager;
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

describe('continuous Crash manager actions', () => {
  it('rejects 10x and charges the 2% notional fee exactly once', () => {
    const game = manager();
    const address = 'demo-manager-fee';
    game.syncPlayer(address, 200, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.2;

    expect(game.trade(address, 'buy', 100, 10)).toMatchObject({
      ok: false,
      error: 'invalid leverage',
    });
    expect(game.trade(address, 'buy', 100, 5)).toMatchObject({
      ok: true,
      action: 'open',
      balance: 90,
    });

    const view = game.clientPlayerView(address);
    expect(view.positionSide).toBe('buy');
    expect(view.positionEntryPrice).toBe(1.2);
  });

  it('allows a live SELL and settles from the recorded entry without exponential growth', () => {
    const game = manager();
    const address = 'demo-manager-sell';
    game.syncPlayer(address, 200, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.2;
    expect(game.trade(address, 'buy', 100, 5).ok).toBe(true);

    game.mult = 1.21;
    const sold = game.trade(address, 'sell', 100, 5);
    expect(sold).toMatchObject({ ok: true, action: 'close' });
    expect(sold.balance).toBe(194.167);
    expect(game.clientPlayerView(address).hasPosition).toBe(false);
  });
});
