/**
 * Sprite 共用色票（PICO-8 衍生 + Kibo 主題）。
 * 用於所有 PixelArt 元件，確保視覺統一。
 */

export const SPRITE_COLORS = {
  // 基礎
  '_': 'transparent',  // alias for transparent
  k: '#1d2b53',         // 描邊 / 主黑
  w: '#fff1e8',         // 高光 / 米白
  ws: '#ffe8d3',         // 次高光
  pk: '#ff77a8',        // 粉紅 (accent)
  pkD: '#cc4477',
  bl: '#29adff',        // 藍
  blD: '#4a5fc1',
  yl: '#ffec27',        // 黃
  yld: '#ffa300',
  gr: '#00e436',        // 綠
  grd: '#008751',
  rd: '#ff004d',        // 紅
  rdd: '#7e2553',
  pp: '#83769c',        // 灰紫
  ppD: '#5f574f',
  bg: '#fff1e8',        // 背景米白
  cd: '#c2c3c7',        // 雲灰
} as const;

export type SpriteColor = keyof typeof SPRITE_COLORS;
