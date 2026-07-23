import type { Fighter } from '@/lib/fighters';

export type SfxId =
  | 'airhorn'
  | 'boom'
  | 'whoosh'
  | 'glass'
  | 'cash'
  | 'bonk'
  | 'crowd'
  | 'dramatic'
  | 'cricket';

export const SFX_LABEL: Record<SfxId, string> = {
  airhorn: 'AIRHORN',
  boom: 'BOOM',
  whoosh: 'WHOOSH',
  glass: 'GLASS_BREAK',
  cash: 'CASH_REGISTER',
  bonk: 'BONK',
  crowd: 'CROWD_GASP',
  dramatic: 'DRAMATIC_STING',
  cricket: 'CRICKETS',
};

export function sfxLine(id: SfxId): string {
  return `[🔊 ${SFX_LABEL[id]}]`;
}

const ENTRANCE_LINES = [
  (p: Fighter, o: Fighter) => `🎙️ ANNOUNCER: "IN THIS CORNER… ${p.name.toUpperCase()} — ${p.title}!"`,
  (p: Fighter, o: Fighter) => `🎙️ AND OPPOSING… ${o.name.toUpperCase()} — "${o.title}"!`,
  () => `🎙️ "TWO DEGENS ENTER. ONE WALLET LEAVES."`,
  () => `🎙️ "FIGHTERS… DEGEN… FIGHT!"`,
];

const ATTACK_LINES = [
  (name: string, dmg: number) => `${name} throws a chart candle for ${dmg} damage!`,
  (name: string, dmg: number) => `${name} hits a leverage uppercut — ${dmg} HP evaporated!`,
  (name: string, dmg: number) => `${name} spam-buys aggression: ${dmg} damage!`,
  (name: string, dmg: number) => `${name} deploys pure copium — ${dmg} damage dealt!`,
  (name: string, dmg: number) => `${name} whips out a neon katana — ${dmg} damage!`,
];

const CRIT_LINES = [
  (name: string, dmg: number) => `💥 ${name} LANDS A CRITICAL — ${dmg} DAMAGE! THE CROWD LOSES IT!`,
  (name: string, dmg: number) => `💥 ${name} CRITS FOR ${dmg}! SOMEONE JUST SOLD THEIR HOUSE!`,
  (name: string, dmg: number) => `💥 ${name} — ${dmg} CRITICAL! BEAUTIFUL. UNETHICAL. LEGAL.`,
];

const DODGE_LINES = [
  (name: string) => `${name} dodges like taxes — clean miss!`,
  (name: string) => `${name} sidesteps faster than a rug pull announcement!`,
  (name: string) => `${name} matrix-dodges. Opponent whiffs into the void.`,
];

const LOW_HP_LINES = [
  (name: string) => `⚠️ ${name} is ONE BAD TRADE from liquidation!`,
  (name: string) => `🩸 ${name} bleeding out — apply stimmy or perish!`,
];

const WIN_LINES = [
  (name: string) => `🏆 ${name} WINS! Chat screams WAGMI!`,
  (name: string) => `🏆 ${name} VICTORIOUS! Opponent rugged emotionally!`,
  (name: string) => `🏆 ${name} takes the belt! Arena goes absolutely feral!`,
];

const LOSE_LINES = [
  (name: string) => `💀 ${name} got rekt! "It's just a demo wallet" they said.`,
  (name: string) => `💀 ${name} folded harder than a 1x round!`,
];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function entranceScript(player: Fighter, opponent: Fighter): string[] {
  return ENTRANCE_LINES.map(fn => fn(player, opponent));
}

export function attackLine(name: string, dmg: number): string {
  return pick(ATTACK_LINES)(name, dmg);
}

export function critLine(name: string, dmg: number): string {
  return pick(CRIT_LINES)(name, dmg);
}

export function dodgeLine(name: string): string {
  return pick(DODGE_LINES)(name);
}

export function lowHpLine(name: string): string {
  return pick(LOW_HP_LINES)(name);
}

export function winLine(name: string): string {
  return pick(WIN_LINES)(name);
}

export function loseLine(name: string): string {
  return pick(LOSE_LINES)(name);
}
