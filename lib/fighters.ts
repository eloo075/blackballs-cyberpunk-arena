export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface Fighter {
  id: string;
  name: string;
  title: string;
  emoji: string;
  color: string;
  glowColor: string;
  rarity: Rarity;
  atk: number;
  hp: number;
  spd: number;
  luck: number;
  winRate: number;
  lore: string;
  specialty: string;
  badge: string;
  tokenSymbol?: string;
  buff: { label: string; description: string; };
  activity: number; // 0-100, for trending meta
}

export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: '#8a92b2',
  RARE: '#00f0ff',
  EPIC: '#ff003c',
  LEGENDARY: '#fcee0a',
};

export const FIGHTERS: Fighter[] = [
  {
    id: 'ansem',
    name: 'ANSEM',
    title: 'The Bull Whisperer',
    emoji: '🐂',
    color: '#fcee0a',
    glowColor: '#fcee0a',
    rarity: 'LEGENDARY',
    atk: 82, hp: 90, spd: 64, luck: 88,
    winRate: 71.4,
    lore: 'A legendary trader who calls bottoms and tops with eerie precision. HODLs through nuclear winters and emerges richer every cycle. His golden horns pierce bear markets.',
    specialty: 'MARKET_MANIPULATION',
    badge: 'A',
    tokenSymbol: 'ANSEM',
    buff: { label: 'Bull Call +30%', description: 'Calls bottoms with 30% extra damage on green candles' },
    activity: 94,
  },
  {
    id: 'cashcat',
    name: 'CASHCAT',
    title: 'The Suit',
    emoji: '🐱',
    color: '#00ff9c',
    glowColor: '#00ff9c',
    rarity: 'EPIC',
    atk: 74, hp: 78, spd: 80, luck: 72,
    winRate: 66.2,
    lore: 'Wall Street vet turned degen. Plays both sides of every trade and always lands on his feet. Nine lives, nine bags, zero remorse.',
    specialty: 'INSIDER_TRADING',
    badge: 'C',
    tokenSymbol: 'CASHCAT',
    buff: { label: 'Stimmy +25% Fire Power', description: 'Insider knowledge grants 25% bonus attack speed' },
    activity: 88,
  },
  {
    id: 'blackball',
    name: 'BLACKBALL',
    title: 'The Void Orb',
    emoji: '⬛',
    color: '#9d00ff',
    glowColor: '#9d00ff',
    rarity: 'LEGENDARY',
    atk: 95, hp: 70, spd: 72, luck: 90,
    winRate: 73.8,
    lore: 'A sentient singularity born from a liquidity black hole. Devours entire order books and spits out dust. No one has seen its true form and survived.',
    specialty: 'GRAVITY_WELL',
    badge: 'B',
    buff: { label: 'Singularity +40% Pull', description: 'Devours 40% of opponent HP on opening strike' },
    activity: 91,
  },
  {
    id: 'rug_sensei',
    name: 'RUG SENSEI',
    title: 'Master of the Pull',
    emoji: '🥷',
    color: '#ff003c',
    glowColor: '#ff003c',
    rarity: 'EPIC',
    atk: 88, hp: 64, spd: 92, luck: 70,
    winRate: 64.7,
    lore: 'A shadow operator who taught every dev the art of the rug. Strikes from stealth, vanishes before the chart hits zero. Honor among thieves? None.',
    specialty: 'STEALTH_RUG',
    badge: 'R',
    buff: { label: 'Frenzy +20%', description: '20% chance to dodge and counter on every hit' },
    activity: 76,
  },
  {
    id: 'moon_ape',
    name: 'MOON APE',
    title: 'The HODL Primordial',
    emoji: '🦍',
    color: '#00f0ff',
    glowColor: '#00f0ff',
    rarity: 'RARE',
    atk: 78, hp: 95, spd: 50, luck: 76,
    winRate: 59.3,
    lore: 'Diamond-handed primate launched into orbit on a rocket of pure copium. Has never sold, will never sell. BANANA is the only accepted currency.',
    specialty: 'BERSERK_HODL',
    badge: 'M',
    buff: { label: 'Diamond Hands +50% HP', description: 'HODLs through anything — 50% extra HP at low health' },
    activity: 82,
  },
  {
    id: 'degen_lord',
    name: 'DEGEN LORD',
    title: 'Reaper of Bags',
    emoji: '💀',
    color: '#ff6b00',
    glowColor: '#ff6b00',
    rarity: 'EPIC',
    atk: 90, hp: 68, spd: 78, luck: 84,
    winRate: 62.1,
    lore: 'A skeletal sovereign who farms yield in the underworld. His scythe reaps both gains and souls. Every liquidation feeds his power.',
    specialty: 'SOUL_REAP',
    badge: 'D',
    buff: { label: 'Reap +35% Lethal', description: '35% crit chance — every liquidation feeds his power' },
    activity: 79,
  },
  {
    id: 'pepe_war',
    name: 'PEPE WAR',
    title: 'The Green Resistance',
    emoji: '🐸',
    color: '#00ff9c',
    glowColor: '#00ff9c',
    rarity: 'RARE',
    atk: 70, hp: 82, spd: 74, luck: 68,
    winRate: 57.8,
    lore: 'A battle-hardened amphibian who has survived every narrative cycle. Fights for the honor of all memes. His shield is forged from crashed charts.',
    specialty: 'MEME_BASTION',
    badge: 'P',
    buff: { label: 'Shield +30% Block', description: 'Blocks 30% of incoming damage with meme shield' },
    activity: 71,
  },
  {
    id: 'chad_monk',
    name: 'CHAD MONK',
    title: 'The Enlightened One',
    emoji: '🧘',
    color: '#fcee0a',
    glowColor: '#fcee0a',
    rarity: 'RARE',
    atk: 68, hp: 88, spd: 70, luck: 92,
    winRate: 58.5,
    lore: 'A serene ascetic who achieved enlightenment through 100x leverage. His third eye sees every candle before it forms. Patience is his weapon.',
    specialty: 'ZEN_FORESIGHT',
    badge: 'X',
    buff: { label: 'Third Eye +45% Luck', description: 'Sees every candle before it forms — 45% luck boost' },
    activity: 68,
  },
];
