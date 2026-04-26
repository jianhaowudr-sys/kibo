import '../global.css';
import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, useColorScheme as useSystemColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { ensureSchema } from '@/db/migrate';
import { useAppStore } from '@/stores/useAppStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { THEME_COLORS, type ThemeMode, type ResolvedTheme } from '@/lib/theme';
import { PIXEL_COLORS, PIXEL_VARS } from '@/lib/palette';
import { UndoToast } from '@/components/common/UndoToast';
import { SurpriseBoxModal } from '@/components/dashboard/SurpriseBoxModal';
import { setupNotificationActionHandler } from '@/lib/reminders';

function SurpriseBoxBridge() {
  const reward = useAppStore((s) => s.pendingReward);
  const consume = useAppStore((s) => s.consumePendingReward);
  return <SurpriseBoxModal visible={!!reward} reward={reward} onClose={consume} />;
}

function resolve(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const loadThemeMode = useAppStore((s) => s.loadThemeMode);
  const loadThemeStyle = useAppStore((s) => s.loadThemeStyle);
  const loadLowPowerMode = useAppStore((s) => s.loadLowPowerMode);
  const loadCalendarViewMode = useAppStore((s) => s.loadCalendarViewMode);
  const loadStatsLayoutJson = useAppStore((s) => s.loadStatsLayoutJson);
  const loadOnboardingPetName = useAppStore((s) => s.loadOnboardingPetName);
  const loadAuthSession = useAppStore((s) => s.loadAuthSession);
  const hydrateTutorial = useTutorialStore((s) => s.hydrate);
  const themeMode = useAppStore((s) => s.themeMode);
  const themeStyle = useAppStore((s) => s.themeStyle);
  const systemScheme = useSystemColorScheme();

  const [fontsLoaded] = useFonts({
    'Cubic11': require('../assets/fonts/Cubic_11.ttf'),
    'PressStart2P': require('../assets/fonts/PressStart2P-Regular.ttf'),
  });

  const theme: ResolvedTheme = resolve(themeMode, systemScheme);
  const palette = themeStyle === 'pixel' ? PIXEL_COLORS[theme] : THEME_COLORS[theme];
  const pixelVarsStyle = themeStyle === 'pixel' ? PIXEL_VARS[theme] : undefined;

  useEffect(() => {
    const sub = setupNotificationActionHandler(async (action, data) => {
      try {
        if (data?.type === 'water' && action === 'add-cup') {
          const { useAppStore } = await import('@/stores/useAppStore');
          const cup = useAppStore.getState().healthSettings.water.favoriteCupMl;
          await useAppStore.getState().addWater(cup, { batch: false });
        }
      } catch (e) {
        console.warn('Notification action failed', e);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await ensureSchema();
        await bootstrap();
        await loadThemeMode();
        await loadThemeStyle();
        await loadLowPowerMode();
        await loadCalendarViewMode();
        await loadStatsLayoutJson();
        await loadOnboardingPetName();
        await hydrateTutorial();
        await loadAuthSession();
        // 第一次啟動 → 進 onboarding
        const { user } = useAppStore.getState();
        if (user && !user.onboardingCompletedAt) {
          // 延遲一點讓 Stack 準備好
          setTimeout(() => {
            try {
              const { router } = require('expo-router');
              router.replace('/onboarding');
            } catch {}
          }, 500);
        }
        setReady(true);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, [bootstrap, loadThemeMode, loadThemeStyle, loadAuthSession]);

  if (err) {
    return (
      <View className="flex-1 bg-kibo-bg items-center justify-center p-6">
        <Text className="text-kibo-danger text-center">初始化錯誤</Text>
        <Text className="text-kibo-mute text-xs text-center mt-2">{err}</Text>
      </View>
    );
  }

  if (!ready || !fontsLoaded) {
    return (
      <View className="flex-1 bg-kibo-bg items-center justify-center">
        <Text className="text-6xl mb-4">🥚</Text>
        <ActivityIndicator color={palette.primary} />
        <Text className="text-kibo-mute mt-3">Kibo 準備中...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[{ flex: 1 }, pixelVarsStyle]}>
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
          <Stack.Screen name="health/water" options={{ title: '喝水紀錄' }} />
          <Stack.Screen name="health/bowel" options={{ title: '排便紀錄' }} />
          <Stack.Screen name="health/sleep" options={{ title: '睡眠紀錄' }} />
          <Stack.Screen name="health/period" options={{ title: '經期紀錄' }} />
          <Stack.Screen name="me/health-settings" options={{ title: '健康設定' }} />
          <Stack.Screen name="me/food-library/index" options={{ title: '我的食物庫' }} />
          <Stack.Screen name="me/food-library/new" options={{ title: '新增食物', presentation: 'modal' }} />
          <Stack.Screen name="me/food-library/[id]" options={{ title: '編輯食物' }} />
          <Stack.Screen name="dashboard/customize" options={{ title: '自訂首頁', presentation: 'modal' }} />
          <Stack.Screen name="stats/customize" options={{ title: '自訂數據', presentation: 'modal' }} />
          <Stack.Screen name="onboarding/index" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="pet/index" options={{ headerShown: false }} />
          <Stack.Screen name="pet/inventory" options={{ title: '圖鑑收藏' }} />
        </Stack>
        <UndoToast />
        <SurpriseBoxBridge />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
