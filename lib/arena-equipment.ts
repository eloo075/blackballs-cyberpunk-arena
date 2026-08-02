/** Simple fighter equipment — Weapon / Armor / Accessory slots. */

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface EquipmentItem {
  id: string;
  slot: EquipmentSlot;
  label: string;
  emoji: string;
  atk?: number;
  hp?: number;
  spd?: number;
  luck?: number;
  effect?: string;
  cost: number;
}

export const SHOP_ITEMS: EquipmentItem[] = [
  { id: 'rusty_knife', slot: 'weapon', label: 'Rusty Knife', emoji: '🔪', atk: 3, cost: 25 },
  { id: 'degen_blade', slot: 'weapon', label: 'Degen Blade', emoji: '⚔️', atk: 8, spd: 2, cost: 80 },
  { id: 'paper_vest', slot: 'armor', label: 'Paper Vest', emoji: '🦺', hp: 15, cost: 30 },
  { id: 'chad_plate', slot: 'armor', label: 'Chad Plate', emoji: '🛡️', hp: 40, atk: 2, cost: 100 },
  { id: 'lucky_charm', slot: 'accessory', label: 'Lucky Charm', emoji: '🍀', luck: 5, cost: 40 },
  { id: 'stimmy_ring', slot: 'accessory', label: 'Stimmy Ring', emoji: '💍', luck: 3, spd: 3, effect: '+5% crit', cost: 75 },
];

export const DROP_TABLE: EquipmentItem[] = [
  { id: 'battle_scrap', slot: 'weapon', label: 'Battle Scrap', emoji: '🔩', atk: 2, cost: 0 },
  { id: 'arena_patch', slot: 'armor', label: 'Arena Patch', emoji: '🩹', hp: 8, cost: 0 },
  { id: 'coin_pouch', slot: 'accessory', label: 'Coin Pouch', emoji: '👝', luck: 2, cost: 0 },
];

export type EquipmentLoadout = Partial<Record<EquipmentSlot, EquipmentItem>>;

const STORAGE_PREFIX = 'bb_equipment_';

export function loadEquipment(address: string | null, fighterId: string): EquipmentLoadout {
  if (!address || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${address}_${fighterId}`);
    return raw ? (JSON.parse(raw) as EquipmentLoadout) : {};
  } catch {
    return {};
  }
}

export function saveEquipment(address: string, fighterId: string, loadout: EquipmentLoadout) {
  localStorage.setItem(`${STORAGE_PREFIX}${address}_${fighterId}`, JSON.stringify(loadout));
}

export function equipmentStatBonus(loadout: EquipmentLoadout): { atk: number; hp: number; spd: number; luck: number } {
  let atk = 0;
  let hp = 0;
  let spd = 0;
  let luck = 0;
  for (const item of Object.values(loadout)) {
    if (!item) continue;
    atk += item.atk ?? 0;
    hp += item.hp ?? 0;
    spd += item.spd ?? 0;
    luck += item.luck ?? 0;
  }
  return { atk, hp, spd, luck };
}

export function randomDrop(): EquipmentItem {
  return DROP_TABLE[Math.floor(Math.random() * DROP_TABLE.length)];
}
