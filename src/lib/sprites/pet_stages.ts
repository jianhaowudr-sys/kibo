/**
 * 寵物進化階段 sprite。
 * 同一隻寵物按 stage 1~4 顯示不同樣貌：
 *  1. 寶寶 — 小巧無裝飾
 *  2. 幼年 — 標準（用 PET_FRAMES）
 *  3. 青年 — 大一點 + 觸角
 *  4. 成年 — 戴皇冠
 *  5. 大師 — 周圍光暈 + 皇冠（合在 stage 4 上層光暈）
 */

import type { SpriteColor } from './palette';
import { PET_FRAMES, type PetAnimation } from './pet';

type Frame = (SpriteColor | 0)[][];
const X = 0;
const k = 'k';
const w = 'w';
const bl = 'bl';
const blD = 'blD';
const yl = 'yl';
const ylD = 'yld';
const pk = 'pk';

// === Stage 1：寶寶（12x12，圓圓的小團）===
const BABY_IDLE_1: Frame = [
  [X,X,X,X,k,k,k,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,w,bl,bl,w,bl,k,X,X],
  [X,X,k,bl,k,bl,bl,k,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,k,k,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,blD,bl,bl,bl,bl,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,k,k,k,k,k,X,X,X],
];
const BABY_IDLE_2: Frame = [
  [X,X,X,X,X,X,X,X,X,X,X,X],
  [X,X,X,X,k,k,k,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,w,bl,bl,w,bl,k,X,X],
  [X,X,k,bl,k,bl,bl,k,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,k,k,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,blD,bl,bl,bl,bl,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,k,k,k,k,k,X,X,X],
];

// === Stage 3：青年（16x16 + 觸角）===
function withAntennae(base: Frame): Frame {
  // 在 base 上方加 2 行觸角（實際上 base 已是 16 行，這裡只覆蓋頂部）
  const out = base.map((r) => [...r] as Frame[number]);
  // 把第 0 列改成觸角形狀（左右各一條）
  out[0] = [X,k,X,X,X,X,X,X,X,X,X,X,X,X,k,X];
  return out;
}

// === Stage 4：成年（16x16 + 皇冠）===
function withCrown(base: Frame): Frame {
  const out = base.map((r) => [...r] as Frame[number]);
  // 第 0~1 列加皇冠（黃色 yl）
  out[0] = [X,X,X,X,yl,X,yl,X,yl,X,yl,X,X,X,X,X];
  out[1] = [X,X,X,X,yl,yl,yl,yl,yl,yl,yl,X,X,X,X,X];
  return out;
}

// === Stage 5：大師（皇冠 + 粉光暈）===
function withMasterCrown(base: Frame): Frame {
  const out = base.map((r) => [...r] as Frame[number]);
  out[0] = [X,X,X,yl,ylD,X,yl,X,yl,X,ylD,yl,X,X,X,X];
  out[1] = [X,X,X,yl,yl,yl,yl,yl,yl,yl,yl,yl,X,X,X,X];
  return out;
}

const BASE = PET_FRAMES;

export function framesForStage(stage: number, anim: PetAnimation): Frame[] {
  const baseFrames = BASE[anim] ?? BASE.idle;
  if (stage <= 1) {
    if (anim === 'idle') return [BABY_IDLE_1, BABY_IDLE_2];
    return [BABY_IDLE_1];
  }
  if (stage === 2) {
    return baseFrames as any;
  }
  if (stage === 3) {
    return baseFrames.map((f) => withAntennae(f as any)) as any;
  }
  if (stage === 4) {
    return baseFrames.map((f) => withCrown(f as any)) as any;
  }
  // stage >= 5
  return baseFrames.map((f) => withMasterCrown(f as any)) as any;
}

export const STAGE_LABEL: Record<number, string> = {
  1: '寶寶',
  2: '幼年',
  3: '青年',
  4: '成年',
  5: '大師',
};
