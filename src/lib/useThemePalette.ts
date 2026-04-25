import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { THEME_COLORS, type ThemeMode, type ResolvedTheme } from '@/lib/theme';

function resolve(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export function useThemePalette() {
  const systemScheme = useSystemColorScheme();
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = resolve(themeMode, systemScheme);
  return THEME_COLORS[theme];
}

export function useResolvedTheme(): ResolvedTheme {
  const systemScheme = useSystemColorScheme();
  const themeMode = useAppStore((s) => s.themeMode);
  return resolve(themeMode, systemScheme);
}
