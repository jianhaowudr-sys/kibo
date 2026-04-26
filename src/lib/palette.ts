// 像素主題色票（PICO-8 衍生 + Kibo 識別藍紫）
// 用於 themeStyle === 'pixel' 時透過 nativewind vars() 覆蓋根 View 的 CSS 變數

import { vars } from 'nativewind';

// 對外可從 JS 層直接取色（StatusBar、shadow color 等用途）
export const PIXEL_COLORS = {
  light: {
    bg: '#fff1e8',
    surface: '#ffffff',
    card: '#ffe8d3',
    primary: '#4a5fc1',
    accent: '#ff77a8',
    success: '#00a060',
    danger: '#ff004d',
    text: '#1d2b53',
    mute: '#83769c',
    placeholder: '#ab9ec0',
    statusBar: 'dark' as const,
  },
  dark: {
    bg: '#1d2b53',
    surface: '#2a3868',
    card: '#3a4a85',
    primary: '#83a5ff',
    accent: '#ff77a8',
    success: '#00e436',
    danger: '#ff5c8a',
    text: '#fff1e8',
    mute: '#a8a4c0',
    placeholder: '#7a7396',
    statusBar: 'light' as const,
  },
};

// 給 nativewind 用的 vars() 物件（套到根 View style 即可全 App 生效）
export const PIXEL_VARS = {
  light: vars({
    '--kibo-bg': '255 241 232',
    '--kibo-surface': '255 255 255',
    '--kibo-card': '255 232 211',
    '--kibo-primary': '74 95 193',
    '--kibo-accent': '255 119 168',
    '--kibo-success': '0 160 96',
    '--kibo-danger': '255 0 77',
    '--kibo-text': '29 43 83',
    '--kibo-mute': '131 118 156',
    '--kibo-strength': '255 119 168',
    '--kibo-cardio': '41 173 255',
    '--kibo-flex': '175 117 255',
  }),
  dark: vars({
    '--kibo-bg': '29 43 83',
    '--kibo-surface': '42 56 104',
    '--kibo-card': '58 74 133',
    '--kibo-primary': '131 165 255',
    '--kibo-accent': '255 119 168',
    '--kibo-success': '0 228 54',
    '--kibo-danger': '255 92 138',
    '--kibo-text': '255 241 232',
    '--kibo-mute': '168 164 192',
    '--kibo-strength': '255 119 168',
    '--kibo-cardio': '41 173 255',
    '--kibo-flex': '175 117 255',
  }),
};
