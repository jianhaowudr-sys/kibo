import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { THEME_COLORS, type ResolvedTheme, type ThemeMode } from '@/lib/theme';
import { PIXEL_COLORS } from '@/lib/palette';

function resolve(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

/**
 * 取得當前主題（modern/pixel × light/dark）解析後的 palette + 旗標。
 *
 * 用法：
 *   const { isPixel, palette, mode, style } = useThemeStyle();
 *   <Text style={{ color: palette.text }}>...</Text>
 */
export function useThemeStyle() {
  const themeMode = useAppStore((s) => s.themeMode);
  const themeStyle = useAppStore((s) => s.themeStyle);
  const systemScheme = useSystemColorScheme();
  const mode = resolve(themeMode, systemScheme);
  const isPixel = themeStyle === 'pixel';
  const palette = isPixel ? PIXEL_COLORS[mode] : THEME_COLORS[mode];
  return { isPixel, palette, mode, style: themeStyle };
}
