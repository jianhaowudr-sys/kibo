import '../global.css';
import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, useColorScheme as useSystemColorScheme } from 'react-native';
import { ensureSchema } from '@/db/migrate';
import { useAppStore } from '@/stores/useAppStore';
import { THEME_COLORS, type ThemeMode, type ResolvedTheme } from '@/lib/theme';

function resolve(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const loadThemeMode = useAppStore((s) => s.loadThemeMode);
  const loadAuthSession = useAppStore((s) => s.loadAuthSession);
  const themeMode = useAppStore((s) => s.themeMode);
  const systemScheme = useSystemColorScheme();

  const theme: ResolvedTheme = resolve(themeMode, systemScheme);
  const palette = THEME_COLORS[theme];

  useEffect(() => {
    (async () => {
      try {
        await ensureSchema();
        await bootstrap();
        await loadThemeMode();
        await loadAuthSession();
        setReady(true);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, [bootstrap, loadThemeMode, loadAuthSession]);

  if (err) {
    return (
      <View className="flex-1 bg-kibo-bg items-center justify-center p-6">
        <Text className="text-kibo-danger text-center">初始化錯誤</Text>
        <Text className="text-kibo-mute text-xs text-center mt-2">{err}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View className="flex-1 bg-kibo-bg items-center justify-center">
        <Text className="text-6xl mb-4">🥚</Text>
        <ActivityIndicator color={palette.primary} />
        <Text className="text-kibo-mute mt-3">Kibo 準備中...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={palette.statusBar} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: palette.bg },
            headerTintColor: palette.text,
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="workout/active" options={{ title: '進行中訓練', presentation: 'modal' }} />
          <Stack.Screen name="workout/[id]" options={{ title: '訓練詳情' }} />
          <Stack.Screen name="exercise/select" options={{ title: '選擇動作', presentation: 'modal' }} />
          <Stack.Screen name="exercise/new" options={{ title: '新增自訂運動', presentation: 'modal' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '動作詳情' }} />
          <Stack.Screen name="routine/new" options={{ title: '新增樣板', presentation: 'modal' }} />
          <Stack.Screen name="routine/[id]" options={{ title: '編輯樣板' }} />
          <Stack.Screen name="body/index" options={{ title: 'InBody 紀錄' }} />
          <Stack.Screen name="body/new" options={{ title: '新增 InBody', presentation: 'modal' }} />
          <Stack.Screen name="body/[id]" options={{ title: '紀錄詳情' }} />
          <Stack.Screen name="diet/new" options={{ title: '記錄一餐', presentation: 'modal' }} />
          <Stack.Screen name="diet/[id]" options={{ title: '飲食詳情' }} />
          <Stack.Screen name="egg/hatch" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
