import '../global.css';
import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, useColorScheme as useSystemColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { useAppStore } from '@/stores/useAppStore';
import { THEME_COLORS, type ThemeMode, type ResolvedTheme } from '@/lib/theme';
import { PIXEL_COLORS, PIXEL_VARS } from '@/lib/palette';
import { UndoToast } from '@/components/common/UndoToast';
import { SurpriseBoxModal } from '@/components/dashboard/SurpriseBoxModal';
import { setupNotificationActionHandler } from '@/lib/reminders';
import { runCriticalStartup, runBackgroundStartup } from '@/lib/startup';

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
        await runCriticalStartup();
        // 第一次啟動 → 進 onboarding（依賴 bootstrap 的 user，須在關鍵路徑完成後判斷）
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
        runBackgroundStartup();
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, []);

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
          <Stack.Screen name="progress/index" options={{ title: '進度照' }} />
          <Stack.Screen name="progress/angle-picker" options={{ title: '選擇角度', presentation: 'modal' }} />
          <Stack.Screen name="progress/capture" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="progress/confirm" options={{ title: '確認', presentation: 'modal' }} />
          <Stack.Screen name="diet/new" options={{ title: '記錄一餐', presentation: 'modal' }} />
          <Stack.Screen name="diet/[id]" options={{ title: '飲食詳情' }} />
          <Stack.Screen name="diet/edit/[id]" options={{ title: '編輯飲食', presentation: 'modal' }} />
          <Stack.Screen name="diet/scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="egg/hatch" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="health/water" options={{ title: '喝水紀錄' }} />
          <Stack.Screen name="health/bowel" options={{ title: '排便紀錄' }} />
          <Stack.Screen name="health/sleep" options={{ title: '睡眠紀錄' }} />
          <Stack.Screen name="health/period" options={{ title: '經期紀錄' }} />
          <Stack.Screen name="me/health-settings" options={{ title: '健康設定' }} />
          <Stack.Screen name="me/food-library/index" options={{ title: '我的食物庫' }} />
          <Stack.Screen name="me/food-library/new" options={{ title: '新增食物', presentation: 'modal' }} />
          <Stack.Screen name="me/food-library/[id]" options={{ title: '編輯食物' }} />
          <Stack.Screen name="me/feedback" options={{ title: '意見回饋', presentation: 'modal' }} />
          <Stack.Screen name="me/sponsor" options={{ title: '贊助作者', presentation: 'modal' }} />
          <Stack.Screen name="me/delete-account" options={{ title: '刪除帳號', presentation: 'modal' }} />
          <Stack.Screen name="dashboard/customize" options={{ title: '自訂首頁', presentation: 'modal' }} />
          <Stack.Screen name="stats/customize" options={{ title: '自訂數據', presentation: 'modal' }} />
          <Stack.Screen name="onboarding/index" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="pet/index" options={{ headerShown: false }} />
          <Stack.Screen name="pet/inventory" options={{ title: '圖鑑收藏' }} />
          <Stack.Screen name="pet/messages" options={{ title: '寵物訊息' }} />
        </Stack>
        <UndoToast />
        <SurpriseBoxBridge />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
