/**
 * 8bit 像素蛋 sprite，用 react-native-svg 渲染。
 * 每個皮膚 = 一張 12x12 的色彩 grid（每格 1 個 <Rect>）。
 *
 * stage 0~4：依進度渲染不同程度的裂痕 overlay
 *   0  完整蛋
 *   1  小裂縫（25%-）
 *   2  大裂縫（50%-）
 *   3  探出頭（75%-）
 *   4  孵化完成（100%）
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect, G } from 'react-native-svg';

const GRID = 12;

/**
 * Palette 共用顏色標記：
 *   . 透明（不畫）
 *   M 主色 main
 *   L 亮 highlight
 *   D 暗 shadow
 *   A 重點色 accent
 *   E 眼睛/特徵
 *   C 裂痕線（黑/白可在 overlay 控）
 *   B 第二主色
 */
type SkinPalette = {
  main: string;
  highlight: string;
  shadow: string;
  accent?: string;
  eye?: string;
  secondary?: string;
};

// 通用蛋形（12x12，每格一個字元）
// '.' 透明 / 'M' 主色 / 'L' 高光 / 'D' 暗 / 'A' 重點 / 'E' 眼/紋
const EGG_SHAPE_BASE = [
  '....MMMM....',
  '..MMLLMMMM..',
  '.MMLLMMMMMM.',
  '.MLLLMMMMMM.',
  'MLLMMMMMMMMD',
  'MLMMMMMMMMMD',
  'MMMMMMMMMMDD',
  'MMMMMMMMMMDD',
  '.MMMMMMMMDD.',
  '.MMMMMMMMDD.',
  '..MMMMMMDD..',
  '....MMMM....',
];

// 各皮膚的 palette + 自訂紋路 overlay
type SkinDef = {
  id: string;
  palette: SkinPalette;
  /** 主形覆蓋（用於茶葉蛋/迷因蛋 等需要紋路的款式）：與 base 同尺寸，'.' 表示沿用 base */
  overlay?: string[];
};

const SKINS: Record<string, SkinDef> = {
  plain_white: {
    id: 'plain_white',
    palette: { main: '#FAFAF7', highlight: '#FFFFFF', shadow: '#D8D2C5' },
  },
  tea_egg: {
    id: 'tea_egg',
    palette: { main: '#9B6B3A', highlight: '#C18A55', shadow: '#5C3D1F', accent: '#3F2715' },
    // 茶葉蛋：在主蛋色加裂紋網格
    overlay: [
      '............',
      '............',
      '...A..A.....',
      '..A.AA.A....',
      '...AA.AAA...',
      '..A...A.....',
      '...A.AA.A...',
      '..AA..A.....',
      '....A.AA....',
      '...A...A....',
      '............',
      '............',
    ],
  },
  boiled_egg: {
    id: 'boiled_egg',
    palette: { main: '#FFFAF0', highlight: '#FFFFFF', shadow: '#E8DEC8' },
  },
  half_boiled: {
    id: 'half_boiled',
    palette: { main: '#FFFAF0', highlight: '#FFFFFF', shadow: '#E8DEC8', accent: '#FFB347' },
    overlay: [
      '............',
      '............',
      '............',
      '....AAAA....',
      '...AAAAA....',
      '...AAAAAA...',
      '...AAAAAA...',
      '....AAAA....',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  onsen_egg: {
    id: 'onsen_egg',
    palette: { main: '#FFE9C9', highlight: '#FFF6E5', shadow: '#D9B879', accent: '#FFAA40' },
    overlay: [
      '............',
      '............',
      '............',
      '............',
      '....A.A.....',
      '...A.A.A....',
      '....A.A.....',
      '............',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  raw_yolk: {
    id: 'raw_yolk',
    palette: { main: '#FFEFD0', highlight: '#FFFAF0', shadow: '#D9B879', accent: '#FF8C00' },
    overlay: [
      '............',
      '............',
      '............',
      '...AAAA.....',
      '..AAAAAA....',
      '..AAAAAA....',
      '..AAAAAA....',
      '...AAAA.....',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  century_egg: {
    id: 'century_egg',
    palette: { main: '#3B3530', highlight: '#5C544A', shadow: '#1F1B17', accent: '#A89F8E' },
    overlay: [
      '............',
      '....A.A.....',
      '..A....A....',
      '....A.......',
      '..A...A.....',
      '....A...A...',
      '..A...A.....',
      '....A.......',
      '..A....A....',
      '....A.A.....',
      '............',
      '............',
    ],
  },
  salted_duck: {
    id: 'salted_duck',
    palette: { main: '#F2D9A1', highlight: '#FFEFC4', shadow: '#A88550', accent: '#E07B00' },
    overlay: [
      '............',
      '............',
      '............',
      '....AAAA....',
      '...AAAAAA...',
      '...AAAAAA...',
      '....AAAA....',
      '............',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  sunny_side: {
    id: 'sunny_side',
    palette: { main: '#FFFFFF', highlight: '#FFFFFF', shadow: '#E8DEC8', accent: '#FFD24A' },
    overlay: [
      '............',
      '............',
      '...AAAA.....',
      '..AAAAAA....',
      '..AAAAAA....',
      '..AAAAAA....',
      '...AAAA.....',
      '............',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  braised: {
    id: 'braised',
    palette: { main: '#5C3317', highlight: '#7A4A26', shadow: '#3A1F0C' },
  },
  dinosaur: {
    id: 'dinosaur',
    palette: { main: '#7BAA4A', highlight: '#A3CC6F', shadow: '#4F7330', accent: '#2D5016', eye: '#FFCC33' },
    overlay: [
      '............',
      '............',
      '...A.A...A..',
      '..A...A.A...',
      '...A...A....',
      '..A...A...A.',
      '...A...A.A..',
      '..A.A...A...',
      '...A...A....',
      '..A...A.....',
      '............',
      '............',
    ],
  },
  shiba_meme: {
    id: 'shiba_meme',
    palette: { main: '#E6A55B', highlight: '#F2C283', shadow: '#A6722B', accent: '#FFFFFF', eye: '#1A1A1A' },
    overlay: [
      '............',
      '............',
      '...AA..AA...',
      '....A....A..',
      '....EE..EE..',
      '....EE..EE..',
      '............',
      '....AAAA....',
      '...A....A...',
      '....AAAA....',
      '............',
      '............',
    ],
  },
};

// 裂痕 overlay（依 stage 0-3 越來越深）
const CRACK_OVERLAYS: string[][] = [
  // stage 0：完整蛋
  ['............', '............', '............', '............', '............', '............', '............', '............', '............', '............', '............', '............'],
  // stage 1：小裂縫
  ['............', '............', '............', '............', '...C........', '....C.......', '............', '............', '............', '............', '............', '............'],
  // stage 2：大裂縫
  ['............', '...C........', '....C.......', '...C........', '....CC......', '......C.....', '.......C....', '......CC....', '............', '............', '............', '............'],
  // stage 3：探出頭（上半破碎）
  ['............', 'C..C..C.....', '.CC..CC.....', '....C.C.....', '............', '............', '............', '............', '............', '............', '............', '............'],
];

const CRACK_COLOR_LIGHT = '#FFFFFF';  // 對深色蛋
const CRACK_COLOR_DARK = '#1F1B17';   // 對淺色蛋

function pickCrackColor(palette: SkinPalette): string {
  // 主色 luminance 大概用 hex 轉 RGB 求亮度
  const hex = palette.main.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? CRACK_COLOR_DARK : CRACK_COLOR_LIGHT;
}

function colorFor(ch: string, p: SkinPalette): string | null {
  switch (ch) {
    case 'M': return p.main;
    case 'L': return p.highlight;
    case 'D': return p.shadow;
    case 'A': return p.accent ?? p.shadow;
    case 'E': return p.eye ?? '#1A1A1A';
    case 'B': return p.secondary ?? p.main;
    case '.': return null;
    default: return null;
  }
}

type Props = {
  skinId: string;
  stage: 0 | 1 | 2 | 3 | 4;
  size?: number;
};

export function EggSprite({ skinId, stage, size = 64 }: Props) {
  const skin = SKINS[skinId] ?? SKINS.plain_white;
  const crackColor = pickCrackColor(skin.palette);

  // stage 4 = 已孵化（顯示完整蛋無裂痕；UI 端可用其他元件展示寵物）
  const crackStage = Math.min(3, Math.max(0, stage)) as 0 | 1 | 2 | 3;

  const cells = useMemo(() => {
    const arr: { x: number; y: number; color: string }[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const baseCh = EGG_SHAPE_BASE[y][x];
        if (baseCh === '.') continue;
        let ch = baseCh;
        // overlay 覆蓋（如紋路）
        if (skin.overlay) {
          const o = skin.overlay[y][x];
          if (o !== '.') ch = o;
        }
        const c = colorFor(ch, skin.palette);
        if (c) arr.push({ x, y, color: c });
      }
    }
    return arr;
  }, [skin]);

  const crackCells = useMemo(() => {
    const arr: { x: number; y: number }[] = [];
    const overlay = CRACK_OVERLAYS[crackStage];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (overlay[y][x] === 'C') arr.push({ x, y });
      }
    }
    return arr;
  }, [crackStage]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
        <G>
          {cells.map((c, i) => (
            <Rect key={`b${i}`} x={c.x} y={c.y} width={1} height={1} fill={c.color} />
          ))}
          {crackCells.map((c, i) => (
            <Rect key={`c${i}`} x={c.x} y={c.y} width={1} height={1} fill={crackColor} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

export function stageFromPct(pct: number): 0 | 1 | 2 | 3 | 4 {
  if (pct >= 100) return 4;
  if (pct >= 75) return 3;
  if (pct >= 50) return 2;
  if (pct >= 25) return 1;
  return 0;
}

export default EggSprite;
