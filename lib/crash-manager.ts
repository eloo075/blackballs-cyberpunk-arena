import { applyCrashPayout } from './hold-bonuses';
import { calcPositionPnl, isLiquidated, MAX_LEVERAGE, MIN_LEVERAGE } from './crash-pnl';
import {
  computeCrashPoint,
  DEFAULT_CLIENT_SEED,
  generateRoundPath,
  generateSeedHistory,
  generateServerSeed,
  hashServerSeed,
} from './crash-engine';
import type { Candle, FeedEvent, FullState, Phase, RoundSummary, TradeTag } from './crash-types';
import { dispatchSettlement, type SettlementAction } from './chain/crash-vault-client';
import { broadcastCrashEvent } from './supabase/broadcast-crash-event';
import type { CrashSpectatorEventType } from './crash-spectator-types';

interface BotPlayer {
  name: string;
  status: 'in' | 'out';
  side: 'buy' | 'sell';
  entryPrice: number;
  amount: number;
  leverage: number;
}

interface RoundState {
  id: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  crashPoint: number;
  instantRug: boolean;
  crashAtSeconds: number;
  revealed: boolean;
  path: { price: number; t: number }[];
}

interface PlayerState {
  balance: number;
  hasPosition: boolean;
  positionSide: 'buy' | 'sell';
  positionAmount: number;
  positionLeverage: number;
  positionEntryPrice: number;
  autoSell: number | null;
  lastResult: { won: boolean; amount: number; price: number; bonusAmount?: number; frenzyProc?: boolean } | null;
  stimmy: number;
  frenzy: number;
}

const TICK_MS = 250;
const ROUND_WAIT_SECONDS = 10;
const CRASH_HOLD_SECONDS = 5;
const MAX_CANDLES = 60;
const MAX_HISTORY = 100;
const MAX_FEED = 40;
const MAX_TAGS = 20;

function emptyPlayerState(balance = 0): PlayerState {
  return {
    balance,
    hasPosition: false,
    positionSide: 'buy',
    positionAmount: 0,
    positionLeverage: 1,
    positionEntryPrice: 1.0,
    autoSell: null,
    lastResult: null,
    stimmy: 0,
    frenzy: 0,
  };
}

function randName(): string {
  const pre = ['7BxK', '9Lam', '3Fde', 'H8nK', '2QaZ', '5VkL', 'J4pX', '6RtY', 'K9mN', '1ZxV', '8GfD', '4HbV', 'T5nM', '7YgF'];
  const suf = ['3mPq', '8vRt', '2xWq', '9pLm', '7nDf', '1mNb', '8cVg', '3qWe', '5bXc', '4pLk', '7mJk', '2qWx', '9cXd', '3pLz'];
  return `${pre[Math.floor(Math.random() * pre.length)]}...${suf[Math.floor(Math.random() * suf.length)]}`;
}

function holdBonusesFor(player: PlayerState) {
  return {
    stimmy: player.stimmy,
    frenzy: player.frenzy,
    active: [],
    damageMultiplier: 1 + player.stimmy,
    payoutMultiplier: 1 + player.stimmy,
    critChanceBonus: player.frenzy,
  };
}

class CrashManager {
  private phase: Phase = 'waiting';
  private gameId = 1;
  private round!: RoundState;
  private mult = 1.0;
  private peakMult = 1.0;
  private elapsed = 0;
  private candles: Candle[] = [];
  private waitLeft = ROUND_WAIT_SECONDS;
  private history: RoundSummary[] = [];
  private feed: FeedEvent[] = [];
  private tradeTags: TradeTag[] = [];
  private bots: BotPlayer[] = [];
  private tickIdx = 0;
  private candleOpen = 1.0;
  private candleHigh = 1.0;
  private candleLow = 1.0;
  private candleStartTime = 0;
  private feedId = 0;
  private tagId = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private players = new Map<string, PlayerState>();
  private pressureOffset = 0;
  private orderPressure = 0;
  private roundBuyVolume = 0;
  private roundSellVolume = 0;

  constructor() {
    this.history = generateSeedHistory(MAX_HISTORY);
    this.gameId = MAX_HISTORY + 1;
    this.round = this.newRound();
    this.resetBots();
    this.start();
  }

  private newRound(): RoundState {
    const seed = generateServerSeed();
    const clientSeed = DEFAULT_CLIENT_SEED;
    const nonce = this.gameId;
    const crashPoint = computeCrashPoint(seed, clientSeed, nonce);
    const path = generateRoundPath(seed, nonce, crashPoint, TICK_MS);
    return {
      id: this.gameId,
      serverSeed: seed,
      serverSeedHash: hashServerSeed(seed),
      clientSeed,
      nonce,
      crashPoint,
      instantRug: crashPoint <= 1.0,
      crashAtSeconds: 0,
      revealed: false,
      path,
    };
  }

  private resetBots() {
    const n = 8 + Math.floor(Math.random() * 10);
    this.bots = Array.from({ length: n }, () => ({
      name: randName(),
      status: 'out' as const,
      side: 'buy' as const,
      entryPrice: 1.0,
      amount: parseFloat((Math.random() * 3 + 0.05).toFixed(2)),
      leverage: 1 + Math.floor(Math.random() * 3),
    }));
  }

  private countBuyersIn(): number {
    const botsIn = this.bots.filter(b => b.status === 'in').length;
    const humansIn = Array.from(this.players.values()).filter(p => p.hasPosition).length;
    return botsIn + humansIn;
  }

  private applyOrderFlow(side: 'buy' | 'sell', notional: number) {
    const impact = Math.min(0.06, Math.max(0.002, notional * 0.0035));
    if (side === 'buy') {
      this.pressureOffset += impact;
      this.orderPressure = Math.min(0.15, this.orderPressure + impact);
      this.roundBuyVolume += notional;
    } else {
      this.pressureOffset -= impact * 0.9;
      this.orderPressure = Math.max(-0.15, this.orderPressure - impact * 0.9);
      this.roundSellVolume += notional;
    }
    if (this.phase === 'running') {
      this.candleHigh = Math.max(this.candleHigh, this.mult);
      this.candleLow = Math.min(this.candleLow, this.mult);
    }
  }

  private getPlayer(address: string): PlayerState {
    let player = this.players.get(address);
    if (!player) {
      player = emptyPlayerState();
      this.players.set(address, player);
    }
    return player;
  }

  private entryPriceForNewPosition(): number {
    return this.phase === 'running' ? this.mult : 1.0;
  }

  syncPlayer(address: string, balance: number, bonuses?: { stimmy?: number; frenzy?: number }): number {
    const player = this.getPlayer(address);
    if (!player.hasPosition) {
      player.balance = parseFloat(balance.toFixed(3));
    }
    if (bonuses) {
      player.stimmy = Math.max(0, bonuses.stimmy ?? player.stimmy);
      player.frenzy = Math.max(0, bonuses.frenzy ?? player.frenzy);
    }
    this.emit();
    return player.balance;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  subscribe(address: string | null, fn: (s: FullState) => void): () => void {
    const listener = () => fn(this.snapshot(address));
    this.listeners.add(listener);
    fn(this.snapshot(address));
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach(l => l());
  }

  private playerSnapshot(address: string | null): Pick<
    FullState,
    | 'hasPosition'
    | 'positionSide'
    | 'positionAmount'
    | 'positionLeverage'
    | 'positionEntryPrice'
    | 'balance'
    | 'lastResult'
    | 'autoSell'
  > {
    if (!address) {
      return {
        hasPosition: false,
        positionSide: 'buy',
        positionAmount: 0,
        positionLeverage: 1,
        positionEntryPrice: 1.0,
        balance: 0,
        lastResult: null,
        autoSell: null,
      };
    }
    const player = this.getPlayer(address);
    return {
      hasPosition: player.hasPosition,
      positionSide: player.positionSide,
      positionAmount: player.positionAmount,
      positionLeverage: player.positionLeverage,
      positionEntryPrice: player.positionEntryPrice,
      balance: player.balance,
      lastResult: player.lastResult,
      autoSell: player.autoSell,
    };
  }

  snapshot(address: string | null = null): FullState {
    return {
      phase: this.phase,
      gameId: this.round.id,
      mult: this.mult,
      peakMult: this.peakMult,
      elapsed: this.elapsed,
      candles: [...this.candles],
      waitLeft: this.waitLeft,
      history: [...this.history],
      feed: [...this.feed],
      tradeTags: [...this.tradeTags],
      currentRound: {
        id: this.round.id,
        serverSeedHash: this.round.serverSeedHash,
        serverSeed: this.round.revealed ? this.round.serverSeed : null,
        clientSeed: this.round.clientSeed,
        nonce: this.round.nonce,
        crashPoint: this.round.revealed ? this.round.crashPoint : null,
      },
      players: this.countBuyersIn(),
      buyersIn: this.countBuyersIn(),
      roundBuyVolume: this.roundBuyVolume,
      roundSellVolume: this.roundSellVolume,
      orderPressure: this.orderPressure,
      ...this.playerSnapshot(address),
    };
  }

  private tick() {
    if (this.phase === 'waiting') {
      this.waitLeft -= TICK_MS / 1000;
      if (this.waitLeft <= 0) this.beginRound();
      this.emit();
      return;
    }

    if (this.phase === 'running') {
      this.elapsed += TICK_MS / 1000;
      this.tickIdx++;

      const pathTick = this.round.path.length
        ? this.round.path[Math.min(this.tickIdx, this.round.path.length - 1)]
        : { price: 0.01, t: this.elapsed };
      const baseMult = pathTick.price;
      this.pressureOffset *= 0.9;
      this.orderPressure *= 0.96;
      const maxWiggle = Math.max(0.02, baseMult * 0.04);
      this.pressureOffset = Math.max(-maxWiggle, Math.min(maxWiggle, this.pressureOffset));
      const flowMult = baseMult + this.pressureOffset;
      const ceiling = Math.max(1.01, this.round.crashPoint - 0.01);
      this.mult = Math.max(1.0, Math.min(ceiling, flowMult));
      this.peakMult = Math.max(this.peakMult, this.mult);

      this.candleHigh = Math.max(this.candleHigh, this.mult);
      this.candleLow = Math.min(this.candleLow, this.mult);
      this.updateLiveCandle();

      if (this.tickIdx % 4 === 0) {
        this.commitCandle();
      }

      this.simulateBots();
      this.checkAutoSellForAllPlayers();
      this.checkLiquidationsForAllPlayers();

      if (this.tickIdx >= this.round.path.length - 1) {
        this.crash();
        return;
      }

      this.emit();
      return;
    }

    if (this.phase === 'crashed') {
      this.waitLeft -= TICK_MS / 1000;
      if (this.waitLeft <= 0) {
        this.phase = 'waiting';
        this.waitLeft = ROUND_WAIT_SECONDS;
        this.gameId++;
        this.round = this.newRound();
        this.resetBots();
        this.emit();
      }
    }
  }

  private checkLiquidationsForAllPlayers() {
    for (const [address, player] of this.players.entries()) {
      if (!player.hasPosition || player.positionLeverage <= 1) continue;
      if (
        isLiquidated(
          player.positionSide,
          player.positionEntryPrice,
          player.positionLeverage,
          this.mult,
        )
      ) {
        this.liquidatePosition(address);
      }
    }
  }

  private liquidatePosition(address: string) {
    const player = this.getPlayer(address);
    if (!player.hasPosition) return;
    const margin = player.positionAmount;
    const leverage = player.positionLeverage;
    const side = player.positionSide;
    player.lastResult = {
      won: false,
      amount: -margin,
      price: this.mult,
    };
    this.pushFeed('YOU', 'rug', margin, this.mult, -margin, { leverage, side });
    player.hasPosition = false;
    player.positionAmount = 0;
    player.positionLeverage = 1;
    dispatchSettlement({
      type: 'loss',
      player: address,
      amount: margin,
      reason: 'LIQUIDATED',
    });
    this.emit();
  }

  private checkAutoSellForAllPlayers() {
    for (const [address, player] of this.players.entries()) {
      if (!player.autoSell || !player.hasPosition) continue;
      const target =
        player.positionSide === 'buy'
          ? player.positionEntryPrice * player.autoSell
          : player.positionEntryPrice * (2 - player.autoSell);
      if (
        (player.positionSide === 'buy' && this.mult >= target) ||
        (player.positionSide === 'sell' && this.mult <= target)
      ) {
        this.closePosition(address);
      }
    }
  }

  private updateLiveCandle() {
    if (this.candles.length === 0) {
      this.candles.push({
        o: this.candleOpen,
        h: this.candleHigh,
        l: this.candleLow,
        c: this.mult,
        t: this.candleStartTime,
      });
    } else {
      const live = this.candles[this.candles.length - 1];
      live.h = this.candleHigh;
      live.l = this.candleLow;
      live.c = this.mult;
    }
  }

  private commitCandle() {
    const last = this.candles[this.candles.length - 1];
    if (last) {
      last.c = this.mult;
      last.h = Math.max(last.h, this.mult);
      last.l = Math.min(last.l, this.mult);
    }
    this.candleOpen = this.mult;
    this.candleHigh = this.mult;
    this.candleLow = this.mult;
    this.candleStartTime = this.elapsed;
    this.candles.push({
      o: this.candleOpen,
      h: this.candleHigh,
      l: this.candleLow,
      c: this.mult,
      t: this.candleStartTime,
    });
    if (this.candles.length > MAX_CANDLES) this.candles.shift();
  }

  private beginRound() {
    this.phase = 'running';
    this.elapsed = 0;
    this.mult = 1.0;
    this.peakMult = 1.0;
    this.tickIdx = 0;
    this.candles = [];
    this.candleOpen = 1.0;
    this.candleHigh = 1.0;
    this.candleLow = 1.0;
    this.candleStartTime = 0;
    this.candles.push({ o: 1.0, h: 1.0, l: 1.0, c: 1.0, t: 0 });
    this.pressureOffset = 0;
    this.orderPressure = 0;
    this.roundBuyVolume = 0;
    this.roundSellVolume = 0;
    this.bots.forEach(b => {
      b.status = 'out';
      b.entryPrice = 1.0;
    });
    this.emit();
  }

  private crash() {
    this.phase = 'crashed';
    const live = this.candles[this.candles.length - 1];
    if (live) {
      live.h = Math.max(live.h, this.mult);
      live.c = 0.01;
      live.l = 0.01;
    }
    const exitMult = 0.01;
    this.mult = exitMult;

    this.bots.forEach(b => {
      if (b.status === 'in') {
        b.status = 'out';
        const pnl =
          b.side === 'buy'
            ? -b.amount
            : calcPositionPnl('sell', b.amount, b.leverage, b.entryPrice, exitMult);
        this.pushFeed(b.name, 'rug', b.amount, exitMult, pnl, {
          leverage: b.leverage,
          side: b.side,
        });
      }
    });

    for (const [address, player] of this.players.entries()) {
      if (!player.hasPosition) continue;
      const margin = player.positionAmount;
      const pnl = calcPositionPnl(
        player.positionSide,
        player.positionAmount,
        player.positionLeverage,
        player.positionEntryPrice,
        exitMult,
      );
      if (pnl > 0) {
        const baseReturn = margin + pnl;
        const { total } = applyCrashPayout(baseReturn, holdBonusesFor(player));
        player.balance += total;
        dispatchSettlement({
          type: 'payout',
          player: address,
          amount: total,
        });
      } else {
        dispatchSettlement({
          type: 'loss',
          player: address,
          amount: margin,
          reason: 'RUG',
        });
      }
      player.lastResult = {
        won: pnl > 0,
        amount: pnl,
        price: exitMult,
      };
      player.hasPosition = false;
      player.positionAmount = 0;
      player.positionLeverage = 1;
    }

    this.round.revealed = true;
    this.history.unshift({
      id: this.round.id,
      crashPoint: this.peakMult,
      serverSeedHash: this.round.serverSeedHash,
      serverSeed: this.round.serverSeed,
      clientSeed: this.round.clientSeed,
      nonce: this.round.nonce,
      instantRug: this.round.instantRug,
      ts: Date.now(),
    });
    if (this.history.length > MAX_HISTORY) this.history.pop();
    this.waitLeft = CRASH_HOLD_SECONDS;
    this.emit();
  }

  private botPnl(b: BotPlayer): number {
    return calcPositionPnl(b.side, b.amount, b.leverage, b.entryPrice, this.mult);
  }

  private simulateBots() {
    this.bots.forEach(b => {
      if (b.status === 'out') {
        if (Math.random() < 0.08) {
          b.status = 'in';
          b.side = Math.random() < 0.55 ? 'buy' : 'sell';
          b.entryPrice = this.mult;
          b.leverage = 1 + Math.floor(Math.random() * 4);
          const notional = b.amount * b.leverage;
          this.applyOrderFlow(b.side, notional);
          this.pushFeed(b.name, b.side, b.amount, this.mult, -b.amount, {
            leverage: b.leverage,
            side: b.side,
          });
          this.pushTag(b.name, b.side, b.amount, this.mult);
        }
      } else {
        const pnlPct = this.botPnl(b) / b.amount;
        const takeProfit = pnlPct > 0.08 + Math.random() * 0.35;
        const stopLoss = pnlPct < -0.12;
        const shortTp = b.side === 'sell' && this.mult <= b.entryPrice * (0.85 + Math.random() * 0.1);
        const longTp = b.side === 'buy' && this.mult >= b.entryPrice * (1.1 + Math.random() * 0.3);
        if (takeProfit || stopLoss || shortTp || longTp) {
          b.status = 'out';
          const pnl = this.botPnl(b);
          const closeSide = b.side === 'buy' ? 'sell' : 'buy';
          this.applyOrderFlow(closeSide, b.amount * b.leverage);
          this.pushFeed(b.name, closeSide, b.amount, this.mult, pnl, {
            leverage: b.leverage,
            side: b.side,
          });
          this.pushTag(b.name, closeSide, b.amount, this.mult);
        }
      }
    });
  }

  private pushFeed(
    user: string,
    kind: FeedEvent['kind'],
    amount: number,
    price: number,
    delta: number,
    meta?: { leverage?: number; side?: 'buy' | 'sell' },
  ) {
    const id = this.feedId++;
    this.feed.unshift({ id, user, kind, amount, price, delta, t: Date.now() });
    if (this.feed.length > MAX_FEED) this.feed.pop();
    this.emitSpectator(user, kind, amount, price, delta, id, meta);
  }

  private emitSpectator(
    user: string,
    kind: FeedEvent['kind'],
    amount: number,
    price: number,
    delta: number,
    eventId: number,
    meta?: { leverage?: number; side?: 'buy' | 'sell' },
  ) {
    const isOpen = delta < 0 && (kind === 'buy' || kind === 'sell');
    const isLiquidation = kind === 'rug' && price <= 1.01 && delta <= -amount * 0.95;
    let type: CrashSpectatorEventType = 'rug';
    if (isLiquidation) type = 'liquidation';
    else if (kind === 'rug') type = 'rug';
    else if (isOpen) type = 'player_joined';
    else type = 'cash_out';

    broadcastCrashEvent({
      id: `srv-${eventId}-${Date.now()}`,
      type,
      player: user,
      amount,
      multiplier: price,
      leverage: meta?.leverage,
      side: meta?.side ?? (kind === 'buy' || kind === 'sell' ? kind : undefined),
      pnl: delta,
      payout: delta > 0 ? delta : undefined,
      ts: Date.now(),
    });
  }

  private pushTag(user: string, side: 'buy' | 'sell', amount: number, price: number) {
    this.tradeTags.push({ id: this.tagId++, user, side, amount, price, t: Date.now() });
    if (this.tradeTags.length > MAX_TAGS) this.tradeTags.shift();
  }

  private openPosition(
    address: string,
    side: 'buy' | 'sell',
    amount: number,
    leverage: number,
  ): {
    ok: boolean;
    error?: string;
    balance?: number;
    action?: 'open';
  } {
    const player = this.getPlayer(address);
    if (this.phase === 'crashed') return { ok: false, error: 'round ended' };
    if (player.hasPosition) return { ok: false, error: 'already in position' };
    if (amount <= 0 || amount > player.balance) return { ok: false, error: 'invalid amount' };

    const entryPrice = this.entryPriceForNewPosition();
    player.hasPosition = true;
    player.positionSide = side;
    player.positionAmount = amount;
    player.positionLeverage = leverage;
    player.positionEntryPrice = entryPrice;
    player.balance -= amount;

    const notional = amount * leverage;
    this.applyOrderFlow(side, notional);
    this.pushFeed('YOU', side, amount, entryPrice, -amount, { leverage, side });
    this.pushTag('YOU', side, amount, entryPrice);
    this.emit();
    return { ok: true, balance: player.balance, action: 'open' };
  }

  private closePosition(
    address: string,
  ): {
    ok: boolean;
    error?: string;
    balance?: number;
    frenzyProc?: boolean;
    settlement?: SettlementAction;
    action?: 'close';
  } {
    const player = this.getPlayer(address);
    if (!player.hasPosition) return { ok: false, error: 'no position' };

    if (this.phase === 'waiting') {
      const margin = player.positionAmount;
      const closeSide = player.positionSide === 'buy' ? 'sell' : 'buy';
      const leverage = player.positionLeverage;
      const side = player.positionSide;
      player.balance += margin;
      this.pushFeed('YOU', closeSide, margin, 1.0, 0, { leverage, side });
      player.hasPosition = false;
      player.positionAmount = 0;
      player.positionLeverage = 1;
      this.emit();
      return { ok: true, balance: player.balance, action: 'close' };
    }

    if (this.phase !== 'running') return { ok: false, error: 'not running' };

    const margin = player.positionAmount;
    const leverage = player.positionLeverage;
    const side = player.positionSide;
    const entry = player.positionEntryPrice;
    const exit = this.mult;
    const pnl = calcPositionPnl(player.positionSide, margin, leverage, entry, exit);
    let returnAmount = margin + pnl;
    let frenzyProc = false;
    let bonusAmount: number | undefined;

    if (pnl > 0) {
      const { total, frenzyProc: fp } = applyCrashPayout(returnAmount, holdBonusesFor(player));
      bonusAmount = parseFloat((total - returnAmount).toFixed(3));
      returnAmount = total;
      frenzyProc = fp;
    }

    player.balance += returnAmount;
    const closeSide = player.positionSide === 'buy' ? 'sell' : 'buy';
    this.applyOrderFlow(closeSide, margin * leverage);
    player.lastResult = {
      won: pnl > 0,
      amount: pnl,
      price: exit,
      bonusAmount: bonusAmount && bonusAmount > 0 ? bonusAmount : undefined,
      frenzyProc: frenzyProc || undefined,
    };
    this.pushFeed('YOU', closeSide, margin, exit, pnl, { leverage, side });
    this.pushTag('YOU', closeSide, margin, exit);
    player.hasPosition = false;
    player.positionAmount = 0;
    player.positionLeverage = 1;
    this.emit();

    const settlement: SettlementAction = {
      type: 'payout',
      player: address,
      amount: returnAmount,
    };

    return { ok: true, balance: player.balance, frenzyProc, settlement, action: 'close' };
  }

  trade(
    address: string,
    side: 'buy' | 'sell',
    amount: number,
    leverage: number,
  ): {
    ok: boolean;
    error?: string;
    balance?: number;
    frenzyProc?: boolean;
    settlement?: SettlementAction;
    action?: 'open' | 'close';
  } {
    const lev = Math.round(leverage);
    if (lev < MIN_LEVERAGE || lev > MAX_LEVERAGE) {
      return { ok: false, error: 'invalid leverage' };
    }

    const player = this.getPlayer(address);
    if (player.hasPosition) {
      if (player.positionSide === side) {
        return { ok: false, error: 'use opposite side to close' };
      }
      return this.closePosition(address);
    }

    return this.openPosition(address, side, amount, lev);
  }

  buy(address: string, amount: number, leverage = 1) {
    return this.trade(address, 'buy', amount, leverage);
  }

  sell(address: string, amount: number, leverage = 1) {
    return this.trade(address, 'sell', amount, leverage);
  }

  setAutoSell(address: string, v: number | null) {
    const player = this.getPlayer(address);
    player.autoSell = v;
    this.emit();
  }

  getFullState(address: string | null = null): FullState {
    return this.snapshot(address);
  }
}

let manager: CrashManager | null = null;
export function getManager(): CrashManager {
  if (!manager) manager = new CrashManager();
  return manager;
}
