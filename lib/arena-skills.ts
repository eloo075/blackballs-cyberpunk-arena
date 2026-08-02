/** Arena manual combat skills — simple cooldown / energy system. */

export type ArenaSkillId =
  | 'heavy_strike'
  | 'defensive_stance'
  | 'quick_heal'
  | 'crit_boost'
  | 'stun'
  | 'life_steal';

export interface ArenaSkill {
  id: ArenaSkillId;
  label: string;
  emoji: string;
  description: string;
  cooldown: number;
  energy: number;
}

export const ARENA_SKILLS: ArenaSkill[] = [
  { id: 'heavy_strike', label: 'Heavy Strike', emoji: '💥', description: '2× damage hit', cooldown: 2, energy: 2 },
  { id: 'defensive_stance', label: 'Defensive Stance', emoji: '🛡️', description: 'Block 60% next hit', cooldown: 2, energy: 1 },
  { id: 'quick_heal', label: 'Quick Heal', emoji: '💚', description: 'Restore 12% HP', cooldown: 3, energy: 2 },
  { id: 'crit_boost', label: 'Crit Boost', emoji: '⚡', description: 'Guaranteed crit', cooldown: 3, energy: 2 },
  { id: 'stun', label: 'Stun', emoji: '💫', description: 'Skip opponent turn', cooldown: 4, energy: 3 },
  { id: 'life_steal', label: 'Life Steal', emoji: '🩸', description: 'Damage + heal 50%', cooldown: 3, energy: 2 },
];

export const MAX_ARENA_ENERGY = 5;
export const ENERGY_REGEN_PER_TURN = 1;

export interface SkillRuntimeState {
  cooldowns: Partial<Record<ArenaSkillId, number>>;
  energy: number;
  blocking: boolean;
}

export function defaultSkillState(): SkillRuntimeState {
  return { cooldowns: {}, energy: MAX_ARENA_ENERGY, blocking: false };
}

export function canUseSkill(state: SkillRuntimeState, skill: ArenaSkill): boolean {
  const cd = state.cooldowns[skill.id] ?? 0;
  return cd <= 0 && state.energy >= skill.energy;
}

export interface SkillOutcome {
  playerDamage: number;
  opponentDamage: number;
  healPlayer: number;
  skipOpponent: boolean;
  log: string;
  crit: boolean;
}

export function resolveSkill(
  skillId: ArenaSkillId,
  playerAtk: number,
  playerMaxHp: number,
  playerHp: number,
  bonuses: { stimmy: number },
): SkillOutcome {
  const stimmyMult = 1 + bonuses.stimmy;
  switch (skillId) {
    case 'heavy_strike':
      return {
        playerDamage: Math.floor(playerAtk * 2 * stimmyMult),
        opponentDamage: 0,
        healPlayer: 0,
        skipOpponent: false,
        log: '💥 HEAVY STRIKE — earth-shaking bonk!',
        crit: false,
      };
    case 'defensive_stance':
      return {
        playerDamage: 0,
        opponentDamage: 0,
        healPlayer: 0,
        skipOpponent: false,
        log: '🛡️ DEFENSIVE STANCE — hands up, cope down.',
        crit: false,
      };
    case 'quick_heal': {
      const heal = Math.floor(playerMaxHp * 0.12);
      return {
        playerDamage: 0,
        opponentDamage: 0,
        healPlayer: heal,
        skipOpponent: false,
        log: `💚 QUICK HEAL +${heal} HP`,
        crit: false,
      };
    }
    case 'crit_boost':
      return {
        playerDamage: Math.floor(playerAtk * 1.6 * stimmyMult),
        opponentDamage: 0,
        healPlayer: 0,
        skipOpponent: false,
        log: '⚡ CRIT BOOST — critical hit guaranteed!',
        crit: true,
      };
    case 'stun':
      return {
        playerDamage: Math.floor(playerAtk * 0.5 * stimmyMult),
        opponentDamage: 0,
        healPlayer: 0,
        skipOpponent: true,
        log: '💫 STUN — opponent frozen in disbelief!',
        crit: false,
      };
    case 'life_steal': {
      const dmg = Math.floor(playerAtk * 1.1 * stimmyMult);
      return {
        playerDamage: dmg,
        opponentDamage: 0,
        healPlayer: Math.floor(dmg * 0.5),
        skipOpponent: false,
        log: '🩸 LIFE STEAL — damage AND vibes restored.',
        crit: false,
      };
    }
    default:
      return {
        playerDamage: Math.floor(playerAtk * 0.8),
        opponentDamage: 0,
        healPlayer: 0,
        skipOpponent: false,
        log: 'Basic attack',
        crit: false,
      };
  }
}

export function applySkillUse(state: SkillRuntimeState, skill: ArenaSkill): SkillRuntimeState {
  return {
    ...state,
    energy: state.energy - skill.energy,
    blocking: skill.id === 'defensive_stance',
    cooldowns: { ...state.cooldowns, [skill.id]: skill.cooldown },
  };
}

export function tickSkillCooldowns(state: SkillRuntimeState): SkillRuntimeState {
  const cooldowns: Partial<Record<ArenaSkillId, number>> = {};
  for (const [id, cd] of Object.entries(state.cooldowns)) {
    const next = (cd ?? 0) - 1;
    if (next > 0) cooldowns[id as ArenaSkillId] = next;
  }
  return {
    ...state,
    cooldowns,
    energy: Math.min(MAX_ARENA_ENERGY, state.energy + ENERGY_REGEN_PER_TURN),
    blocking: false,
  };
}
