import {
  calcCrashSettlement,
  calcPositionPnl,
  clampRate,
  isLiquidated,
  leveragedOpenFee,
  MAX_DEMO_BALANCE,
  MAX_FRENZY_RATE,
  MAX_LEVERAGE,
  MAX_STIMMY_RATE,
  MIN_LEVERAGE,
  roundMoney,
} from './crash-pnl';
import { splitPartialCashout } from './crash-position-math';
import {
  CONTINUOUS_MAX_ROUND_TICKS,
  CONTINUOUS_MIN_ROUND_TICKS,
  CONTINUOUS_PATH_EXTENSION_TICKS,
  CONTINUOUS_PRICE_CEIL,
  CONTINUOUS_PRICE_FLOOR,
  computeCrashPoint,
  DEFAULT_CLIENT_SEED,
  deriveServerSeedForGameId,
  generateContinuousRoundPath,
  generateRoundPath,
  generateSeedHistory,
  hashServerSeed,
} from './crash-engine';
import type { Candle, FeedEvent, FullState, Phase, RoundSummary, TradeTag } from './crash-types';
import { dispatchSettlement, type SettlementAction } from './chain/crash-vault-client';
import { broadcastCrashEvent } from './supabase/broadcast-crash-event';
import type { CrashSpectatorEventType } from './crash-spectator-types';
import { DEMO_MIN_BALANCE } from './demo-credits';
import { mirrorCrashBalanceToFlip } from './mirror-session-balance';

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
  mode: 'classic' | 'continuous';
  rugTick: number | null;
}

interface PlayerState {
  balance: number;
  hasPosition: boolean;
  positionSide: 'buy' | 'sell';
  positionAmount: number;
  positionLeverage: number;
  positionEntryPrice: number;
  positionRoundId: number | null;
  /** Countdown-phase bet — cleared when round starts or ends. */
  pendingEntry: {
    side: 'buy' | 'sell';
    amount: number;
    leverage: number;
    roundId: number;
  } | null;
  autoSell: number | null;
  lastResult: { won: boolean; amount: number; price: number; bonusAmount?: number; frenzyProc?: boolean } | null;
  stimmy: number;
  frenzy: number;
}

const TICK_MS = 250;
/** Continuous (rugs.fun-style) candles close every 4 seconds. */
const CONTINUOUS_CANDLE_TICKS = 16;
const CLASSIC_CANDLE_TICKS = 3;
const ROUND_WAIT_SECONDS = 12;
const CRASH_HOLD_SECONDS = 4;
const MAX_CANDLES = 60;
const MAX_HISTORY = 1000;
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
    positionRoundId: null,
    pendingEntry: null,
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

function playerMarkerName(address: string): string {
  if (!address) return 'PLAYER';
  if (address.startsWith('0x') && address.length > 10) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }
  const clean = address.replace(/^demo[-_:]?/i, '');
  return clean.length > 12 ? `${clean.slice(0, 10)}…` : clean || 'PLAYER';
}

export class CrashManager {
  readonly mode: 'classic' | 'continuous';
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
  private listeners = new Set<(base?: FullState) => void>();
  private players = new Map<string, PlayerState>();
  private pressureOffset = 0;
  private orderPressure = 0;
  private roundBuyVolume = 0;
  private roundSellVolume = 0;
  /** Seed-fair base rug tick before live liquidity shifts it. */
  private baseRugTick: number | null = null;
  /** Last round id that finished crash settlement — used to clear ghost positions. */
  private lastSettledRoundId = 0;

  constructor(mode: 'classic' | 'continuous' = 'continuous') {
    this.mode = mode;
    this.history = generateSeedHistory(MAX_HISTORY);
    this.gameId = MAX_HISTORY + 1;
    this.round = this.newRound();
    this.resetBots();
    this.start();
  }

  private newRound(): RoundState {
    const seed = deriveServerSeedForGameId(this.gameId);
    const clientSeed = DEFAULT_CLIENT_SEED;
    const nonce = this.gameId;
    const classicCrashPoint = computeCrashPoint(seed, clientSeed, nonce);
    const continuous =
      this.mode === 'continuous' ? generateContinuousRoundPath(seed, nonce, TICK_MS) : null;
    const crashPoint = continuous?.peakMultiplier ?? classicCrashPoint;
    const path =
      continuous?.path ?? generateRoundPath(seed, nonce, classicCrashPoint, TICK_MS);
    return {
      id: this.gameId,
      serverSeed: seed,
      serverSeedHash: hashServerSeed(seed),
      clientSeed,
      nonce,
      crashPoint,
      instantRug: this.mode === 'classic' && crashPoint <= 1.0,
      crashAtSeconds: path[path.length - 1]?.t ?? 0,
      revealed: false,
      path,
      mode: this.mode,
      rugTick: continuous?.rugTick ?? null,
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
    const humansIn = Array.from(this.players.values()).filter(
      p =>
        p.hasPosition ||
        (p.pendingEntry != null && p.pendingEntry.roundId === this.round.id),
    ).length;
    return botsIn + humansIn;
  }

  private applyOrderFlow(side: 'buy' | 'sell', notional: number) {
    const impact = Math.min(0.08, Math.max(0.002, notional * 0.004));
    if (side === 'buy') {
      this.pressureOffset += impact;
      this.orderPressure = Math.min(0.18, this.orderPressure + impact);
      this.roundBuyVolume += notional;
    } else {
      this.pressureOffset -= impact * 0.9;
      this.orderPressure = Math.max(-0.18, this.orderPressure - impact * 0.9);
      this.roundSellVolume += notional;
    }
    if (this.phase === 'running') {
      this.candleHigh = Math.max(this.candleHigh, this.mult);
      this.candleLow = Math.min(this.candleLow, this.mult);
    }
  }

  /**
   * More presale/live buy liquidity delays the rug briefly. Heavy selling
   * pulls it forward. Delay is hard-capped so rounds never crawl for minutes.
   */
  private liquidityAdjustedRugTick(): number {
    const base = this.baseRugTick ?? this.round.rugTick ?? CONTINUOUS_MAX_ROUND_TICKS;
    const delay = Math.min(60, Math.floor(this.roundBuyVolume * 2));
    const accel = Math.floor(this.roundSellVolume * 2.5);
    const maxTick =
      CONTINUOUS_MAX_ROUND_TICKS + CONTINUOUS_PATH_EXTENSION_TICKS - 1;
    return Math.max(
      CONTINUOUS_MIN_ROUND_TICKS,
      Math.min(maxTick, base + delay - accel),
    );
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
    return 1.0;
  }

  private clearPlayerPosition(player: PlayerState) {
    player.hasPosition = false;
    player.positionAmount = 0;
    player.positionLeverage = 1;
    player.positionEntryPrice = 1.0;
    player.positionRoundId = null;
  }

  private clearPendingEntry(player: PlayerState, refund: boolean) {
    if (!player.pendingEntry) return;
    if (refund && player.pendingEntry.amount > 0) {
      player.balance = parseFloat((player.balance + player.pendingEntry.amount).toFixed(3));
    }
    player.pendingEntry = null;
  }

  /** Wipe all betting flags — used on crash, new countdown, demo boot. */
  private clearAllBettingState(player: PlayerState, refundPending: boolean) {
    if (player.hasPosition) {
      this.clearPlayerPosition(player);
    }
    this.clearPendingEntry(player, refundPending);
  }

  private forceClearAllPlayers(refundPending: boolean, reason: string) {
    for (const [address, player] of this.players.entries()) {
      if (player.hasPosition || player.pendingEntry) {
        console.warn('[crash] forceClearAllPlayers', {
          reason,
          address: address.slice(0, 12),
          hadPosition: player.hasPosition,
          positionRoundId: player.positionRoundId,
          pendingRoundId: player.pendingEntry?.roundId,
          currentRoundId: this.round.id,
          phase: this.phase,
        });
        this.clearAllBettingState(player, refundPending);
      }
    }
  }

  /** Refund locked margin when clearing a position that never settled. */
  private releaseStalePosition(player: PlayerState, refundMargin: boolean) {
    if (!player.hasPosition) return;
    if (refundMargin && player.positionAmount > 0) {
      player.balance = parseFloat((player.balance + player.positionAmount).toFixed(3));
    }
    this.clearPlayerPosition(player);
  }

  getPositionDebug(address: string) {
    const player = this.getPlayer(address);
    const pending =
      player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;
    const showPending = pending != null && this.phase === 'waiting';
    return {
      phase: this.phase,
      currentRoundId: this.round.id,
      lastSettledRoundId: this.lastSettledRoundId,
      hasPosition: player.hasPosition,
      effectiveHasPosition: player.hasPosition || showPending,
      hasLivePosition: player.hasPosition,
      entryPending: showPending,
      positionRoundId: player.positionRoundId,
      positionSide: player.hasPosition ? player.positionSide : pending?.side ?? player.positionSide,
      pendingEntry: player.pendingEntry,
    };
  }

  /**
   * Drop ghost entries before enter. Returns debug reason if something was cleared.
   */
  preparePlayerForEnter(address: string): string | null {
    const player = this.getPlayer(address);
    let cleared: string | null = null;

    // Orphan countdown bet while round is live — promote, never silently discard margin.
    if (this.phase === 'running') {
      if (this.ensureLivePosition(player)) {
        cleared = 'promoted pending entry to live position';
      } else if (player.pendingEntry) {
        const pr = player.pendingEntry.roundId;
        if (pr !== this.round.id || pr <= this.lastSettledRoundId) {
          this.clearPendingEntry(player, true);
          cleared = `cleared stale pending during running (pendingRound=${pr})`;
        }
      }
    }

    if (this.phase === 'crashed' && player.pendingEntry) {
      this.clearPendingEntry(player, true);
      cleared = 'cleared pending (crashed phase)';
    }

    if (this.phase === 'waiting' && player.pendingEntry) {
      const pr = player.pendingEntry.roundId;
      if (pr !== this.round.id || pr <= this.lastSettledRoundId) {
        this.clearPendingEntry(player, true);
        cleared = `cleared stale pending (pendingRound=${pr}, current=${this.round.id}, settled=${this.lastSettledRoundId})`;
      }
    }

    if (player.hasPosition) {
      const rid = player.positionRoundId;
      if (this.phase === 'crashed' || rid == null || rid !== this.round.id || rid <= this.lastSettledRoundId) {
        this.releaseStalePosition(player, rid != null && rid > this.lastSettledRoundId);
        cleared = `cleared stale position (posRound=${rid}, current=${this.round.id}, settled=${this.lastSettledRoundId})`;
      }
    }

    if (cleared) this.emit();
    return cleared;
  }

  /** Player-facing fields for API error recovery / client sync. */
  clientPlayerView(address: string | null) {
    const snap = this.snapshot(address);
    return {
      phase: snap.phase,
      gameId: snap.gameId,
      waitLeft: snap.waitLeft,
      hasPosition: snap.hasPosition,
      hasLivePosition: snap.hasLivePosition,
      entryPending: snap.entryPending,
      positionSide: snap.positionSide,
      positionAmount: snap.positionAmount,
      positionLeverage: snap.positionLeverage,
      positionEntryPrice: snap.positionEntryPrice,
      balance: snap.balance,
    };
  }

  /** Force-align liquid balance from the other game (ignores pending/position guards). */
  applyPeerBalance(address: string, balance: number): number {
    const player = this.getPlayer(address);
    if (!Number.isFinite(balance)) return player.balance;
    const max = address.startsWith('0x') ? Number.MAX_SAFE_INTEGER : MAX_DEMO_BALANCE;
    player.balance = roundMoney(Math.min(max, Math.max(0, balance)));
    this.emit();
    return player.balance;
  }

  /** @deprecated use preparePlayerForEnter */
  reconcilePlayerPosition(address: string): void {
    this.preparePlayerForEnter(address);
  }

  syncPlayer(
    address: string,
    balance: number,
    bonuses?: { stimmy?: number; frenzy?: number },
    options?: { boot?: boolean },
  ): number {
    const player = this.getPlayer(address);
    const isDemo = !address.startsWith('0x');
    const maxBalance = isDemo ? MAX_DEMO_BALANCE : Number.MAX_SAFE_INTEGER;
    const clientBalance = Number.isFinite(balance)
      ? roundMoney(Math.min(maxBalance, Math.max(0, balance)))
      : player.balance;

    if (options?.boot) {
      const inCurrentRound =
        (player.hasPosition && player.positionRoundId === this.round.id) ||
        (player.pendingEntry?.roundId === this.round.id);
      if (!inCurrentRound) {
        this.clearAllBettingState(player, true);
      }
      if (!player.hasPosition && !player.pendingEntry) {
        player.balance = clientBalance;
      } else if (isDemo && clientBalance >= DEMO_MIN_BALANCE && player.balance < DEMO_MIN_BALANCE) {
        player.balance = clientBalance;
      }
    } else if (!player.hasPosition && !player.pendingEntry) {
      if (clientBalance <= player.balance + 0.001) {
        player.balance = clientBalance;
      } else if (isDemo && clientBalance >= DEMO_MIN_BALANCE && player.balance < DEMO_MIN_BALANCE) {
        player.balance = clientBalance;
      }
    } else if (isDemo && clientBalance >= DEMO_MIN_BALANCE && player.balance < DEMO_MIN_BALANCE) {
      player.balance = clientBalance;
    }

    if (bonuses) {
      player.stimmy = clampRate(bonuses.stimmy ?? player.stimmy, MAX_STIMMY_RATE);
      player.frenzy = clampRate(bonuses.frenzy ?? player.frenzy, MAX_FRENZY_RATE);
    }
    this.emit();
    return player.balance;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  subscribe(address: string | null, fn: (s: FullState) => void): () => void {
    const listener = (base?: FullState) => fn(this.composeStreamSnapshot(address, base));
    this.listeners.add(listener);
    fn(this.snapshotForStream(address));
    return () => this.listeners.delete(listener);
  }

  /**
   * Build the shared (address-independent) snapshot ONCE per emit and let each
   * subscriber merge only its player fields — keeps tick cost flat as concurrent
   * connections grow instead of rebuilding candles/history/path per subscriber.
   */
  private emit() {
    if (this.listeners.size === 0) return;
    const base = this.snapshotForStream(null);
    this.listeners.forEach(l => l(base));
  }

  private composeStreamSnapshot(address: string | null, base?: FullState): FullState {
    if (!base) return this.snapshotForStream(address);
    if (!address) return base;
    return { ...base, ...this.playerSnapshot(address) };
  }

  private playerSnapshot(address: string | null): Pick<
    FullState,
    | 'hasPosition'
    | 'hasLivePosition'
    | 'entryPending'
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
        hasLivePosition: false,
        entryPending: false,
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
    const pending =
      player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;
    const showPending = pending != null && this.phase === 'waiting';
    return {
      hasPosition: player.hasPosition || showPending,
      hasLivePosition: player.hasPosition,
      entryPending: showPending,
      positionSide: player.hasPosition ? player.positionSide : pending?.side ?? player.positionSide,
      positionAmount: player.hasPosition ? player.positionAmount : pending?.amount ?? 0,
      positionLeverage: player.hasPosition ? player.positionLeverage : pending?.leverage ?? 1,
      positionEntryPrice: player.hasPosition ? player.positionEntryPrice : 1.0,
      balance: player.balance,
      lastResult: player.lastResult,
      autoSell: player.autoSell,
    };
  }

  snapshot(address: string | null = null): FullState {
    const pathMult =
      this.phase === 'running' && this.round.path.length > 0
        ? (this.round.path[Math.min(this.tickIdx, this.round.path.length - 1)]?.price ?? this.mult)
        : this.mult;
    const fairMult = this.phase === 'running' ? pathMult : this.mult;
    const buyersIn = this.countBuyersIn();
    return {
      phase: this.phase,
      gameId: this.round.id,
      mult: fairMult,
      pathMult,
      tickIdx: this.tickIdx,
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
        mode: this.round.mode,
        rugTick: this.round.revealed ? this.round.rugTick : null,
      },
      players: buyersIn,
      buyersIn,
      roundBuyVolume: this.roundBuyVolume,
      roundSellVolume: this.roundSellVolume,
      orderPressure: this.orderPressure,
      ...this.playerSnapshot(address),
    };
  }

  /** Lightweight snapshot for SSE — omits heavy seed fields from history. */
  snapshotForStream(address: string | null = null): FullState {
    const full = this.snapshot(address);
    // Only a short smoothing window ahead, padded to CONSTANT length with a
    // plausible continuation — a longer/shrinking window would let anyone reading
    // the raw SSE payload see exactly when the round crashes and exit perfectly.
    const AHEAD_TICKS = 8;
    let pathAhead: number[] | undefined;
    if (this.phase === 'running' && this.round.path.length > 0) {
      if (this.mode === 'continuous') {
        const prev = this.round.path[Math.max(0, this.tickIdx - 1)]?.price ?? this.mult;
        const observedMove = prev > 0 ? this.mult / prev - 1 : 0;
        const trend = Math.max(-0.008, Math.min(0.008, observedMove));
        pathAhead = Array.from({ length: AHEAD_TICKS }, (_, i) =>
          Math.max(0.05, this.mult * Math.pow(1 + trend * 0.35, i)),
        );
      } else {
        const upcoming = this.round.path
          .slice(this.tickIdx, Math.min(this.tickIdx + AHEAD_TICKS, this.round.path.length - 1))
          .map(p => p.price);
        const lastKnown = upcoming[upcoming.length - 1] ?? this.mult;
        const growth = 1 + Math.max(0.0005, Math.min(0.01, (lastKnown - 1) * 0.004));
        while (upcoming.length < AHEAD_TICKS) {
          upcoming.push(Math.max(1.0, (upcoming[upcoming.length - 1] ?? lastKnown) * growth));
        }
        pathAhead = upcoming;
      }
    }
    return {
      ...full,
      serverNow: Date.now(),
      pathAhead,
      history: full.history.map(h => ({
        id: h.id,
        crashPoint: h.crashPoint,
        ts: h.ts,
        instantRug: h.instantRug,
        mode: h.mode,
        rugTick: h.rugTick,
        serverSeedHash: h.serverSeedHash.slice(0, 16),
        serverSeed: null,
      })),
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
      if (this.mode === 'continuous') {
        this.mult = Math.max(CONTINUOUS_PRICE_FLOOR, Math.min(CONTINUOUS_PRICE_CEIL, flowMult));
      } else {
        const ceiling = Math.max(1.01, this.round.crashPoint - 0.01);
        this.mult = Math.max(1.0, Math.min(ceiling, flowMult));
      }
      this.peakMult = Math.max(this.peakMult, this.mult);

      this.candleHigh = Math.max(this.candleHigh, this.mult);
      this.candleLow = Math.min(this.candleLow, this.mult);
      this.updateLiveCandle();

      const candleEvery =
        this.mode === 'continuous' ? CONTINUOUS_CANDLE_TICKS : CLASSIC_CANDLE_TICKS;
      if (this.tickIdx % candleEvery === 0) {
        this.commitCandle();
      }

      this.simulateBots();
      this.checkAutoSellForAllPlayers();
      this.checkLiquidationsForAllPlayers();

      if (this.mode === 'continuous') {
        if (this.tickIdx >= this.liquidityAdjustedRugTick()) {
          this.round.rugTick = this.tickIdx;
          this.crash();
          return;
        }
      } else if (this.tickIdx >= this.round.path.length - 1) {
        this.crash();
        return;
      }

      this.emit();
      return;
    }

    if (this.phase === 'crashed') {
      this.waitLeft -= TICK_MS / 1000;
      if (this.waitLeft <= 0) {
        this.forceClearAllPlayers(true, 'new-countdown');
        for (const player of this.players.values()) {
          player.lastResult = null;
        }
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
    this.pushFeed(playerMarkerName(address), 'rug', margin, this.mult, -margin, { leverage, side });
    this.clearPlayerPosition(player);
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
    for (const player of this.players.values()) {
      const pending = player.pendingEntry;
      if (pending && pending.roundId === this.round.id) {
        player.hasPosition = true;
        player.positionSide = pending.side;
        player.positionAmount = pending.amount;
        player.positionLeverage = pending.leverage;
        player.positionEntryPrice = 1.0;
        player.positionRoundId = this.round.id;
        player.pendingEntry = null;
      } else if (pending) {
        this.clearPendingEntry(player, true);
      }
    }

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
    this.baseRugTick = this.round.rugTick;
    // Presale liquidity counts toward delaying the rug.
    for (const player of this.players.values()) {
      if (player.hasPosition && player.positionRoundId === this.round.id) {
        this.roundBuyVolume += player.positionAmount * Math.max(1, player.positionLeverage);
      }
    }
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
      const settlement = calcCrashSettlement({
        side: player.positionSide,
        margin,
        leverage: player.positionLeverage,
        entry: player.positionEntryPrice,
        exit: exitMult,
        stimmy: player.stimmy,
        frenzy: player.frenzy,
      });
      const { pnl } = settlement;
      if (pnl > 0) {
        const maxBalance = address.startsWith('0x') ? Number.MAX_SAFE_INTEGER : MAX_DEMO_BALANCE;
        player.balance = Math.min(maxBalance, roundMoney(player.balance + settlement.returnAmount));
        mirrorCrashBalanceToFlip(address, player.balance);
        dispatchSettlement({
          type: 'payout',
          player: address,
          amount: settlement.returnAmount,
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
        won: pnl > 0.0001,
        amount: pnl,
        price: exitMult,
        bonusAmount: settlement.bonus > 0 ? settlement.bonus : undefined,
        frenzyProc: settlement.frenzyProc || undefined,
      };
      this.clearPlayerPosition(player);
    }

    this.forceClearAllPlayers(false, 'after-crash');
    this.lastSettledRoundId = this.round.id;
    this.round.revealed = true;
    const cp = this.round.crashPoint;
    if (cp >= 1.85 && cp <= 1.97) {
      this.pushFeed('SYSTEM', 'rug', 0, cp, 0);
    }
    for (const player of this.players.values()) {
      if (!player.hasPosition || !player.autoSell || player.positionSide !== 'buy') continue;
      const tp = player.positionEntryPrice * player.autoSell;
      if (cp < tp && tp - cp <= 0.2) {
        this.pushFeed('SYSTEM', 'rug', 0, cp, 0);
      }
    }
    this.history.unshift({
      id: this.round.id,
      crashPoint: this.round.crashPoint,
      serverSeedHash: this.round.serverSeedHash,
      serverSeed: this.round.serverSeed,
      clientSeed: this.round.clientSeed,
      nonce: this.round.nonce,
      instantRug: this.round.instantRug,
      mode: this.round.mode,
      rugTick: this.round.rugTick ?? undefined,
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
          b.side = this.mode === 'continuous' || Math.random() < 0.55 ? 'buy' : 'sell';
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
    this.tradeTags.push({
      id: this.tagId++,
      user,
      side,
      amount,
      price,
      t: Date.now(),
      candleT: this.candleStartTime,
    });
    if (this.tradeTags.length > MAX_TAGS) this.tradeTags.shift();
  }

  private placePendingEntry(
    address: string,
    side: 'buy' | 'sell',
    amount: number,
    leverage: number,
  ): { ok: boolean; error?: string; balance?: number; action?: 'open' } {
    const player = this.getPlayer(address);
    if (this.phase !== 'waiting') {
      return { ok: false, error: 'wait for the next round' };
    }

    this.preparePlayerForEnter(address);
    const pending = player.pendingEntry;

    if (pending && pending.roundId === this.round.id) {
      if (pending.side === side) {
        return {
          ok: false,
          error: `already entered ${side === 'buy' ? 'long' : 'short'} this countdown`,
        };
      }
      this.clearPendingEntry(player, true);
    }

    if (player.hasPosition) {
      return { ok: false, error: 'already in position' };
    }

    const margin = Math.floor(amount * 1000) / 1000;
    if (!Number.isFinite(margin) || margin <= 0) {
      return { ok: false, error: 'invalid amount' };
    }
    const openFee = leveragedOpenFee(margin, leverage);
    const totalDebit = roundMoney(margin + openFee);
    if (!Number.isFinite(totalDebit) || totalDebit > player.balance + 0.0005) {
      return {
        ok: false,
        error: `insufficient balance (${player.balance.toFixed(3)} BlackBalls available; ${openFee.toFixed(3)} fee)`,
      };
    }

    player.balance = roundMoney(player.balance - totalDebit);
    player.pendingEntry = { side, amount: margin, leverage, roundId: this.round.id };

    const notional = margin * leverage;
    this.applyOrderFlow(side, notional);
    const playerName = playerMarkerName(address);
    this.pushFeed(playerName, side, margin, 1.0, -margin, { leverage, side });
    this.pushTag(playerName, side, margin, 1.0);
    this.emit();
    mirrorCrashBalanceToFlip(address, player.balance);
    return { ok: true, balance: player.balance, action: 'open' };
  }

  private placeLiveEntry(
    address: string,
    amount: number,
    leverage: number,
  ): { ok: boolean; error?: string; balance?: number; action?: 'open' } {
    const player = this.getPlayer(address);
    if (this.mode !== 'continuous' || this.phase !== 'running') {
      return { ok: false, error: 'live entry unavailable' };
    }
    if (player.hasPosition || player.pendingEntry) {
      return { ok: false, error: 'already in position' };
    }

    const margin = Math.floor(amount * 1000) / 1000;
    if (!Number.isFinite(margin) || margin <= 0) {
      return { ok: false, error: 'invalid amount' };
    }
    const openFee = leveragedOpenFee(margin, leverage);
    const totalDebit = roundMoney(margin + openFee);
    if (!Number.isFinite(totalDebit) || totalDebit > player.balance + 0.0005) {
      return {
        ok: false,
        error: `insufficient balance (${player.balance.toFixed(3)} BlackBalls available; ${openFee.toFixed(3)} fee)`,
      };
    }

    player.balance = roundMoney(player.balance - totalDebit);
    player.hasPosition = true;
    player.positionSide = 'buy';
    player.positionAmount = margin;
    player.positionLeverage = leverage;
    player.positionEntryPrice = this.mult;
    player.positionRoundId = this.round.id;
    player.pendingEntry = null;

    this.applyOrderFlow('buy', margin * leverage);
    const playerName = playerMarkerName(address);
    this.pushFeed(playerName, 'buy', margin, this.mult, -totalDebit, {
      leverage,
      side: 'buy',
    });
    this.pushTag(playerName, 'buy', margin, this.mult);
    this.emit();
    mirrorCrashBalanceToFlip(address, player.balance);
    return { ok: true, balance: player.balance, action: 'open' };
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
    return this.placePendingEntry(address, side, amount, leverage);
  }

  private cancelPendingEntry(address: string): {
    ok: boolean;
    error?: string;
    balance?: number;
    action?: 'close';
  } {
    const player = this.getPlayer(address);
    const pending =
      player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;
    if (!pending) {
      return { ok: false, error: 'no pending entry' };
    }
    const closeSide = pending.side === 'buy' ? 'sell' : 'buy';
    this.pushFeed(playerMarkerName(address), closeSide, pending.amount, 1.0, 0, {
      leverage: pending.leverage,
      side: pending.side,
    });
    this.clearPendingEntry(player, true);
    this.emit();
    mirrorCrashBalanceToFlip(address, player.balance);
    return { ok: true, balance: player.balance, action: 'close' };
  }

  private ensureLivePosition(player: PlayerState): boolean {
    if (player.hasPosition && player.positionAmount > 0) return true;

    const pending =
      player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;
    if (this.phase === 'running' && pending) {
      player.hasPosition = true;
      player.positionSide = pending.side;
      player.positionAmount = pending.amount;
      player.positionLeverage = pending.leverage;
      player.positionEntryPrice = 1.0;
      player.positionRoundId = this.round.id;
      player.pendingEntry = null;
      return true;
    }

    return false;
  }

  private closePosition(
    address: string,
    percent = 1,
  ): {
    ok: boolean;
    error?: string;
    balance?: number;
    frenzyProc?: boolean;
    settlement?: SettlementAction;
    action?: 'close' | 'partial';
    cashedPct?: number;
    exitPrice?: number;
    remainingAmount?: number;
  } {
    const player = this.getPlayer(address);
    const pct = Math.min(1, Math.max(0.01, percent));

    if (this.phase === 'waiting') {
      const pending =
        player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;
      if (pending) {
        return this.cancelPendingEntry(address);
      }
      if (!player.hasPosition) {
        return { ok: false, error: 'no position' };
      }
      if (pct < 1) return { ok: false, error: 'partial cash-out only during live round' };
      const margin = player.positionAmount;
      const closeSide = player.positionSide === 'buy' ? 'sell' : 'buy';
      const leverage = player.positionLeverage;
      const side = player.positionSide;
      player.balance += margin;
      this.pushFeed(playerMarkerName(address), closeSide, margin, 1.0, 0, { leverage, side });
      this.clearPlayerPosition(player);
      this.emit();
      return { ok: true, balance: player.balance, action: 'close' };
    }

    if (this.phase !== 'running') {
      if (this.phase === 'crashed') {
        return { ok: false, error: 'round ended — wait for the next countdown' };
      }
      return { ok: false, error: 'cash-out only during live round' };
    }

    if (!this.ensureLivePosition(player)) {
      return { ok: false, error: 'no open position — enter during the countdown' };
    }

    const margin = player.positionAmount;
    const split = splitPartialCashout(margin, pct);
    const closeMargin = split.closeMargin;
    if (closeMargin <= 0) return { ok: false, error: 'invalid amount' };

    const leverage = player.positionLeverage;
    const side = player.positionSide;
    const entry = player.positionEntryPrice;
    const exit = this.mult;
    const settlementResult = calcCrashSettlement({
      side: player.positionSide,
      margin: closeMargin,
      leverage,
      entry,
      exit,
      stimmy: player.stimmy,
      frenzy: player.frenzy,
    });
    const { pnl, returnAmount, frenzyProc } = settlementResult;
    const bonusAmount = settlementResult.bonus;
    const maxBalance = address.startsWith('0x') ? Number.MAX_SAFE_INTEGER : MAX_DEMO_BALANCE;
    const nextBalance = roundMoney(player.balance + returnAmount);
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      return { ok: false, error: 'invalid payout' };
    }
    player.balance = Math.min(maxBalance, nextBalance);
    const closeSide = player.positionSide === 'buy' ? 'sell' : 'buy';
    this.applyOrderFlow(closeSide, closeMargin * leverage);

    const remaining = split.remaining;
    const fullClose = split.fullClose;

    if (fullClose) {
      player.lastResult = {
        won: pnl > 0.0001,
        amount: pnl,
        price: exit,
        bonusAmount: bonusAmount && bonusAmount > 0 ? bonusAmount : undefined,
        frenzyProc: frenzyProc || undefined,
      };
      this.clearPlayerPosition(player);
    } else {
      player.positionAmount = parseFloat(remaining.toFixed(3));
      player.lastResult = {
        won: pnl > 0.0001,
        amount: pnl,
        price: exit,
        bonusAmount: bonusAmount && bonusAmount > 0 ? bonusAmount : undefined,
        frenzyProc: frenzyProc || undefined,
      };
    }

    const playerName = playerMarkerName(address);
    this.pushFeed(playerName, 'cashout', closeMargin, exit, pnl, { leverage, side });
    this.pushTag(playerName, closeSide, closeMargin, exit);
    this.emit();
    mirrorCrashBalanceToFlip(address, player.balance);

    const settlement: SettlementAction = {
      type: 'payout',
      player: address,
      amount: returnAmount,
    };

    return {
      ok: true,
      balance: player.balance,
      frenzyProc,
      settlement,
      action: fullClose ? 'close' : 'partial',
      cashedPct: pct,
      exitPrice: exit,
      remainingAmount: fullClose ? 0 : remaining,
    };
  }

  /** Manual / partial cash-out during live running phase. */
  cashOut(address: string, percent = 1) {
    return this.closePosition(address, percent);
  }

  /** Cancel pending countdown entry or close an open position (waiting/running). */
  cancelCountdownEntry(address: string): {
    ok: boolean;
    error?: string;
    balance?: number;
    action?: 'close' | 'partial';
    exitPrice?: number;
  } {
    const player = this.getPlayer(address);
    const pending =
      player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;

    if (this.phase === 'waiting') {
      if (pending) {
        return this.cancelPendingEntry(address);
      }
      if (player.hasPosition && player.positionRoundId === this.round.id) {
        return this.closePosition(address, 1);
      }
      const view = this.clientPlayerView(address);
      if (!view.hasPosition && !view.entryPending) {
        return { ok: true, balance: player.balance, action: 'close' };
      }
      return { ok: false, error: 'no pending entry to cancel' };
    }

    if (this.phase === 'running') {
      if (this.ensureLivePosition(player) || player.hasPosition) {
        return this.closePosition(address, 1);
      }
      if (pending) {
        return this.cancelPendingEntry(address);
      }
      return { ok: false, error: 'no open position to close' };
    }

    return { ok: false, error: 'wait for the next round' };
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
    action?: 'open' | 'close' | 'partial';
    cashedPct?: number;
    exitPrice?: number;
  } {
    const lev = Math.round(leverage * 2) / 2;
    if (lev < MIN_LEVERAGE || lev > MAX_LEVERAGE) {
      return { ok: false, error: 'invalid leverage' };
    }

    const player = this.getPlayer(address);

    if (this.mode === 'continuous') {
      if (this.phase === 'waiting') {
        if (side === 'sell' && !player.pendingEntry && !player.hasPosition) {
          return { ok: false, error: 'no long position to sell' };
        }
        if (side === 'sell') {
          return player.pendingEntry
            ? this.cancelPendingEntry(address)
            : this.closePosition(address);
        }
        this.preparePlayerForEnter(address);
        if (player.pendingEntry || player.hasPosition) {
          return { ok: false, error: 'already entered this round' };
        }
        return this.placePendingEntry(address, 'buy', amount, lev);
      }
      if (this.phase === 'running') {
        if (side === 'sell') {
          if (!player.hasPosition) {
            return { ok: false, error: 'no long position to sell' };
          }
          // amount as fraction of position → partial sell (50%/75%); else full close
          const pct =
            amount > 0 && amount < player.positionAmount - 0.0005
              ? Math.min(1, Math.max(0.01, amount / player.positionAmount))
              : 1;
          return this.closePosition(address, pct);
        }
        return this.placeLiveEntry(address, amount, lev);
      }
      return { ok: false, error: 'wait for the next round' };
    }

    if (this.phase === 'waiting') {
      this.preparePlayerForEnter(address);
      const pending =
        player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;

      if (pending) {
        if (pending.side === side) {
          return {
            ok: false,
            error: `already entered ${side === 'buy' ? 'long' : 'short'} this countdown`,
          };
        }
        return this.cancelPendingEntry(address);
      }

      if (player.hasPosition) {
        if (player.positionSide === side) {
          return {
            ok: false,
            error: `already entered ${side === 'buy' ? 'long' : 'short'} this countdown`,
          };
        }
        return this.closePosition(address);
      }

      return this.placePendingEntry(address, side, amount, lev);
    }

    if (this.phase === 'running') {
      if (!player.hasPosition) {
        return { ok: false, error: 'wait for the next round' };
      }
      if (player.positionSide === side) {
        return { ok: false, error: 'use opposite side to close' };
      }
      return this.closePosition(address);
    }

    return { ok: false, error: 'wait for the next round' };
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

  exportEngineSnapshot() {
    return {
      gameId: this.gameId,
      phase: this.phase,
      waitLeft: this.waitLeft,
      elapsed: this.elapsed,
      mult: this.mult,
      peakMult: this.peakMult,
      lastSettledRoundId: this.lastSettledRoundId,
    };
  }

  applyEngineSnapshot(
    snap: {
      gameId: number;
      phase: Phase;
      waitLeft: number;
      elapsed: number;
      mult: number;
      peakMult: number;
      lastSettledRoundId: number;
    },
    catchUpSec = 0,
  ) {
    if (snap.gameId < this.gameId - 2) return;

    while (this.gameId < snap.gameId) {
      this.lastSettledRoundId = this.gameId;
      this.gameId++;
      this.round = this.newRound();
    }

    if (this.gameId > snap.gameId) {
      this.gameId = snap.gameId;
      this.round = this.newRound();
    }

    let { phase, waitLeft, elapsed, mult, peakMult } = snap;
    const catchUp = Math.max(0, Math.min(catchUpSec, 15));

    if (catchUp > 0) {
      if (phase === 'waiting' || phase === 'crashed') {
        waitLeft = Math.max(0, waitLeft - catchUp);
      } else if (phase === 'running') {
        elapsed += catchUp;
      }
    }

    this.phase = phase;
    this.waitLeft = waitLeft;
    this.elapsed = elapsed;
    this.peakMult = peakMult;
    this.lastSettledRoundId = snap.lastSettledRoundId;
    this.tickIdx = Math.max(0, Math.floor((this.elapsed * 1000) / TICK_MS));

    if (this.phase === 'running' && this.round.path.length > 0) {
      const pathTick = this.round.path[Math.min(this.tickIdx, this.round.path.length - 1)];
      const baseMult = pathTick?.price ?? mult;
      this.pressureOffset = 0;
      this.mult =
        this.mode === 'continuous'
          ? Math.max(0.05, Math.min(100, baseMult))
          : Math.max(1.0, Math.min(Math.max(1.01, this.round.crashPoint - 0.01), baseMult));
      this.peakMult = Math.max(this.peakMult, this.mult);
    } else {
      this.mult = mult;
    }
  }

  exportPlayerSnapshot(address: string) {
    const player = this.players.get(address);
    if (!player) return null;
    const pending =
      player.pendingEntry?.roundId === this.round.id ? player.pendingEntry : null;
    const showPending = pending != null && this.phase === 'waiting';
    return {
      balance: player.balance,
      hasPosition: player.hasPosition,
      entryPending: showPending,
      positionSide: player.hasPosition ? player.positionSide : pending?.side ?? player.positionSide,
      positionAmount: player.hasPosition ? player.positionAmount : pending?.amount ?? 0,
      positionLeverage: player.hasPosition ? player.positionLeverage : pending?.leverage ?? 1,
      positionEntryPrice: player.hasPosition ? player.positionEntryPrice : 1.0,
      positionRoundId: player.positionRoundId,
      pendingSide: pending?.side ?? null,
      pendingAmount: pending?.amount ?? null,
      pendingLeverage: pending?.leverage ?? null,
      pendingRoundId: pending?.roundId ?? null,
      autoSell: player.autoSell,
      stimmy: player.stimmy,
      frenzy: player.frenzy,
    };
  }

  importPlayerSnapshot(
    address: string,
    row: {
      balance: number;
      hasPosition: boolean;
      entryPending: boolean;
      positionSide: 'buy' | 'sell';
      positionAmount: number;
      positionLeverage: number;
      positionEntryPrice: number;
      positionRoundId: number | null;
      pendingSide: 'buy' | 'sell' | null;
      pendingAmount: number | null;
      pendingLeverage: number | null;
      pendingRoundId: number | null;
      autoSell: number | null;
      stimmy: number;
      frenzy: number;
    },
  ) {
    const player = this.getPlayer(address);
    const localActive =
      player.hasPosition ||
      (player.pendingEntry != null && player.pendingEntry.roundId === this.round.id);
    if (localActive) return;

    const maxBalance = address.startsWith('0x') ? Number.MAX_SAFE_INTEGER : MAX_DEMO_BALANCE;
    player.balance = Number.isFinite(row.balance)
      ? roundMoney(Math.min(maxBalance, Math.max(0, row.balance)))
      : 0;
    player.stimmy = clampRate(row.stimmy, MAX_STIMMY_RATE);
    player.frenzy = clampRate(row.frenzy, MAX_FRENZY_RATE);
    player.autoSell = row.autoSell;

    if (row.entryPending && row.pendingRoundId === this.round.id && this.phase === 'waiting') {
      player.pendingEntry = {
        side: this.mode === 'continuous' ? 'buy' : row.pendingSide ?? row.positionSide,
        amount: row.pendingAmount ?? row.positionAmount,
        leverage: row.pendingLeverage ?? row.positionLeverage,
        roundId: row.pendingRoundId,
      };
      return;
    }

    if (row.hasPosition && row.positionRoundId === this.round.id) {
      player.hasPosition = true;
      player.positionSide = this.mode === 'continuous' ? 'buy' : row.positionSide;
      player.positionAmount = row.positionAmount;
      player.positionLeverage = row.positionLeverage;
      player.positionEntryPrice = row.positionEntryPrice;
      player.positionRoundId = row.positionRoundId;
      player.pendingEntry = null;
    }
  }

  reconcilePlayerFromClient(
    address: string,
    view: {
      phase?: Phase;
      gameId?: number;
      hasPosition?: boolean;
      hasLivePosition?: boolean;
      entryPending?: boolean;
      positionSide?: 'buy' | 'sell';
      positionAmount?: number;
      positionLeverage?: number;
      positionEntryPrice?: number;
      balance?: number;
    },
  ): boolean {
    if (view.gameId != null && view.gameId !== this.gameId) return false;

    const player = this.getPlayer(address);
    const localActive =
      player.hasPosition ||
      (player.pendingEntry != null && player.pendingEntry.roundId === this.round.id);
    if (localActive) return true;

    if (typeof view.balance === 'number' && Number.isFinite(view.balance)) {
      player.balance = roundMoney(Math.min(MAX_DEMO_BALANCE, Math.max(0, view.balance)));
    }

    // Never trust client-supplied leverage/entry price — clamp to server rules
    // (entries always open @ 1.00x, leverage capped at MAX_LEVERAGE).
    const rawLeverage = view.positionLeverage ?? 1;
    const safeLeverage = Number.isFinite(rawLeverage)
      ? Math.min(MAX_LEVERAGE, Math.max(MIN_LEVERAGE, rawLeverage))
      : MIN_LEVERAGE;
    const rawAmount = view.positionAmount ?? 0;
    const safeAmount =
      Number.isFinite(rawAmount) && rawAmount > 0
        ? roundMoney(Math.min(MAX_DEMO_BALANCE, rawAmount))
        : 0;

    if (view.entryPending && this.phase === 'waiting') {
      player.pendingEntry = {
        side: this.mode === 'continuous' ? 'buy' : view.positionSide ?? 'buy',
        amount: safeAmount,
        leverage: safeLeverage,
        roundId: this.round.id,
      };
      return Boolean(player.pendingEntry.amount > 0);
    }

    if ((view.hasLivePosition || view.hasPosition) && this.phase === 'running') {
      player.hasPosition = true;
      player.positionSide = this.mode === 'continuous' ? 'buy' : view.positionSide ?? 'buy';
      player.positionAmount = safeAmount;
      player.positionLeverage = safeLeverage;
      // A reconnecting Demo client cannot choose a favorable entry. Continuous
      // recovery resumes at the current authoritative server price.
      player.positionEntryPrice = this.mode === 'continuous' ? this.mult : 1.0;
      player.positionRoundId = this.round.id;
      player.pendingEntry = null;
      return player.positionAmount > 0;
    }

    if ((view.hasLivePosition || view.hasPosition) && this.phase === 'waiting') {
      player.pendingEntry = {
        side: this.mode === 'continuous' ? 'buy' : view.positionSide ?? 'buy',
        amount: safeAmount,
        leverage: safeLeverage,
        roundId: this.round.id,
      };
      return player.pendingEntry.amount > 0;
    }

    return false;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __blackballsCrashDemoManager: CrashManager | undefined;
  // eslint-disable-next-line no-var
  var __blackballsCrashRealManager: CrashManager | undefined;
}

export function getManager(address: string | null = null): CrashManager {
  const real = Boolean(address?.startsWith('0x'));
  if (real) {
    if (!globalThis.__blackballsCrashRealManager) {
      globalThis.__blackballsCrashRealManager = new CrashManager('classic');
    }
    return globalThis.__blackballsCrashRealManager;
  }
  if (!globalThis.__blackballsCrashDemoManager) {
    globalThis.__blackballsCrashDemoManager = new CrashManager('continuous');
  }
  return globalThis.__blackballsCrashDemoManager;
}
