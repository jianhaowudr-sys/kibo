import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';

const KEY = '@kibo/theme_mode';
const STYLE_KEY = '@kibo/theme_style';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeStyle = 'modern' | 'pixel';

export async function getThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return 'dark';
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}

export async function getThemeStyle(): Promise<ThemeStyle> {
  try {
    const v = await AsyncStorage.getItem(STYLE_KEY);
    if (v === 'modern' || v === 'pixel') return v;
  } catch {}
  return 'modern';
}

export async function setThemeStyle(style: ThemeStyle): Promise<void> {
  await AsyncStorage.setItem(STYLE_KEY, style);
}

export const THEME_COLORS = {
  light: {
    bg: '#f3f5fa',
    surface: '#ffffff',
    card: '#d6dff2',
    primary: '#0058be',
    accent: '#825100',
    success: '#006c49',
    danger: '#ba1a1a',
    text: '#151c27',
    mute: '#424754',
    placeholder: '#94a3b8',
    statusBar: 'dark' as const,
  },
  dark: {
    bg: '#0b1326',
    surface: '#171f33',
    card: '#2d3449',
    primary: '#adc6ff',
    accent: '#ffb2b7',
    success: '#4edea3',
    danger: '#ffb4ab',
    text: '#dae2fd',
    mute: '#c2c6d6',
    placeholder: '#64748b',
    statusBar: 'light' as const,
  },
};

export type ResolvedTheme = 'light' | 'dark';

export const THEME_VARS = {
  light: vars({
    '--kibo-bg': '243 245 250',
    '--kibo-surface': '255 255 255',
    '--kibo-card': '214 223 242',
    '--kibo-primary': '0 88 190',
    '--kibo-accent': '130 81 0',
    '--kibo-success': '0 108 73',
    '--kibo-danger': '186 26 26',
    '--kibo-text': '21 28 39',
    '--kibo-mute': '66 71 84',
    '--kibo-strength': '249 115 22',
    '--kibo-cardio': '6 182 212',
    '--kibo-flex': '168 85 247',
  }),
  dark: vars({
    '--kibo-bg': '11 19 38',
    '--kibo-surface': '23 31 51',
    '--kibo-card': '45 52 73',
    '--kibo-primary': '173 198 255',
    '--kibo-accent': '255 178 183',
    '--kibo-success': '78 222 163',
    '--kibo-danger': '255 180 171',
    '--kibo-text': '218 226 253',
    '--kibo-mute': '194 198 214',
    '--kibo-strength': '249 115 22',
    '--kibo-cardio': '6 182 212',
    '--kibo-flex': '168 85 247',
  }),
};
