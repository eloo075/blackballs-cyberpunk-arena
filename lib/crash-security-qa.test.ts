/**
 * Adversarial money-safety suite for Real-mode readiness.
 * Complements crash-balance / crash-pnl with classic leverage + isolation checks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrashManager, getManager } from './crash-manager';
import { isLeveragedExitAllowed, leveragedOpenFee, minExitMultiplierRatio } from './crash-pnl';

vi.mock('server-only', () => ({}));

type Harness = {
  timer: ReturnType<typeof setInterval> | null;
  phase: 'waiting' | 'running' | 'crashed';
  mult: number;
  syncPlayer: CrashManager['syncPlayer'];
  trade: CrashManager['trade'];
  cashOut: CrashManager['cashOut'];
  cancelCountdownEntry: CrashManager['cancelCountdownEntry'];
  clientPlayerView: CrashManager['clientPlayerView'];
  crash: () => void;
  beginRound: () => void;
};

const managers: Harness[] = [];

function harness(mode: 'continuous' | 'classic' = 'continuous'): Harness {
  const instance = new CrashManager(mode) as unknown as Harness;
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

describe('Money safety — rug never credits', () => {
  it('open then rug: balance stays at post-debit liquid only', () => {
    const game = harness('continuous');
    const addr = 'demo-qa-rug';
    game.syncPlayer(addr, 500, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.4;
    expect(game.trade(addr, 'buy', 200, 1).ok).toBe(true);
    const mid = game.clientPlayerView(addr).balance;
    expect(mid).toBeCloseTo(300, 3);
    game.crash();
    const after = game.clientPlayerView(addr);
    expect(after.hasPosition).toBe(false);
    expect(after.balance).toBeCloseTo(300, 3);
    expect(after.balance).toBeLessThan(500);
  });
});

describe('Money safety — cancel refund exact', () => {
  it('presale cancel refunds margin (+ fee on classic leverage)', () => {
    const demo = harness('continuous');
    demo.syncPlayer('demo-qa-cancel', 100, undefined, { boot: true });
    demo.phase = 'waiting';
    expect(demo.trade('demo-qa-cancel', 'buy', 40, 1).ok).toBe(true);
    expect(demo.clientPlayerView('demo-qa-cancel').balance).toBeCloseTo(60, 3);
    expect(demo.cancelCountdownEntry('demo-qa-cancel').ok).toBe(true);
    expect(demo.clientPlayerView('demo-qa-cancel').balance).toBeCloseTo(100, 3);

    const classic = harness('classic');
    classic.syncPlayer('0xQaCancel000000000000000000000000000001', 200, undefined, { boot: true });
    classic.phase = 'waiting';
    const margin = 50;
    const lev = 5;
    const fee = leveragedOpenFee(margin, lev);
    expect(classic.trade('0xQaCancel000000000000000000000000000001', 'buy', margin, lev).ok).toBe(true);
    expect(classic.clientPlayerView('0xQaCancel000000000000000000000000000001').balance).toBeCloseTo(
      200 - margin - fee,
      3,
    );
    expect(classic.cancelCountdownEntry('0xQaCancel000000000000000000000000000001').ok).toBe(true);
    expect(classic.clientPlayerView('0xQaCancel000000000000000000000000000001').balance).toBeCloseTo(
      200,
      3,
    );
  });
});

describe('Money safety — stacked lots + partial sells', () => {
  it('partial sell credits precise lot PnL; rug loses remainder only', () => {
    const game = harness('continuous');
    const addr = 'demo-qa-partial';
    game.syncPlayer(addr, 1000, undefined, { boot: true });
    game.phase = 'running';
    game.mult = 1.0;
    expect(game.trade(addr, 'buy', 100, 1).ok).toBe(true);
    game.mult = 2.0;
    expect(game.trade(addr, 'buy', 100, 1).ok).toBe(true);
    // Close half of 200 = 100 (FIFO first lot @ 1.0 → exit 2.0 → +100 PnL)
    game.mult = 2.0;
    const partial = game.cashOut(addr, 0.5);
    expect(partial.ok).toBe(true);
    const afterPartial = game.clientPlayerView(addr);
    // liquid was 800; cashout returns 100 margin + 100 pnl = 200 → 1000
    expect(afterPartial.balance).toBeCloseTo(1000, 2);
    expect(afterPartial.hasPosition).toBe(true);
    expect(afterPartial.positionAmount).toBeCloseTo(100, 2);

    game.crash();
    const afterRug = game.clientPlayerView(addr);
    expect(afterRug.hasPosition).toBe(false);
    expect(afterRug.balance).toBeCloseTo(1000, 2);
  });
});

describe('Money safety — 5x anti-scalping', () => {
  it('blocks early exit below ~1.18x and allows at floor', () => {
    expect(minExitMultiplierRatio(5)).toBeCloseTo(1.18, 2);
    expect(isLeveragedExitAllowed('buy', 5, 1, 1.17)).toBe(false);
    expect(isLeveragedExitAllowed('buy', 5, 1, 1.18)).toBe(true);

    const game = harness('classic');
    const addr = '0xQaScalp0000000000000000000000000000001';
    game.syncPlayer(addr, 500, undefined, { boot: true });
    game.phase = 'waiting';
    expect(game.trade(addr, 'buy', 100, 5).ok).toBe(true);
    game.beginRound();
    expect(game.clientPlayerView(addr).hasPosition).toBe(true);

    game.mult = 1.1;
    const blocked = game.cashOut(addr, 1);
    expect(blocked.ok).toBe(false);
    expect(String(blocked.error)).toMatch(/anti-scalp/i);
    expect(game.clientPlayerView(addr).hasPosition).toBe(true);

    game.mult = 1.18;
    const allowed = game.cashOut(addr, 1);
    expect(allowed.ok).toBe(true);
    expect(game.clientPlayerView(addr).hasPosition).toBe(false);
  });
});

describe('Money safety — demo vs real isolation', () => {
  it('getManager routes demo and 0x wallets to separate engines', () => {
    const demo = getManager('demo-isolation-a');
    const real = getManager('0xIsolation000000000000000000000000000001');
    expect(demo).not.toBe(real);

    demo.syncPlayer('demo-isolation-a', 111, undefined, { boot: true });
    real.syncPlayer('0xIsolation000000000000000000000000000001', 999, undefined, {
      boot: true,
    });

    expect(demo.clientPlayerView('demo-isolation-a').balance).toBeCloseTo(111, 3);
    expect(real.clientPlayerView('0xIsolation000000000000000000000000000001').balance).toBeCloseTo(
      999,
      3,
    );
    // Cross-read must not leak balances between managers
    expect(demo.clientPlayerView('0xIsolation000000000000000000000000000001').balance).not.toBe(999);
  });
});
