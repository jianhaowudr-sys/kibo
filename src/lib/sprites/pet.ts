/**
 * 寵物 sprite 資料 — 史萊姆型生物作為 Kibo 預設品種。
 * 16x16 px，5 種狀態 × 2 frame 動畫。
 *
 * 設計成可由 itch.io 買來的 PNG sprite sheet 直接替換 — 只要把
 * Frame 改成 PNG source + frame index 即可。
 */

import type { SpriteColor } from './palette';

type Frame = (SpriteColor | 0)[][];

const X = 0;
const k = 'k';
const w = 'w';
const bl = 'bl';   // 主色：藍
const blD = 'blD';
const pk = 'pk';
const yl = 'yl';
const rd = 'rd';

// idle 1 — 站立呼吸（基本姿態）
const IDLE_1: Frame = [
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
  [X,X,X,X,k,bl,bl,bl,bl,bl,bl,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,bl,w,bl,bl,bl,w,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,w,k,bl,bl,k,w,bl,bl,k,X,X],
  [X,X,k,bl,bl,w,k,bl,bl,k,w,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,k,bl,bl,k,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,k,k,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,blD,blD,bl,bl,bl,bl,bl,bl,blD,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,blD,blD,blD,blD,blD,blD,k,k,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
];

// idle 2 — 微微縮一下（呼吸）
const IDLE_2: Frame = [
  [X,X,X,X,X,X,X,X,X,X,X,X,X,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
  [X,X,X,X,k,bl,bl,bl,bl,bl,bl,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,bl,w,bl,bl,bl,w,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,w,k,bl,bl,k,w,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,k,bl,bl,k,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,k,k,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,blD,blD,bl,bl,bl,bl,bl,bl,blD,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,blD,blD,blD,blD,blD,blD,k,k,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
];

// happy — 嘴角上揚 + 眼睛變 ^^
const HAPPY: Frame = [
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
  [X,X,X,X,k,bl,bl,bl,bl,bl,bl,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,k,bl,bl,bl,bl,k,bl,bl,k,X,X],
  [X,X,k,bl,k,bl,k,bl,bl,k,bl,k,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,k,bl,bl,bl,bl,k,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,k,k,k,k,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,blD,blD,bl,bl,bl,bl,bl,bl,blD,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,blD,blD,blD,blD,blD,blD,k,k,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
];

// sad — 眼睛 v 形 + 嘴角下垂 + 一滴淚
const SAD: Frame = [
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
  [X,X,X,X,k,bl,bl,bl,bl,bl,bl,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,bl,k,bl,bl,bl,bl,k,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,k,bl,bl,k,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,k,bl,bl,k,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,k,k,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,k,bl,bl,k,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,blD,blD,bl,bl,bl,bl,bl,bl,blD,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,blD,blD,blD,blD,blD,blD,k,k,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
];

// sleep — 閉眼 + Z 浮起
const SLEEP_1: Frame = [
  [X,X,X,X,X,X,X,X,X,X,X,X,X,X,X,X],
  [X,X,X,X,X,X,X,X,X,X,X,X,k,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,k,k,X,X,X],
  [X,X,X,X,k,bl,bl,bl,bl,bl,bl,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,bl,k,k,bl,bl,k,k,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,blD,blD,bl,bl,bl,bl,bl,bl,blD,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,blD,blD,blD,blD,blD,blD,k,k,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
];

// eat — 嘴張開
const EAT: Frame = [
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
  [X,X,X,X,k,bl,bl,bl,bl,bl,bl,k,X,X,X,X],
  [X,X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X,X],
  [X,X,k,bl,bl,w,bl,bl,bl,w,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,w,k,bl,bl,k,w,bl,bl,k,X,X],
  [X,X,k,bl,bl,w,k,bl,bl,k,w,bl,bl,k,X,X],
  [X,X,k,bl,bl,bl,bl,bl,bl,bl,bl,bl,bl,k,X,X],
  [X,X,k,bl,bl,k,k,k,k,k,k,bl,bl,k,X,X],
  [X,X,k,bl,bl,k,rd,rd,rd,rd,k,bl,bl,k,X,X],
  [X,X,k,bl,bl,k,k,k,k,k,k,bl,bl,k,X,X],
  [X,X,k,blD,blD,bl,bl,bl,bl,bl,bl,blD,blD,k,X,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X],
  [X,X,k,blD,blD,blD,blD,blD,blD,blD,blD,blD,blD,k,X,X],
  [X,X,X,k,k,blD,blD,blD,blD,blD,blD,k,k,X,X,X],
  [X,X,X,X,X,k,k,k,k,k,k,X,X,X,X,X],
];

export const PET_FRAMES = {
  idle: [IDLE_1, IDLE_2],
  happy: [HAPPY, IDLE_1],
  sad: [SAD, SAD],
  sleep: [SLEEP_1, SLEEP_1],
  eat: [EAT, IDLE_1],
};

export type PetAnimation = keyof typeof PET_FRAMES;
