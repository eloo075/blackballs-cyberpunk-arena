'use client';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FIGHTERS, RARITY_COLOR, type Fighter } from '@/lib/fighters';
import { applyStimmyDamage, computeBattleLoot, type HoldBonuses } from '@/lib/hold-bonuses';
import {
  computeBattlePlayerXp,
  computeFighterCoins,
} from '@/lib/arena-rewards';
import {
  BOSS_OPPONENT_LEVEL,
  BOSS_REWARD_MULTIPLIER,
  BOSS_RETRY_COST,
  FREE_BOSS_ATTEMPTS,
  getDailyBossFighter,
  isUpset,
} from '@/lib/competitive';
import { toBattleFighter, type BattleFighter } from '@/lib/effective-fighter';
import { FighterArt } from '@/components/fighter-art';
import { FighterSelection } from '@/components/FighterSelection';
import { HoldBonusBar } from '@/components/hold-bonus-bar';
import { WinStreakBanner } from '@/components/win-streak-banner';
import { BossFightCard } from '@/components/boss-fight-card';
import { DailyChallengesPanel } from '@/components/daily-challenges-panel';
import { ArenaWagerBar } from '@/components/arena-wager-bar';
import { PlayerXpCounter } from '@/components/player-xp-counter';
import { useFighterProgress } from '@/hooks/use-fighter-progress';
import { useFighterUnlocks } from '@/hooks/use-fighter-unlocks';
import { useCompetitive } from '@/hooks/use-competitive';
import { useWallet } from '@/lib/wallet-context';
import { useMarketListings } from '@/hooks/use-market-listings';
import {
  attackLine,
  critLine,
  dodgeLine,
  entranceScript,
  loseLine,
  lowHpLine,
  sfxLine,
  winLine,
} from '@/lib/battle-flavor';

import { formatPrice, generatePlaceholderLogo } from '@/lib/market-types';

type BattleStage = 'ready' | 'entrance' | 'combat' | 'done';
type BattleEffect = 'shake' | 'flash' | 'critical' | 'entrance' | 'dodge' | 'ko' | null;

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="h-2 bg-black/50 border border-white/10 overflow-hidden mt-1">
      <motion.div
        className="h-full"
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.35 }}
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
    </div>
  );
}

export function ArenaView() {
  const { wallet, holdBonuses, adjustBlackballsBalance, addArenaXp, recordArenaResult } = useWallet();
  const { blackballsBalance } = useFighterUnlocks();
  const { getProgress, addBattleReward } = useFighterProgress();
  const { streakMultiplier, recordArenaBattle, state: compState, recordBossAttempt } = useCompetitive();
  const [arenaWager, setArenaWager] = useState(0);
  const [isBossBattle, setIsBossBattle] = useState(false);
  const battleMetaRef = useRef({ isBoss: false, wager: 0 });
  const [playerFighter, setPlayerFighter] = useState<BattleFighter | null>(null);
  const [opponentFighter, setOpponentFighter] = useState<BattleFighter | null>(null);
  const [inBattle, setInBattle] = useState(false);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [battleEffect, setBattleEffect] = useState<BattleEffect>(null);
  const [battleStage, setBattleStage] = useState<BattleStage>('ready');
  const [livePlayerHp, setLivePlayerHp] = useState(0);
  const [liveOpponentHp, setLiveOpponentHp] = useState(0);
  const [winner, setWinner] = useState<BattleFighter | null>(null);
  const { listings: marketListings, loading: marketLoading } = useMarketListings();
  const trending = [...FIGHTERS].sort((a, b) => b.activity - a.activity).slice(0, 3);
  const trendingMarket = marketListings
    .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))
    .slice(0, 3);

  const handleSelectFighter = (fighter: Fighter) => {
    const battleFighter = toBattleFighter(fighter, getProgress(fighter.id).level);
    setPlayerFighter(battleFighter);
    setIsBossBattle(false);
    const opponents = FIGHTERS.filter(f => f.id !== fighter.id);
    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    const opponentBattle = toBattleFighter(randomOpponent, 1 + Math.floor(Math.random() * 3));
    setOpponentFighter(opponentBattle);
    setInBattle(true);
    setBattleStage('ready');
    setLivePlayerHp(battleFighter.hp);
    setLiveOpponentHp(opponentBattle.hp);
    setBattleLog([`${battleFighter.name} vs ${randomOpponent.name} — touch grass? NO. TOUCH FISTS.`]);
  };

  const appendLog = (lines: string[]) => {
    setBattleLog(prev => [...prev, ...lines]);
  };

  const triggerEffect = (effect: NonNullable<BattleEffect>, ms = 350) => {
    setBattleEffect(effect);
    setTimeout(() => setBattleEffect(null), ms);
  };

  const runEntrance = (player: BattleFighter, opponent: BattleFighter) => {
    setBattleStage('entrance');
    triggerEffect('entrance', 1200);
    const script = entranceScript(player, opponent);
    appendLog([sfxLine('dramatic'), sfxLine('crowd'), ...script]);
    setTimeout(() => {
      appendLog([sfxLine('airhorn'), `⚡ ${player.name} slides in with main-character energy!`]);
    }, 900);
    setTimeout(() => {
      appendLog([sfxLine('whoosh'), `⚡ ${opponent.name} enters like they own the liquidity pool!`]);
    }, 1800);
    setTimeout(() => simulateBattle(player, opponent, holdBonuses), 2800);
  };

  const startBattle = () => {
    if (!playerFighter || !opponentFighter) return;
    if (arenaWager > 0) adjustBlackballsBalance(-arenaWager);
    battleMetaRef.current = { isBoss: isBossBattle, wager: arenaWager };
    setWinner(null);
    setLivePlayerHp(playerFighter.hp);
    setLiveOpponentHp(opponentFighter.hp);
    runEntrance(playerFighter, opponentFighter);
  };

  const handleBossChallenge = () => {
    if (!playerFighter) return;
    if (compState.bossAttemptsToday >= FREE_BOSS_ATTEMPTS) {
      if (blackballsBalance < BOSS_RETRY_COST) return;
      adjustBlackballsBalance(-BOSS_RETRY_COST);
    }
    recordBossAttempt();
    const boss = getDailyBossFighter();
    const opponentBattle = toBattleFighter(boss, BOSS_OPPONENT_LEVEL);
    setIsBossBattle(true);
    setOpponentFighter(opponentBattle);
    setInBattle(true);
    setBattleStage('ready');
    setLivePlayerHp(playerFighter.hp);
    setLiveOpponentHp(opponentBattle.hp);
    setBattleLog([`⚠ BOSS FIGHT — ${playerFighter.name} vs ${boss.name}! ${BOSS_REWARD_MULTIPLIER}x REWARDS`]);
  };

  const grantBattleRewards = (
    playerWon: boolean,
    player: BattleFighter,
    opponent: BattleFighter,
    bonuses: HoldBonuses,
  ) => {
    const meta = battleMetaRef.current;
    let xpGain = computeBattlePlayerXp(playerWon, opponent.power);
    if (playerWon && isUpset(player.power, opponent.power)) {
      xpGain = Math.floor(xpGain * 1.5);
    }
    if (playerWon) {
      xpGain = Math.floor(xpGain * streakMultiplier);
      if (meta.isBoss) xpGain = Math.floor(xpGain * BOSS_REWARD_MULTIPLIER);
    }
    addArenaXp(xpGain);
    recordArenaResult(playerWon);

    const compLogs = recordArenaBattle({
      won: playerWon,
      playerPower: player.power,
      opponentPower: opponent.power,
      opponentId: opponent.id,
      isBoss: meta.isBoss,
    });

    let loot = 0;
    if (playerWon) {
      const baseLoot = 5 + Math.floor(Math.random() * 15);
      loot = computeBattleLoot(baseLoot, bonuses);
      loot = Math.floor(loot * streakMultiplier * (meta.isBoss ? BOSS_REWARD_MULTIPLIER : 1));
      adjustBlackballsBalance(loot);
      if (meta.wager > 0) adjustBlackballsBalance(meta.wager * 2);
    }

    let fighterCoins = computeFighterCoins(playerWon, opponent.power, loot);
    if (playerWon) {
      fighterCoins = Math.floor(fighterCoins * streakMultiplier * (meta.isBoss ? BOSS_REWARD_MULTIPLIER : 1));
    }
    addBattleReward(player.id, fighterCoins, playerWon);

    return { xpGain, loot, fighterCoins, compLogs, wagerWon: playerWon ? meta.wager * 2 : 0 };
  };

  const simulateBattle = (player: BattleFighter, opponent: BattleFighter, bonuses: HoldBonuses) => {
    setBattleStage('combat');
    const logs: string[] = [];
    let playerHP = player.hp;
    let opponentHP = opponent.hp;
    setLivePlayerHp(playerHP);
    setLiveOpponentHp(opponentHP);
    let round = 0;
    let battleStarted = false;
    const critChance = 0.2 + bonuses.critChanceBonus;

    const pushLogs = (lines: string[]) => {
      logs.push(...lines);
      setBattleLog(prev => [...prev, ...lines]);
    };

    const finishWin = (winnerFighter: BattleFighter, playerWon: boolean) => {
      triggerEffect('ko', 600);
      pushLogs([sfxLine('cash'), winLine(winnerFighter.name)]);
      if (playerWon) {
        const { xpGain, loot, fighterCoins, compLogs, wagerWon } = grantBattleRewards(true, player, opponent, bonuses);
        pushLogs([
          ...compLogs,
          bonuses.stimmy > 0
            ? `💰 LOOT +${loot.toFixed(1)} $BlackBalls (Stimmy +${Math.round(bonuses.stimmy * 100)}%)`
            : `💰 LOOT +${loot.toFixed(1)} $BlackBalls`,
          wagerWon > 0 ? `🎲 WAGER WON +${wagerWon} $BlackBalls` : '',
          `⭐ +${xpGain} XP · 🪙 +${fighterCoins} fight coins for ${player.name}`,
        ].filter(Boolean));
      }
      setBattleStage('done');
      setWinner(winnerFighter);
    };

    pushLogs([
      `⚔️ COMBAT LIVE — ${player.name} vs ${opponent.name}!`,
      ...(bonuses.active.length > 0
        ? [`⚡ HOLD BONUSES: ${bonuses.active.map(b => b.label).join(' · ')}`]
        : []),
    ]);

    const battleInterval = setInterval(() => {
      round++;

      if (!battleStarted) {
        battleStarted = true;
        pushLogs([sfxLine('whoosh'), `💥 ${player.name} cracks knuckles menacingly…`]);
        setTimeout(() => pushLogs([`⚡ ${opponent.name} whispers "watch the wick."`]), 700);
        return;
      }

      if (Math.random() < 0.12) {
        pushLogs([sfxLine('cricket'), dodgeLine(opponent.name)]);
        triggerEffect('dodge');
        return;
      }

      const criticalHit = Math.random() < critChance;
      const rawDamage = Math.floor(player.atk * (criticalHit ? 1.5 : 0.8 + Math.random() * 0.4));
      const playerDamage = applyStimmyDamage(rawDamage, bonuses);
      opponentHP -= playerDamage;
      setLiveOpponentHp(Math.max(0, opponentHP));

      if (criticalHit) {
        triggerEffect('critical');
        pushLogs([sfxLine('boom'), critLine(player.name, playerDamage)]);
      } else {
        triggerEffect('shake');
        pushLogs([attackLine(player.name, playerDamage)]);
      }

      if (bonuses.frenzy > 0 && Math.random() < bonuses.frenzy) {
        const frenzyDmg = applyStimmyDamage(Math.floor(player.atk * 0.55), bonuses);
        opponentHP -= frenzyDmg;
        setLiveOpponentHp(Math.max(0, opponentHP));
        triggerEffect('critical');
        pushLogs([sfxLine('airhorn'), `🔥 FRENZY PROC! ${player.name} bonks +${frenzyDmg} extra damage!`]);
      }

      if (opponentHP <= 0) {
        finishWin(player, true);
        clearInterval(battleInterval);
        return;
      }

      if (opponentHP / opponent.hp < 0.25 && Math.random() < 0.4) {
        pushLogs([lowHpLine(opponent.name)]);
      }

      setTimeout(() => {
        if (Math.random() < 0.1) {
          pushLogs([sfxLine('cricket'), dodgeLine(player.name)]);
          triggerEffect('dodge');
          return;
        }

        const opponentCrit = Math.random() < 0.15;
        const opponentDamage = Math.floor(opponent.atk * (opponentCrit ? 1.5 : 0.8 + Math.random() * 0.4));
        playerHP -= opponentDamage;
        setLivePlayerHp(Math.max(0, playerHP));

        if (opponentCrit) {
          triggerEffect('critical');
          pushLogs([sfxLine('glass'), critLine(opponent.name, opponentDamage)]);
        } else {
          triggerEffect('shake');
          pushLogs([attackLine(opponent.name, opponentDamage)]);
        }

        if (playerHP <= 0) {
          triggerEffect('ko', 600);
          pushLogs([sfxLine('bonk'), loseLine(player.name), `🏆 ${opponent.name} WINS THE ARENA!`]);
          const { xpGain, fighterCoins, compLogs } = grantBattleRewards(false, player, opponent, bonuses);
          pushLogs([...compLogs, `⭐ +${xpGain} XP (participation) · 🪙 +${fighterCoins} fight coins`]);
          setBattleStage('done');
          setWinner(opponent);
          clearInterval(battleInterval);
          return;
        }

        if (playerHP / player.hp < 0.25 && Math.random() < 0.4) {
          pushLogs([lowHpLine(player.name)]);
        }

        if (round >= 10) {
          const battleWinner = playerHP > opponentHP ? player : opponent;
          const playerWon = battleWinner.id === player.id;
          if (playerWon) {
            finishWin(player, true);
          } else {
            triggerEffect('flash');
            pushLogs([`⏱️ TIME'S UP! ${battleWinner.name} wins on HP — barely legal!`]);
            const { xpGain, fighterCoins, compLogs } = grantBattleRewards(false, player, opponent, bonuses);
            pushLogs([...compLogs, `⭐ +${xpGain} XP · 🪙 +${fighterCoins} fight coins`]);
            setBattleStage('done');
            setWinner(battleWinner);
          }
          clearInterval(battleInterval);
        }
      }, 650);
    }, 2200);
  };

  const handleEndBattle = () => {
    setInBattle(false);
    setIsBossBattle(false);
    setArenaWager(0);
    setOpponentFighter(null);
    setBattleLog([]);
    setWinner(null);
    setBattleStage('ready');
    setLivePlayerHp(0);
    setLiveOpponentHp(0);
  };

  return (
    <div className="p-3 max-w-[1700px] mx-auto w-full font-mono">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-black tracking-[0.15em] neon-cyan" style={{ fontFamily: 'Orbitron, sans-serif' }}>ARENA</h2>
          <p className="text-[10px] text-white/40 mt-0.5">// BROWSE_FIGHTERS · {FIGHTERS.length}_UNITS · WIN XP TO CLIMB RANKING</p>
          <p className="text-[10px] text-white/30 mt-1">// 2 WEAKEST FREE · STRONGER = MORE $BLACKBALLS · LEVEL UP WITH FIGHT COINS</p>
        </div>
        <div className="flex items-center gap-1.5">
          {Object.entries(RARITY_COLOR).map(([r, c]) => <span key={r} className="px-1.5 py-0.5 text-[8px] font-black border" style={{ color: c, borderColor: c + '55' }}>{r}</span>)}
        </div>
      </div>

      <HoldBonusBar active={holdBonuses.active} className="mb-3" />
      <PlayerXpCounter className="mb-3" />
      <WinStreakBanner />
      <BossFightCard onChallengeBoss={handleBossChallenge} disabled={!playerFighter || inBattle} />
      {playerFighter && !inBattle && (
        <div className="mb-4 cp-panel p-3 hud-corners" style={{ borderColor: RARITY_COLOR[playerFighter.rarity] + '44' }}>
          <div className="flex items-center gap-3">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">YOUR_FIGHTER</div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: `radial-gradient(circle, ${playerFighter.color}33, transparent 70%)` }}>
                <FighterArt fighterId={playerFighter.id} size={38} glowColor={playerFighter.glowColor} />
              </div>
              <div className="text-sm font-black" style={{ color: playerFighter.color, fontFamily: 'Orbitron, sans-serif' }}>{playerFighter.name}</div>
              <div className="text-[9px] text-cp-yellow">LVL {playerFighter.level} · PWR {playerFighter.power}</div>
            </div>
            <button onClick={() => setPlayerFighter(null)} className="ml-auto text-[9px] text-cp-magenta hover:text-cp-magenta/80 font-mono">[CHANGE]</button>
          </div>
        </div>
      )}

      {/* battle view */}
      <AnimatePresence>
        {inBattle && playerFighter && opponentFighter && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: battleEffect === 'shake' ? [0, -5, 5, -5, 5, 0] : 0,
              backgroundColor: battleEffect === 'flash' ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0)'] : 'transparent'
            }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            transition={{ duration: 0.3 }}
            className="mb-4 cp-panel p-4 hud-corners relative overflow-hidden" 
            style={{ borderColor: '#9d00ff44' }}
          >
            {/* Critical hit overlay */}
            {battleEffect === 'critical' && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: [0, 0.8, 0] }} 
                className="absolute inset-0 bg-red-500/30 pointer-events-none z-20"
                transition={{ duration: 0.3 }}
              />
            )}
            {battleEffect === 'entrance' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                className="absolute inset-0 bg-cp-cyan/20 pointer-events-none z-20"
                transition={{ duration: 1.2 }}
              />
            )}
            {battleEffect === 'dodge' && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 0.4 }}
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-20 skew-x-12"
              />
            )}
            {battleEffect === 'ko' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.5, 2], opacity: [1, 0.8, 0] }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              >
                <span className="text-6xl font-black text-cp-magenta" style={{ fontFamily: 'Orbitron, sans-serif' }}>KO!</span>
              </motion.div>
            )}

            {battleStage === 'ready' && (
              <motion.div
                initial={{ opacity: 0, scale: 1.2 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center z-10 bg-black/60 backdrop-blur-sm"
              >
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="text-5xl font-black neon-magenta mb-2"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    VS
                  </motion.div>
                  <div className="text-sm text-white/70">
                    {playerFighter.name} <span className="text-cp-magenta">vs</span> {opponentFighter.name}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] neon-magenta">BATTLE_ARENA</div>
              <button onClick={handleEndBattle} className="text-[9px] text-cp-magenta hover:text-cp-magenta/80 font-mono">[EXIT_BATTLE]</button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              {/* player fighter */}
              <div className="text-center">
                <motion.div 
                  animate={winner?.id === playerFighter.id ? {
                    scale: [1, 1.2, 1],
                    rotate: [0, 360, 0],
                    boxShadow: [`0 0 0px ${playerFighter.color}`, `0 0 30px ${playerFighter.color}`, `0 0 0px ${playerFighter.color}`]
                  } : {}}
                  transition={{ duration: 1.5, repeat: winner?.id === playerFighter.id ? Infinity : 0 }}
                  className="w-24 h-24 mx-auto flex items-center justify-center rounded-full" 
                  style={{ background: `radial-gradient(circle, ${playerFighter.color}33, transparent 70%)` }}
                >
                  <FighterArt fighterId={playerFighter.id} size={92} glowColor={playerFighter.glowColor} />
                </motion.div>
                <div className="mt-2 text-sm font-black" style={{ color: playerFighter.color, fontFamily: 'Orbitron, sans-serif' }}>{playerFighter.name}</div>
                <div className="text-[10px] text-white/50">{playerFighter.title}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
                  <div className="bg-black/40 p-1 border border-cp-cyan/10">
                    <div className="text-white/30">ATK</div>
                    <div className="font-bold" style={{ color: playerFighter.color }}>{playerFighter.atk}</div>
                  </div>
                  <div className="bg-black/40 p-1 border border-cp-cyan/10">
                    <div className="text-white/30">HP</div>
                    <div className="font-bold" style={{ color: playerFighter.color }}>
                      {battleStage === 'combat' || battleStage === 'done'
                        ? `${livePlayerHp}/${playerFighter.hp}`
                        : playerFighter.hp}
                    </div>
                  </div>
                </div>
                {(battleStage === 'combat' || battleStage === 'done') && (
                  <HpBar
                    current={livePlayerHp}
                    max={playerFighter.hp}
                    color={playerFighter.color}
                  />
                )}
              </div>

              {/* opponent fighter */}
              <div className="text-center">
                <motion.div 
                  animate={winner?.id === opponentFighter.id ? {
                    scale: [1, 1.2, 1],
                    rotate: [0, -360, 0],
                    boxShadow: [`0 0 0px ${opponentFighter.color}`, `0 0 30px ${opponentFighter.color}`, `0 0 0px ${opponentFighter.color}`]
                  } : {}}
                  transition={{ duration: 1.5, repeat: winner?.id === opponentFighter.id ? Infinity : 0 }}
                  className="w-24 h-24 mx-auto flex items-center justify-center rounded-full" 
                  style={{ background: `radial-gradient(circle, ${opponentFighter.color}33, transparent 70%)` }}
                >
                  <FighterArt fighterId={opponentFighter.id} size={92} glowColor={opponentFighter.glowColor} />
                </motion.div>
                <div className="mt-2 text-sm font-black" style={{ color: opponentFighter.color, fontFamily: 'Orbitron, sans-serif' }}>{opponentFighter.name}</div>
                <div className="text-[10px] text-white/50">{opponentFighter.title}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
                  <div className="bg-black/40 p-1 border border-cp-cyan/10">
                    <div className="text-white/30">ATK</div>
                    <div className="font-bold" style={{ color: opponentFighter.color }}>{opponentFighter.atk}</div>
                  </div>
                  <div className="bg-black/40 p-1 border border-cp-cyan/10">
                    <div className="text-white/30">HP</div>
                    <div className="font-bold" style={{ color: opponentFighter.color }}>
                      {battleStage === 'combat' || battleStage === 'done'
                        ? `${liveOpponentHp}/${opponentFighter.hp}`
                        : opponentFighter.hp}
                    </div>
                  </div>
                </div>
                {(battleStage === 'combat' || battleStage === 'done') && (
                  <HpBar
                    current={liveOpponentHp}
                    max={opponentFighter.hp}
                    color={opponentFighter.color}
                  />
                )}
              </div>
            </div>

            {/* fight button */}
            {battleStage === 'ready' && (
              <div className="mt-4 text-center relative z-20 space-y-3">
                {!isBossBattle && (
                  <ArenaWagerBar
                    wager={arenaWager}
                    onWagerChange={setArenaWager}
                    balance={blackballsBalance}
                  />
                )}
                <button onClick={startBattle} className="cp-btn touch-target px-8 py-3 font-black text-sm tracking-wider bg-gradient-to-r from-cp-magenta to-cp-purple text-white" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 92% 100%, 0 100%)', boxShadow: '0 0 20px rgba(255,0,60,0.5)' }}>
                  ⚔️ {isBossBattle ? 'FIGHT BOSS' : 'START BATTLE'}
                </button>
              </div>
            )}

            {battleStage === 'entrance' && (
              <div className="mt-3 text-center text-[10px] text-cp-cyan cp-pulse uppercase tracking-widest">
                // Fighters entering the arena…
              </div>
            )}

            {/* victory announcement */}
            <AnimatePresence>
              {winner && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: 50 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        textShadow: [`0 0 0px ${winner.color}`, `0 0 30px ${winner.color}`, `0 0 0px ${winner.color}`]
                      }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-4xl font-black mb-2"
                      style={{ color: winner.color, fontFamily: 'Orbitron, sans-serif' }}
                    >
                      🏆 VICTORY 🏆
                    </motion.div>
                    <div className="text-xl font-bold text-white">{winner.name} WINS!</div>
                    <div className="text-sm text-white/60 mt-2">{winner.title}</div>
                    <button 
                      onClick={handleEndBattle}
                      className="mt-4 px-6 py-2 font-black text-sm bg-gradient-to-r from-cp-green to-cp-cyan text-black"
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 92% 100%, 0 100%)' }}
                    >
                      CONTINUE
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* battle log */}
            <div className="mt-4 p-2 bg-black/40 border border-cp-cyan/10 min-h-[100px] max-h-[160px] overflow-y-auto">
              <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1 sticky top-0 bg-black/80 py-0.5">
                BATTLE_LOG · <span className="text-white/20">SFX placeholders</span>
              </div>
              <div className="space-y-1 text-[10px] text-white/70">
                {battleLog.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={log.includes('[🔊') ? 'text-cp-yellow/70 italic' : ''}
                  >
                    {log}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-3">
        {/* fighter grid */}
        <div className="flex-1">
          <FighterSelection
            selectedFighterId={playerFighter?.id}
            onSelectFighter={handleSelectFighter}
          />
        </div>

        {/* sidebar: daily challenges + trending */}
        <div className="w-full lg:w-[240px] shrink-0 flex flex-col gap-3">
          <DailyChallengesPanel />
          {/* trending meta */}
          <div className="cp-panel overflow-hidden font-arcade">
            <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/5">
              <div className="text-sm font-extrabold text-white/85">Trending Meta</div>
            </div>
            <div className="p-3 space-y-2">
              {trending.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#25262c] border border-white/5">
                  <div className="text-xs font-extrabold text-white/35 w-5">#{i + 1}</div>
                  <div className="w-10 h-10 shrink-0 rounded-xl overflow-hidden border border-white/10" style={{ background: `radial-gradient(circle, ${f.color}44, #2a2c33 70%)` }}>
                    <FighterArt fighterId={f.id} size={40} glowColor={f.glowColor} fill className="w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold truncate text-white">{f.name}</div>
                    <div className="text-[10px] text-amber-300/80 truncate font-bold">{f.buff.label}</div>
                  </div>
                  <div className="text-[10px] font-extrabold text-cyan-400">{f.activity}%</div>
                </div>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-white/5 bg-gradient-to-r from-violet-500/10 to-transparent">
              <div className="text-[11px] font-extrabold text-white/70">Trending Market</div>
            </div>
            <div className="p-3 pt-2 space-y-2">
              {marketLoading ? (
                <div className="text-[10px] text-white/35 font-bold">Loading market…</div>
              ) : trendingMarket.length === 0 ? (
                <div className="text-[10px] text-white/35 font-bold">No market data</div>
              ) : (
                trendingMarket.map((token) => {
                  const up = token.priceChange24h >= 0;
                  const hot = token.priceChange24h >= 10;
                  return (
                    <div key={token.symbol} className="flex items-center gap-2 p-2 rounded-xl bg-[#25262c] border border-white/5">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2a2c33] border border-white/10">
                        <img src={token.logoUrl || generatePlaceholderLogo(token.symbol)} alt={token.symbol} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-extrabold text-white truncate">{token.symbol}</div>
                        <div className="text-[10px] text-white/40 font-bold">{formatPrice(token.price)}</div>
                      </div>
                      <div className={`text-[10px] font-extrabold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {up ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                      </div>
                      {hot && (
                        <div className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          HOT
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* battle log */}
          <div className="cp-panel overflow-hidden flex-1 min-h-[160px] font-arcade">
            <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/5">
              <div className="text-sm font-extrabold text-white/85">Battle Log</div>
            </div>
            <div className="p-3 space-y-1 text-xs text-white/35 min-h-[80px] font-bold">
              {inBattle ? (
                battleLog.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <span className="w-1 h-1 rounded-full bg-cp-cyan mt-1 shrink-0" />
                    <span className="text-white/70">{log}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <span>{playerFighter ? `Ready to battle with ${playerFighter.name}...` : 'Select a fighter to begin battle'}</span>
                  </div>
                  <div className="text-[9px] text-white/20 italic mt-2">// battles_will_appear_here</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
