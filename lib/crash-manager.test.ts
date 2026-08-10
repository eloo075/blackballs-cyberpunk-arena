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
  it('continuous live buy deducts stake at 1x with no open fee', () => {
    const game = manager();
    const address = 'demo-manager-fee';
    game.syncPlayer(address, 200, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.2;

    expect(game.trade(address, 'buy', 100, 10)).toMatchObject({
      ok: false,
      error: 'invalid leverage',
    });
    expect(game.trade(address, 'buy', 100, 1)).toMatchObject({
      ok: true,
      action: 'open',
      balance: 100,
    });

    const view = game.clientPlayerView(address);
    expect(view.positionSide).toBe('buy');
    expect(view.positionEntryPrice).toBe(1.2);
    expect(view.positionLeverage).toBe(1);
  });

  it('allows a live SELL and settles from the recorded entry without exponential growth', () => {
    const game = manager();
    const address = 'demo-manager-sell';
    game.syncPlayer(address, 200, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.2;
    expect(game.trade(address, 'buy', 100, 1).ok).toBe(true);
    expect(game.clientPlayerView(address).balance).toBe(100);

    game.mult = 1.21;
    const sold = game.trade(address, 'sell', 100, 1);
    expect(sold).toMatchObject({ ok: true, action: 'close' });
    // 1x long: pnl = 100 * (1.21/1.2 - 1) ≈ 0.833 → balance 100 + 100 + 0.833
    expect(sold.balance).toBeCloseTo(200.833, 2);
    expect(game.clientPlayerView(address).hasPosition).toBe(false);
  });
});
