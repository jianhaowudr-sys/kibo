// 委派給 hooks/useThemeStyle（單一真相），保留原簽名讓呼叫端零改動。
import { useThemeStyle } from '@/hooks/useThemeStyle';
import type { ResolvedTheme } from '@/lib/theme';

export function useThemePalette() {
  return useThemeStyle().palette;
}

export function useResolvedTheme(): ResolvedTheme {
  return useThemeStyle().mode;
}
