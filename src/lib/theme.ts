import AsyncStorage from '@react-native-async-storage/async-storage';

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
    warning: '#b45309',
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
    warning: '#fbbf24',
    text: '#dae2fd',
    mute: '#c2c6d6',
    placeholder: '#64748b',
    statusBar: 'light' as const,
  },
};

export type ResolvedTheme = 'light' | 'dark';

// 註：CSS 變數的唯一真相是 global.css（NativeWind 從那裡讀）。
// 原本這裡有一份 THEME_VARS 但全專案零引用——加 token 時改到它會完全沒效果（已移除避免再踩）。
