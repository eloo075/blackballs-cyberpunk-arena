import { FLIP_CONFIG, flipMaxBet, flipRakeRate } from './flip-config';
import {
  computeFlipResult,
  defaultClientSeed,
  generateServerSeed,
  hashServerSeed,
  type FlipSide,
} from './flip-engine';
import type {
  DogpilePot,
  Flip1v1Match,
  FlipFeedEvent,
  FlipFullState,
  FlipHistoryEntry,
  FlipParticipant,
  FlipPhase,
  FlipPlayerView,
} from './flip-types';
import { DEMO_MIN_BALANCE } from './demo-credits';
import { mirrorFlipBalanceToCrash } from './mirror-session-balance';

interface PlayerState {
  balance: number;
  holdsBlackballs: boolean;
  winStreak: number;
  lossStreak: number;
  lastOpponent: string | null;
  active1v1Id: string | null;
  activeDogpileSide: FlipSide | null;
  lastResult: FlipPlayerView['lastResult'];
}

const BOT_NAME = 'DEGEN_BOT';

function shortAddr(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function opposite(side: FlipSide): FlipSide {
  return side === 'heads' ? 'tails' : 'heads';
}

export class FlipManager {
  private players = new Map<string, PlayerState>();
  private open1v1: Flip1v1Match[] = [];
  private active1v1: Flip1v1Match | null = null;
  private dogpile!: DogpilePot;
  private history: FlipHistoryEntry[] = [];
  private feed: FlipFeedEvent[] = [];
  private feedId = 0;
  private matchId = 0;
  private dogpileRound = 0;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private botTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** In-flight 1v1 matches — resolve even if bumped off the global active slot. */
  private pending1v1 = new Map<string, Flip1v1Match>();

  constructor() {
    this.dogpile = this.newDogpilePot();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private newDogpilePot(): DogpilePot {
    this.dogpileRound++;
    const serverSeed = generateServerSeed();
    return {
      id: `dp-${this.dogpileRound}`,
      round: this.dogpileRound,
      heads: [],
      tails: [],
      headsTotal: 0,
      tailsTotal: 0,
      status: 'idle',
      endsAt: Date.now() + FLIP_CONFIG.DOGPILE_ROUND_SEC * 1000,
      serverSeedHash: hashServerSeed(serverSeed),
      serverSeed,
      clientSeed: defaultClientSeed(),
      nonce: this.dogpileRound,
      flipStartedAt: undefined,
    };
  }

  private getPlayer(address: string): PlayerState {
    let p = this.players.get(address);
    if (!p) {
      p = {
        balance: 0,
        holdsBlackballs: false,
        winStreak: 0,
        lossStreak: 0,
        lastOpponent: null,
        active1v1Id: null,
        activeDogpileSide: null,
        lastResult: null,
      };
      this.players.set(address, p);
    }
    return p;
  }

  /** Force-align liquid balance from the other game (ignores locked-wager guards). */
  applyPeerBalance(address: string, balance: number): number {
    const p = this.getPlayer(address);
    p.balance = parseFloat(Math.max(0, balance).toFixed(3));
    this.emit();
    return p.balance;
  }

  syncPlayer(address: string, balance: number, holdsBlackballs: boolean, options?: { boot?: boolean }): number {
    const p = this.getPlayer(address);
    const isDemo = !address.startsWith('0x');
    this.reconcilePlayerSession(address, options?.boot === true);

    const clientBalance = parseFloat(Math.max(0, balance).toFixed(3));
    const locked = this.lockedWagerForPlayer(address);

    if (options?.boot && isDemo) {
      const inActiveFlip =
        !!p.active1v1Id &&
        (this.pending1v1.has(p.active1v1Id) ||
          this.active1v1?.id === p.active1v1Id ||
          this.open1v1.some(m => m.id === p.active1v1Id));
      if (!inActiveFlip) {
        p.active1v1Id = null;
        p.activeDogpileSide = null;
      }
      if (locked <= 0) {
        p.balance = clientBalance;
      }
      p.holdsBlackballs = holdsBlackballs;
      this.emit();
      return p.balance;
    }

    if (locked <= 0) {
      if (clientBalance <= p.balance + 0.001) {
        p.balance = clientBalance;
      } else if (isDemo && clientBalance >= DEMO_MIN_BALANCE && p.balance < DEMO_MIN_BALANCE) {
        p.balance = clientBalance;
      }
    } else if (isDemo && clientBalance >= DEMO_MIN_BALANCE && p.balance < DEMO_MIN_BALANCE) {
      p.balance = clientBalance;
    }

    p.holdsBlackballs = holdsBlackballs;
    this.emit();
    return p.balance;
  }

  /** Clear orphan match pointers; on tab enter refund & cancel stale waiting lobbies. */
  private reconcilePlayerSession(address: string, boot = false): void {
    const p = this.getPlayer(address);

    if (boot) {
      for (const match of this.open1v1.filter(
        m => m.creator.address === address && m.status === 'waiting',
      )) {
        this.cancel1v1Internal(address, match);
      }
    }

    if (p.active1v1Id) {
      const open = this.open1v1.find(m => m.id === p.active1v1Id && m.status === 'waiting');
      const active = this.active1v1?.id === p.active1v1Id ? this.active1v1 : null;
      const valid =
        (open && open.status === 'waiting') ||
        (active && (active.status === 'flipping' || active.status === 'waiting'));
      if (!valid || active?.status === 'done') {
        if (open && open.creator.address === address) {
          this.cancel1v1Internal(address, open);
        }
        p.active1v1Id = null;
      }
    }

    // Orphan waiting lobby (balance locked, pointer missing) — refund on reconcile.
    const orphanWaiting = this.open1v1.find(
      m => m.creator.address === address && m.status === 'waiting' && m.id !== p.active1v1Id,
    );
    if (orphanWaiting) {
      this.cancel1v1Internal(address, orphanWaiting);
    }

    const waitingAsCreator = this.open1v1.find(
      m => m.creator.address === address && m.status === 'waiting',
    );
    if (boot && waitingAsCreator && !p.active1v1Id) {
      p.active1v1Id = waitingAsCreator.id;
    }
  }

  private lockedWagerForPlayer(address: string): number {
    const p = this.getPlayer(address);
    if (!p.active1v1Id) return 0;

    const open = this.open1v1.find(m => m.id === p.active1v1Id && m.status === 'waiting');
    if (open) return open.wager;

    if (this.active1v1?.id === p.active1v1Id && this.active1v1.status === 'flipping') {
      const isParticipant =
        this.active1v1.creator.address === address ||
        this.active1v1.opponent?.address === address;
      return isParticipant ? this.active1v1.wager : 0;
    }

    return 0;
  }

  private cancel1v1Internal(address: string, match: Flip1v1Match): boolean {
    const player = this.getPlayer(address);
    if (match.creator.address !== address || match.status !== 'waiting') return false;

    player.balance = parseFloat((player.balance + match.wager).toFixed(3));
    player.active1v1Id = null;
    mirrorFlipBalanceToCrash(address, player.balance);

    const t = this.botTimers.get(match.id);
    if (t) {
      clearTimeout(t);
      this.botTimers.delete(match.id);
    }
    this.open1v1 = this.open1v1.filter(m => m.id !== match.id);
    return true;
  }

  subscribe(address: string | null, fn: (s: FlipFullState) => void): () => void {
    const listener = () => fn(this.snapshot(address));
    this.listeners.add(listener);
    fn(this.snapshot(address));
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private pushFeed(kind: FlipFeedEvent['kind'], player: string, text: string, amount?: number, highlight = false) {
    this.feed.unshift({ id: this.feedId++, kind, player, text, amount, ts: Date.now(), highlight });
    if (this.feed.length > 50) this.feed.pop();
  }

  private participant(address: string, amount: number, message?: string): FlipParticipant {
    const p = this.getPlayer(address);
    return {
      address,
      display: shortAddr(address),
      amount,
      message,
      holdsBlackballs: p.holdsBlackballs,
    };
  }

  private rakeForPot(participants: FlipParticipant[]): number {
    const anyHolder = participants.some(x => x.holdsBlackballs);
    return flipRakeRate(anyHolder);
  }

  private recordHistory(entry: FlipHistoryEntry) {
    this.history.unshift(entry);
    if (this.history.length > FLIP_CONFIG.MAX_HISTORY) this.history.pop();
  }

  /** Create or instantly join a 1v1 flip. */
  createOrJoin1v1(
    address: string,
    side: FlipSide,
    wager: number,
    message?: string,
  ): { ok: boolean; error?: string; matchId?: string } {
    this.reconcilePlayerSession(address, false);
    const player = this.getPlayer(address);

    if (player.active1v1Id) {
      const ownWaiting = this.open1v1.find(
        m => m.id === player.active1v1Id && m.creator.address === address && m.status === 'waiting',
      );
      if (ownWaiting) {
        this.cancel1v1Internal(address, ownWaiting);
      } else {
        const active = this.active1v1?.id === player.active1v1Id ? this.active1v1 : null;
        if (!active || active.status === 'done') {
          player.active1v1Id = null;
        } else if (active.status === 'flipping') {
          return { ok: false, error: 'already in a match' };
        }
      }
    }

    const maxBet = flipMaxBet(player.holdsBlackballs);
    const wagerFixed = parseFloat(wager.toFixed(3));

    if (wagerFixed < FLIP_CONFIG.MIN_BET) return { ok: false, error: 'bet too small' };
    if (wagerFixed > maxBet) return { ok: false, error: `max bet ${maxBet} BlackBalls` };
    if (player.balance < wagerFixed) return { ok: false, error: 'insufficient balance' };
    if (player.active1v1Id) return { ok: false, error: 'already in a match' };

    const existing = this.open1v1.find(
      m =>
        m.status === 'waiting' &&
        m.creatorSide !== side &&
        Math.abs(m.wager - wagerFixed) < 0.0005 &&
        m.creator.address !== address,
    );

    if (existing) {
      return this.join1v1Internal(address, existing.id, message);
    }

    player.balance = parseFloat((player.balance - wagerFixed).toFixed(3));
    mirrorFlipBalanceToCrash(address, player.balance);
    const serverSeed = generateServerSeed();
    const match: Flip1v1Match = {
      id: `1v1-${++this.matchId}`,
      wager: wagerFixed,
      creator: this.participant(address, wagerFixed, message),
      creatorSide: side,
      status: 'waiting',
      serverSeedHash: hashServerSeed(serverSeed),
      serverSeed,
      clientSeed: defaultClientSeed(),
      nonce: this.matchId,
      createdAt: Date.now(),
    };
    this.open1v1.push(match);
    player.active1v1Id = match.id;
    this.pushFeed('join', shortAddr(address), `opened ${side.toUpperCase()} @ ${wagerFixed} BlackBalls`, wagerFixed);
    if (message) this.pushFeed('taunt', shortAddr(address), message);

    const botTimer = setTimeout(() => this.tryBotMatch(match.id), FLIP_CONFIG.BOT_MATCH_MS);
    this.botTimers.set(match.id, botTimer);

    this.emit();
    return { ok: true, matchId: match.id };
  }

  join1v1(address: string, matchId: string, message?: string) {
    return this.join1v1Internal(address, matchId, message);
  }

  private join1v1Internal(
    address: string,
    matchId: string,
    message?: string,
  ): { ok: boolean; error?: string; matchId?: string } {
    this.reconcilePlayerSession(address, false);
    const match = this.open1v1.find(m => m.id === matchId);
    if (!match || match.status !== 'waiting') return { ok: false, error: 'match not available' };
    if (match.creator.address === address) return { ok: false, error: 'cannot join own match' };

    const player = this.getPlayer(address);
    if (player.balance < match.wager) return { ok: false, error: 'insufficient balance' };
    if (player.active1v1Id) return { ok: false, error: 'already in a match' };

    const t = this.botTimers.get(matchId);
    if (t) {
      clearTimeout(t);
      this.botTimers.delete(matchId);
    }

    player.balance = parseFloat((player.balance - match.wager).toFixed(3));
    mirrorFlipBalanceToCrash(address, player.balance);
    match.opponent = this.participant(address, match.wager, message);
    match.opponentSide = opposite(match.creatorSide);
    match.status = 'flipping';
    match.flipStartedAt = Date.now();
    player.active1v1Id = match.id;
    player.lastOpponent = match.creator.address;
    this.getPlayer(match.creator.address).lastOpponent = address;
    this.getPlayer(match.creator.address).active1v1Id = match.id;

    this.open1v1 = this.open1v1.filter(m => m.id !== matchId);
    this.active1v1 = match;
    this.pending1v1.set(match.id, match);

    this.pushFeed('join', shortAddr(address), `matched ${match.creator.display} — LET IT RIP`, match.wager);
    if (message) this.pushFeed('taunt', shortAddr(address), message);

    setTimeout(() => this.resolve1v1(match.id), FLIP_CONFIG.FLIP_ANIM_MS + 200);
    this.emit();
    return { ok: true, matchId: match.id };
  }

  private tryBotMatch(matchId: string) {
    const match = this.open1v1.find(m => m.id === matchId);
    if (!match || match.status !== 'waiting') return;
    match.isBot = true;
    match.opponent = {
      address: BOT_NAME,
      display: BOT_NAME,
      amount: match.wager,
      holdsBlackballs: false,
    };
    match.opponentSide = opposite(match.creatorSide);
    match.status = 'flipping';
    match.flipStartedAt = Date.now();
    this.open1v1 = this.open1v1.filter(m => m.id !== matchId);
    this.active1v1 = match;
    this.pending1v1.set(match.id, match);
    this.getPlayer(match.creator.address).active1v1Id = match.id;
    this.pushFeed('join', BOT_NAME, `filled empty slot vs ${match.creator.display}`, match.wager);
    setTimeout(() => this.resolve1v1(match.id), FLIP_CONFIG.FLIP_ANIM_MS + 200);
    this.emit();
  }

  private resolve1v1(matchId: string) {
    const match =
      this.pending1v1.get(matchId) ??
      (this.active1v1?.id === matchId ? this.active1v1 : null);
    if (!match || !match.serverSeed) return;

    const { side } = computeFlipResult({
      serverSeed: match.serverSeed,
      clientSeed: match.clientSeed,
      nonce: match.nonce,
    });
    match.result = side;
    match.status = 'done';

    const creatorWon = match.creatorSide === side;
    const winner = creatorWon ? match.creator : match.opponent!;
    const loser = creatorWon ? match.opponent! : match.creator;
    match.winner = winner.address;

    const pot = match.wager * 2;
    const rakeRate = this.rakeForPot([match.creator, match.opponent!]);
    const payout = parseFloat((pot * (1 - rakeRate)).toFixed(3));
    const rake = parseFloat((pot * rakeRate).toFixed(3));
    const profit = parseFloat((payout - match.wager).toFixed(3));

    if (winner.address !== BOT_NAME) {
      const wp = this.getPlayer(winner.address);
      wp.balance = parseFloat((wp.balance + payout).toFixed(3));
      mirrorFlipBalanceToCrash(winner.address, wp.balance);
      wp.winStreak += 1;
      wp.lossStreak = 0;
      wp.lastResult = { won: true, profit, side: winner === match.creator ? match.creatorSide : match.opponentSide!, result: side };
    }
    if (loser.address !== BOT_NAME) {
      const lp = this.getPlayer(loser.address);
      lp.winStreak = 0;
      lp.lossStreak += 1;
      lp.lastResult = {
        won: false,
        profit: -match.wager,
        side: loser === match.creator ? match.creatorSide : match.opponentSide!,
        result: side,
      };
    }

    const highlight = profit >= FLIP_CONFIG.HOF_MIN_PROFIT;
    this.recordHistory({
      id: match.id,
      mode: '1v1',
      result: side,
      totalPot: pot,
      rake,
      winnerDisplay: winner.display,
      profit,
      wager: match.wager,
      ts: Date.now(),
      serverSeedHash: match.serverSeedHash,
      serverSeed: match.serverSeed,
      clientSeed: match.clientSeed,
      nonce: match.nonce,
      highlight,
    });

    this.pushFeed('flip', 'SYSTEM', `${side.toUpperCase()} — ${winner.display} wins ${payout.toFixed(2)} BlackBalls`, payout, highlight);
    this.pushFeed('win', winner.display, `+${profit.toFixed(2)} BlackBalls profit`, profit, highlight);

    this.getPlayer(match.creator.address).active1v1Id = null;
    if (match.opponent && match.opponent.address !== BOT_NAME) {
      this.getPlayer(match.opponent.address).active1v1Id = null;
    }
    this.pending1v1.delete(matchId);

    setTimeout(() => {
      if (this.active1v1?.id === matchId) this.active1v1 = null;
      this.emit();
    }, 3000);

    this.emit();
  }

  joinDogpile(address: string, side: FlipSide, wager: number, message?: string) {
    this.reconcilePlayerSession(address, false);
    const player = this.getPlayer(address);
    const maxBet = flipMaxBet(player.holdsBlackballs);
    const wagerFixed = parseFloat(wager.toFixed(3));

    if (wagerFixed < FLIP_CONFIG.MIN_BET) return { ok: false, error: 'bet too small' };
    if (wagerFixed > maxBet) return { ok: false, error: `max bet ${maxBet} BlackBalls` };
    if (player.balance < wagerFixed) return { ok: false, error: 'insufficient balance' };
    if (this.dogpile.status === 'flipping') return { ok: false, error: 'flip in progress' };

    player.balance = parseFloat((player.balance - wagerFixed).toFixed(3));
    const part = this.participant(address, wagerFixed, message);
    if (side === 'heads') {
      this.dogpile.heads.push(part);
      this.dogpile.headsTotal = parseFloat((this.dogpile.headsTotal + wagerFixed).toFixed(3));
    } else {
      this.dogpile.tails.push(part);
      this.dogpile.tailsTotal = parseFloat((this.dogpile.tailsTotal + wagerFixed).toFixed(3));
    }
    player.activeDogpileSide = side;
    if (this.dogpile.status === 'idle') {
      this.dogpile.status = 'waiting';
      this.dogpile.endsAt = Date.now() + FLIP_CONFIG.DOGPILE_ROUND_SEC * 1000;
    }

    this.pushFeed('dogpile', part.display, `${side.toUpperCase()} +${wagerFixed} BlackBalls${message ? ` — "${message}"` : ''}`, wagerFixed);
    this.emit();
    return { ok: true };
  }

  private resolveDogpile() {
    if (this.dogpile.status === 'flipping' || this.dogpile.status === 'done') return;
    const { heads, tails, headsTotal, tailsTotal } = this.dogpile;
    if (heads.length === 0 && tails.length === 0) {
      this.dogpile = this.newDogpilePot();
      this.emit();
      return;
    }
    if (heads.length === 0 || tails.length === 0) {
      for (const p of [...heads, ...tails]) {
        if (p.address !== BOT_NAME) {
          const pl = this.getPlayer(p.address);
          pl.balance = parseFloat((pl.balance + p.amount).toFixed(3));
          pl.activeDogpileSide = null;
        }
      }
      this.pushFeed('dogpile', 'SYSTEM', 'Dogpile refunded — need both sides');
      this.dogpile = this.newDogpilePot();
      this.emit();
      return;
    }

    this.dogpile.status = 'flipping';
    this.dogpile.flipStartedAt = Date.now();
    this.emit();

    setTimeout(() => {
      const pot = this.dogpile;
      if (!pot.serverSeed) return;
      const { side } = computeFlipResult({
        serverSeed: pot.serverSeed,
        clientSeed: pot.clientSeed,
        nonce: pot.nonce,
      });
      pot.result = side;
      pot.status = 'done';

      const winners = side === 'heads' ? pot.heads : pot.tails;
      const winTotal = side === 'heads' ? pot.headsTotal : pot.tailsTotal;
      const totalPot = pot.headsTotal + pot.tailsTotal;
      const rakeRate = this.rakeForPot([...pot.heads, ...pot.tails]);
      const distributable = totalPot * (1 - rakeRate);
      const rake = parseFloat((totalPot * rakeRate).toFixed(3));

      for (const w of winners) {
        if (w.address === BOT_NAME) continue;
        const share = (w.amount / winTotal) * distributable;
        const profit = share - w.amount;
        const pl = this.getPlayer(w.address);
        pl.balance = parseFloat((pl.balance + share).toFixed(3));
        pl.winStreak += 1;
        pl.lossStreak = 0;
        pl.activeDogpileSide = null;
        pl.lastResult = { won: true, profit, side, result: side };
        if (profit >= FLIP_CONFIG.HOF_MIN_PROFIT) {
          this.pushFeed('win', w.display, `DOGPILE +${profit.toFixed(2)} BlackBalls`, profit, true);
        }
      }
      const losers = side === 'heads' ? pot.tails : pot.heads;
      for (const l of losers) {
        if (l.address === BOT_NAME) continue;
        const pl = this.getPlayer(l.address);
        pl.winStreak = 0;
        pl.lossStreak += 1;
        pl.activeDogpileSide = null;
        pl.lastResult = { won: false, profit: -l.amount, side: opposite(side), result: side };
      }

      const topProfit = winners.length > 0 ? (winners[0].amount / winTotal) * distributable - winners[0].amount : 0;
      this.recordHistory({
        id: pot.id,
        mode: 'dogpile',
        result: side,
        totalPot,
        rake,
        winnerDisplay: `${winners.length} on ${side}`,
        profit: topProfit,
        wager: pot.headsTotal + pot.tailsTotal,
        ts: Date.now(),
        serverSeedHash: pot.serverSeedHash,
        serverSeed: pot.serverSeed,
        clientSeed: pot.clientSeed,
        nonce: pot.nonce,
        highlight: totalPot >= 100,
      });

      this.pushFeed('flip', 'SYSTEM', `DOGPILE ${side.toUpperCase()} — ${totalPot.toFixed(1)} BlackBalls pot`, totalPot, totalPot >= 100);

      setTimeout(() => {
        this.dogpile = this.newDogpilePot();
        this.emit();
      }, 4000);
      this.emit();
    }, FLIP_CONFIG.FLIP_ANIM_MS + 200);
  }

  revenge(address: string, wager?: number): { ok: boolean; error?: string; matchId?: string } {
    const player = this.getPlayer(address);
    if (!player.lastOpponent || player.lastOpponent === BOT_NAME) {
      return { ok: false, error: 'no recent opponent' };
    }
    const side: FlipSide = Math.random() < 0.5 ? 'heads' : 'tails';
    const amount = wager ?? FLIP_CONFIG.MIN_BET * 10;
    this.pushFeed('taunt', shortAddr(address), `REVENGE vs ${shortAddr(player.lastOpponent)}`);
    return this.createOrJoin1v1(address, side, amount, 'REVENGE MODE 😈');
  }

  cancel1v1(address: string): { ok: boolean; error?: string } {
    const player = this.getPlayer(address);
    const match =
      this.open1v1.find(m => m.creator.address === address && m.status === 'waiting') ??
      (player.active1v1Id
        ? this.open1v1.find(m => m.id === player.active1v1Id && m.status === 'waiting')
        : undefined);

    if (!match) {
      if (player.active1v1Id) {
        player.active1v1Id = null;
        this.emit();
        return { ok: true };
      }
      return { ok: false, error: 'no open match' };
    }

    this.cancel1v1Internal(address, match);
    this.emit();
    return { ok: true };
  }

  private tick() {
    if (this.dogpile.status === 'waiting' || this.dogpile.status === 'idle') {
      if (this.dogpile.heads.length + this.dogpile.tails.length > 0 && Date.now() >= this.dogpile.endsAt) {
        this.resolveDogpile();
      }
    }
    this.emit();
  }

  snapshot(address: string | null): FlipFullState {
    const player = address ? this.getPlayer(address) : null;
    const hallOfFame = this.history.filter(h => h.highlight).slice(0, 10);

    const playerView: FlipPlayerView | null = player
      ? {
          balance: player.balance,
          holdsBlackballs: player.holdsBlackballs,
          rakeRate: flipRakeRate(player.holdsBlackballs),
          maxBet: flipMaxBet(player.holdsBlackballs),
          winStreak: player.winStreak,
          lossStreak: player.lossStreak,
          lastOpponent: player.lastOpponent,
          active1v1Id: player.active1v1Id,
          activeDogpileSide: player.activeDogpileSide,
          lastResult: player.lastResult,
        }
      : null;

    return {
      mode: '1v1',
      open1v1: [...this.open1v1],
      active1v1: this.active1v1 ? { ...this.active1v1 } : null,
      dogpile: { ...this.dogpile, heads: [...this.dogpile.heads], tails: [...this.dogpile.tails] },
      history: [...this.history],
      feed: [...this.feed],
      hallOfFame,
      player: playerView,
    };
  }

  getFullState(address: string | null = null): FlipFullState {
    return this.snapshot(address);
  }

  exportEngineSnapshot() {
    return {
      matchId: this.matchId,
      open1v1: this.open1v1.map(m => ({ ...m, creator: { ...m.creator }, opponent: m.opponent ? { ...m.opponent } : undefined })),
      active1v1: this.active1v1 ? { ...this.active1v1, creator: { ...this.active1v1.creator }, opponent: this.active1v1.opponent ? { ...this.active1v1.opponent } : undefined } : null,
    };
  }

  applyEngineSnapshot(snap: {
    matchId: number;
    open1v1: Flip1v1Match[];
    active1v1: Flip1v1Match | null;
  }) {
    this.matchId = Math.max(this.matchId, snap.matchId);
    this.open1v1 = snap.open1v1.filter(m => m.status === 'waiting');
    for (const m of snap.open1v1) {
      if (m.status === 'flipping' || m.status === 'done') {
        this.pending1v1.set(m.id, m);
      }
    }
    if (snap.active1v1) {
      this.active1v1 = snap.active1v1;
      this.pending1v1.set(snap.active1v1.id, snap.active1v1);
    }
  }

  exportPlayerSnapshot(address: string) {
    const p = this.players.get(address);
    if (!p) return null;
    return {
      balance: p.balance,
      holdsBlackballs: p.holdsBlackballs,
      active1v1Id: p.active1v1Id,
      activeDogpileSide: p.activeDogpileSide,
      winStreak: p.winStreak,
      lossStreak: p.lossStreak,
      lastOpponent: p.lastOpponent,
    };
  }

  importPlayerSnapshot(
    address: string,
    row: {
      balance: number;
      holdsBlackballs: boolean;
      active1v1Id: string | null;
      activeDogpileSide: FlipSide | null;
      winStreak: number;
      lossStreak: number;
      lastOpponent: string | null;
    },
  ) {
    const p = this.getPlayer(address);
    const locked = this.lockedWagerForPlayer(address);
    if (locked <= 0) {
      p.balance = row.balance;
    }
    p.holdsBlackballs = row.holdsBlackballs;
    if (!p.active1v1Id && row.active1v1Id) {
      p.active1v1Id = row.active1v1Id;
    }
    p.winStreak = row.winStreak;
    p.lossStreak = row.lossStreak;
    p.lastOpponent = row.lastOpponent;
    p.activeDogpileSide = row.activeDogpileSide;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __blackballsFlipManager: FlipManager | undefined;
}

export function getFlipManager(): FlipManager {
  if (!globalThis.__blackballsFlipManager) {
    globalThis.__blackballsFlipManager = new FlipManager();
  }
  return globalThis.__blackballsFlipManager;
}
