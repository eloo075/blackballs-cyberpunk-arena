import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrashManager } from './crash-manager';
import { playerMarkerName } from './player-marker-name';

vi.mock('server-only', () => ({}));

type Harness = {
  timer: ReturnType<typeof setInterval> | null;
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  gameId: number;
  tradeTags: { user: string; side: string; amount: number; price: number }[];
  syncPlayer: CrashManager['syncPlayer'];
  trade: CrashManager['trade'];
  cashOut: CrashManager['cashOut'];
  beginRound: () => void;
  snapshot: CrashManager['snapshot'];
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

describe('chart markers (presale + full sell)', () => {
  it('does not push a chart buy tag during presale; adds it when round starts', () => {
    const game = manager();
    const address = 'demo-presale-marker';
    const name = playerMarkerName(address);
    game.syncPlayer(address, 5000, undefined, { boot: true });
    game.phase = 'waiting';

    expect(game.trade(address, 'buy', 1000, 1).ok).toBe(true);
    expect(game.tradeTags.filter(t => t.user === name && t.side === 'buy')).toHaveLength(0);

    game.beginRound();
    const mine = game.tradeTags.filter(t => t.user === name && t.side === 'buy');
    expect(mine).toHaveLength(1);
    expect(game.tradeTags).toHaveLength(1);
    expect(mine[0].price).toBeCloseTo(1.0, 3);
    expect(game.snapshot(address).phase).toBe('running');
  });

  it('removes player buy markers after a 100% sell', () => {
    const game = manager();
    const address = 'demo-full-sell-markers';
    const name = playerMarkerName(address);
    game.syncPlayer(address, 5000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 2.5;

    expect(game.trade(address, 'buy', 1000, 1).ok).toBe(true);
    expect(game.trade(address, 'buy', 500, 1).ok).toBe(true);
    expect(game.tradeTags.filter(t => t.user === name && t.side === 'buy').length).toBeGreaterThanOrEqual(2);

    game.mult = 3.0;
    expect(game.cashOut(address, 1).ok).toBe(true);
    expect(game.tradeTags.filter(t => t.user === name && t.side === 'buy')).toHaveLength(0);
  });
});
