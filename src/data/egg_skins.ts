/**
 * v1.0.2 蛋皮膚資料庫。
 *
 * 純 8bit 像素風（每蛋 16x16 grid，用 react-native-svg 在 EggSprite 元件渲染）。
 * 起步 12 種皮膚，未來可逐月擴充。
 *
 * 稀有度權重：common 60% / rare 30% / epic 8% / legendary 2%
 * 連續 30 天簽到 → 下顆蛋稀有度保底 rare（從 common 池移除）
 */

import type { EggRarity } from '@/db/schema';

export type EggSkin = {
  id: string;
  label: string;
  description: string;
  rarity: EggRarity;
  /** 主色（顯示在收藏 grid 標籤色） */
  accentHex: string;
  /** UI 顯示用 emoji（沒有 sprite 時的 fallback） */
  emojiFallback: string;
};

export const EGG_SKINS: EggSkin[] = [
  // === Common (60%) ===
  {
    id: 'plain_white',
    label: '白雞蛋',
    description: '最普通的白色雞蛋，純樸又可愛',
    rarity: 'common',
    accentHex: '#F5F5F0',
    emojiFallback: '🥚',
  },
  {
    id: 'tea_egg',
    label: '茶葉蛋',
    description: '滷得入味的茶葉蛋，超商必買',
    rarity: 'common',
    accentHex: '#8B5A2B',
    emojiFallback: '🟫',
  },
  {
    id: 'boiled_egg',
    label: '水煮蛋',
    description: '剝完殼的水煮蛋，蛋白滑嫩',
    rarity: 'common',
    accentHex: '#FFFAF0',
    emojiFallback: '🥚',
  },
  {
    id: 'half_boiled',
    label: '半熟蛋',
    description: '蛋黃半熟流心，拉麵的靈魂',
    rarity: 'common',
    accentHex: '#FFB347',
    emojiFallback: '🍳',
  },
  {
    id: 'onsen_egg',
    label: '溫泉蛋',
    description: '低溫慢煮的溫泉蛋，柔嫩順口',
    rarity: 'common',
    accentHex: '#FFD580',
    emojiFallback: '🍵',
  },
  {
    id: 'raw_yolk',
    label: '生蛋黃',
    description: '橘紅滴溜的生蛋黃，配飯神器',
    rarity: 'common',
    accentHex: '#FF8C00',
    emojiFallback: '🍚',
  },

  // === Rare (30%) ===
  {
    id: 'century_egg',
    label: '皮蛋',
    description: '黑得發亮的皮蛋，松花透明',
    rarity: 'rare',
    accentHex: '#2D2A24',
    emojiFallback: '🖤',
  },
  {
    id: 'salted_duck',
    label: '鹹鴨蛋',
    description: '橘油爆漿的鹹鴨蛋，配粥一絕',
    rarity: 'rare',
    accentHex: '#E07B00',
    emojiFallback: '🦆',
  },
  {
    id: 'sunny_side',
    label: '荷包蛋',
    description: '太陽蛋邊邊酥脆',
    rarity: 'rare',
    accentHex: '#FFE066',
    emojiFallback: '🍳',
  },
  {
    id: 'braised',
    label: '滷蛋',
    description: '醬油滷透的滷蛋，便當必備',
    rarity: 'rare',
    accentHex: '#5C3317',
    emojiFallback: '🍱',
  },

  // === Epic (8%) ===
  {
    id: 'dinosaur',
    label: '恐龍蛋',
    description: '太古綠斑紋恐龍蛋，會孵出迅猛龍嗎？',
    rarity: 'epic',
    accentHex: '#6B8E23',
    emojiFallback: '🦖',
  },

  // === Legendary (2%) ===
  {
    id: 'shiba_meme',
    label: '柴犬迷因蛋',
    description: 'wow such egg, much pixel, very gym',
    rarity: 'legendary',
    accentHex: '#E6A55B',
    emojiFallback: '🐕',
  },
];

export const RARITY_WEIGHT: Record<EggRarity, number> = {
  common: 60,
  rare: 30,
  epic: 8,
  legendary: 2,
  legacy: 0,
};

export const RARITY_LABEL: Record<EggRarity, string> = {
  common: '🟢 普通',
  rare: '🔵 罕見',
  epic: '🟣 稀有',
  legendary: '🟡 傳說',
  legacy: '🌟 初代',
};

export const RARITY_COLOR: Record<EggRarity, string> = {
  common: '#83A8C7',
  rare: '#5B8DEF',
  epic: '#A06CD5',
  legendary: '#F7B731',
  legacy: '#9C8AA5',
};

export function getSkinById(id: string | null | undefined): EggSkin | null {
  if (!id) return null;
  return EGG_SKINS.find((s) => s.id === id) ?? null;
}

/**
 * 抽稀有度（依 RARITY_WEIGHT）。
 * 若 floor 指定保底（如連續 30 天簽到），common 機率歸 0。
 */
export function rollRarity(floor?: EggRarity | null): EggRarity {
  let pool: { rarity: EggRarity; weight: number }[] = [
    { rarity: 'common', weight: RARITY_WEIGHT.common },
    { rarity: 'rare', weight: RARITY_WEIGHT.rare },
    { rarity: 'epic', weight: RARITY_WEIGHT.epic },
    { rarity: 'legendary', weight: RARITY_WEIGHT.legendary },
  ];
  if (floor && floor !== 'common' && floor !== 'legacy') {
    // floor='rare' 移除 common；floor='epic' 同時移除 common + rare
    const drops: EggRarity[] = floor === 'rare' ? ['common']
      : floor === 'epic' ? ['common', 'rare']
      : floor === 'legendary' ? ['common', 'rare', 'epic']
      : [];
    pool = pool.filter((p) => !drops.includes(p.rarity));
  }
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.rarity;
  }
  return pool[0].rarity;
}

/** 從指定稀有度池內隨機抽 1 個皮膚 */
export function rollSkin(rarity: EggRarity): EggSkin {
  const pool = EGG_SKINS.filter((s) => s.rarity === rarity);
  if (pool.length === 0) {
    return EGG_SKINS[0]; // fallback 第一個普通
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
