/**
 * 蛋 sprite 資料。3 個進化階段（完整 / 微裂 / 大裂）。
 * 每個圖案 16x16 pixel grid。
 */

import type { SpriteColor } from './palette';

type Frame = (SpriteColor | 0)[][];

const X = 0; // transparent
const k = 'k';
const w = 'w';
const ws = 'ws';
const pk = 'pk';
const yl = 'yl';

// 完整蛋（stage 0）
export const EGG_STAGE_0: Frame = [
  [X,X,X,X,X,k,k,k,k,k,X,X,X,X,X,X],
  [X,X,X,X,k,w,w,w,w,w,k,X,X,X,X,X],
  [X,X,X,k,w,w,w,w,w,w,w,k,X,X,X,X],
  [X,X,k,w,w,w,w,w,w,w,w,w,k,X,X,X],
  [X,X,k,w,w,ws,w,w,w,w,w,w,k,X,X,X],
  [X,k,w,w,w,ws,ws,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,ws,ws,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,w,w,w,w,w,w,k,X,X],
  [X,X,k,w,w,w,w,w,w,w,w,w,k,X,X,X],
  [X,X,k,w,w,w,w,w,w,w,w,w,k,X,X,X],
  [X,X,X,k,w,w,w,w,w,w,w,k,X,X,X,X],
  [X,X,X,X,k,w,w,w,w,w,k,X,X,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,X,X,X,X,X,X],
];

// 微裂（stage 1）— 加裂痕
export const EGG_STAGE_1: Frame = [
  [X,X,X,X,X,k,k,k,k,k,X,X,X,X,X,X],
  [X,X,X,X,k,w,w,w,w,w,k,X,X,X,X,X],
  [X,X,X,k,w,w,w,k,w,w,w,k,X,X,X,X],
  [X,X,k,w,w,w,k,w,w,w,w,w,k,X,X,X],
  [X,X,k,w,w,k,w,w,w,w,w,w,k,X,X,X],
  [X,k,w,w,k,w,w,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,k,w,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,k,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,k,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,k,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,w,w,w,w,w,w,k,X,X],
  [X,X,k,w,w,w,w,w,w,w,w,w,k,X,X,X],
  [X,X,k,w,w,w,w,w,w,w,w,w,k,X,X,X],
  [X,X,X,k,w,w,w,w,w,w,w,k,X,X,X,X],
  [X,X,X,X,k,w,w,w,w,w,k,X,X,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,X,X,X,X,X,X],
];

// 即將孵化（stage 2）— 大裂 + 內透光黃
export const EGG_STAGE_2: Frame = [
  [X,X,X,X,X,k,k,k,k,k,X,X,X,X,X,X],
  [X,X,X,X,k,w,w,w,w,w,k,X,X,X,X,X],
  [X,X,X,k,w,w,k,w,k,w,w,k,X,X,X,X],
  [X,X,k,w,w,k,yl,yl,k,w,w,w,k,X,X,X],
  [X,X,k,w,k,yl,yl,yl,yl,k,w,w,k,X,X,X],
  [X,k,w,k,yl,yl,yl,yl,yl,yl,k,w,w,k,X,X],
  [X,k,w,w,k,yl,yl,yl,yl,yl,k,w,w,k,X,X],
  [X,k,w,w,w,k,yl,yl,k,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,k,k,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,w,w,w,w,w,w,k,X,X],
  [X,k,w,w,w,w,w,w,w,w,w,w,w,k,X,X],
  [X,X,k,w,w,w,w,w,w,w,w,w,k,X,X,X],
  [X,X,k,w,w,w,w,w,w,w,w,w,k,X,X,X],
  [X,X,X,k,w,w,w,w,w,w,w,k,X,X,X,X],
  [X,X,X,X,k,w,w,w,w,w,k,X,X,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,X,X,X,X,X,X],
];

export const EGG_FRAMES = [EGG_STAGE_0, EGG_STAGE_1, EGG_STAGE_2];
