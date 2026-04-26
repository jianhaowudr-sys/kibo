import { View, Text, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState, useRef } from 'react';
import { format, isSameDay, startOfDay } from 'date-fns';
import { useAppStore } from '@/stores/useAppStore';
import { MonthCalendar } from '@/components/MonthCalendar';
import { displayTime, formatDuration } from '@/lib/date';
import { eggProgress, EGG_STAGE_LABEL, eggStage, eggConfigFor } from '@/lib/pets';
import { levelFromExp } from '@/lib/exp';
import * as haptic from '@/lib/haptic';
import * as repo from '@/db/repo';
import { SWIPE_OVERSHOOT, SWIPE_RIGHT_THRESHOLD } from '@/lib/gestures';
import { HealthRow } from '@/components/health/HealthRow';
import { SleepEditModal } from '@/components/health/SleepEditModal';
import { HelpIcon } from '@/components/common/TutorialTip';
import { DailyTrinityCard } from '@/components/dashboard/DailyTrinityCard';
import { PetMessageCard } from '@/components/dashboard/PetMessageCard';
import { BodySummaryCard } from '@/components/dashboard/BodySummaryCard';
import { NutritionSummaryCard } from '@/components/dashboard/NutritionSummaryCard';
import { PetHeroBar } from '@/components/dashboard/PetHeroBar';
import { MasterTutorialTip } from '@/components/common/MasterTutorialTip';
import { parseLayout } from '@/lib/dashboard';
import type { Workout, EggType } from '@/db/schema';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const egg = useAppStore((s) => s.activeEgg);
  const workoutDates = useAppStore((s) => s.workoutDates);
  const currentWorkoutId = useAppStore((s) => s.currentWorkoutId);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const refreshHistory = useAppStore((s) => s.refreshHistory);
  const deleteWorkoutAndRefresh = useAppStore((s) => s.deleteWorkoutAndRefresh);

  const [month, setMonth] = useState(startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [dayWorkouts, setDayWorkouts] = useState<Workout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const swipeRefs = useRef<Map<number, Swipeable | null>>(new Map());

  const confirmDeleteWorkout = (w: Workout) => {
    Alert.alert(
      '刪除這次訓練？',
      `${displayTime(w.startedAt)} · ${formatDuration(w.durationSec)} · +${w.totalExp} EXP\n\n所有組數紀錄一併刪除，無法復原。`,
      [
        {
          text: '取消',
          style: 'cancel',
          onPress: () => swipeRefs.current.get(w.id)?.close(),
        },
        {
          text: '刪除',
          style: 'destructive',
          onPress: async () => {
            haptic.warning();
            await deleteWorkoutAndRefresh(w.id);
            setDayWorkouts((prev) => prev.filter((x) => x.id !== w.id));
            haptic.success();
          },
        },
      ],
    );
  };

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const key = format(selectedDate, 'yyyy-MM-dd');
      const ws = await repo.workoutsByDate(user.id, key);
      setDayWorkouts(ws);
    })();
  }, [selectedDate, user, workoutDates.length]);

  const dateSet = useMemo(() => new Set(workoutDates), [workoutDates]);

  if (!user) return null;

  const lvl = levelFromExp(user.totalExp);
  const isToday = isSameDay(selectedDate, new Date());

  const onStart = async () => {
    haptic.tapMedium();
    if (!currentWorkoutId) {
      await startWorkout();
    }
    router.push('/workout/active' as any);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await bootstrap();
    await refreshHistory();
    setRefreshing(false);
  };

  // 起床 prompt 觸發
  const sleepLast = useAppStore((s) => s.sleepLast);
  const settings = useAppStore((s) => s.healthSettings);
  const [wakePromptOpen, setWakePromptOpen] = useState(false);

  // dashboard layout
  const layoutJson = useAppStore((s) => s.dashboardLayoutJson);
  const calendarViewMode = useAppStore((s) => s.calendarViewMode);
  const setCalendarViewMode = useAppStore((s) => s.setCalendarViewMode);
  const layout = useMemo(() => parseLayout(layoutJson), [layoutJson]);
  const isCardVisible = (id: string) => {
    const c = layout.cards.find((x) => x.id === id);
    return !!c?.visible;
  };
  const cardOrder = (id: string) => layout.cards.find((x) => x.id === id)?.order ?? 999;
  // 「健康列」整組順序 = health-* 中最低的 order
  const healthOrder = Math.min(
    ...['health-water', 'health-bowel', 'health-sleep', 'health-period']
      .filter(isCardVisible)
      .map(cardOrder),
    999,
  );
  const anyHealthVisible = ['health-water', 'health-bowel', 'health-sleep', 'health-period'].some(isCardVisible);

  useEffect(() => {
    if (!settings.sleep.wakePrompt.enabled) return;
    const now = new Date();
    if (now.getHours() < settings.sleep.wakePrompt.afterHour) return;
    // 檢查昨晚是否已記錄
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const dayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (sleepLast?.dayKey === dayKey) return;
    // 也檢查今早起床（早起記錄會 dayKey 是今天）
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (sleepLast?.dayKey === todayKey) return;
    // 啟動 prompt（一天只跳一次：用 sessionStorage in-memory flag）
    if ((global as any).__kiboSleepPromptShown !== todayKey) {
      (global as any).__kiboSleepPromptShown = todayKey;
      setTimeout(() => setWakePromptOpen(true), 800);
    }
  }, [settings.sleep.wakePrompt.enabled, settings.sleep.wakePrompt.afterHour, sleepLast]);

  return (
    <SafeAreaView className="flex-1 bg-kibo-bg" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22D3EE" />}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-kibo-mute text-sm">嗨 {user.name}</Text>
            <Text className="text-kibo-text text-2xl font-bold mt-0.5">
              訓練家 LV.{lvl.level} · 🔥 {user.streak}
            </Text>
          </View>
          {egg && (
            <Pressable
              onPress={() => {
                haptic.tapLight();
                router.push('/pet' as any);
              }}
              className="items-center"
            >
              <Text className="text-3xl">🥚</Text>
              <Text className="text-kibo-mute text-[10px]">
                {egg.currentExp}/{egg.requiredExp}
              </Text>
            </Pressable>
          )}
        </View>

        {/* dashboard 控制列（永遠在最頂） */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8, gap: 8 }}>
          <Pressable
            onPress={() => router.push('/dashboard/customize' as any)}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#83769c22' }}
          >
            <Text style={{ fontSize: 14 }}>⚙️</Text>
            <Text style={{ color: '#83769c', fontSize: 12, fontWeight: '600' }}>自訂</Text>
          </Pressable>
          <HelpIcon scope="home" />
        </View>

        {/* 寵物常駐列 */}
        {isCardVisible('pet-hero') && <PetHeroBar />}

        {/* Daily Trinity（依 layout） */}
        {isCardVisible('streak-trinity') && <DailyTrinityCard />}

        {/* 寵物訊息（依 layout） */}
        {isCardVisible('pet-message') && <PetMessageCard />}

        {/* 體態快覽 */}
        {isCardVisible('body-summary') && <BodySummaryCard />}

        {/* 飲食快覽 */}
        {isCardVisible('nutrition-summary') && <NutritionSummaryCard />}

        {/* 月曆 */}
        {isCardVisible('calendar') && (
          <MonthCalendar
            month={month}
            onChangeMonth={setMonth}
            workoutDates={dateSet}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            viewMode={calendarViewMode}
            onChangeViewMode={setCalendarViewMode}
          />
        )}

        {/* Today 健康列 */}
        {anyHealthVisible && (
          <View style={{ marginTop: 16, marginBottom: 8 }}>
            <Text className="text-kibo-text text-base font-bold mb-2">今日健康</Text>
            <HealthRow />
          </View>
        )}

        {isCardVisible('today-workouts') && (
        <View className="mt-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-kibo-text text-base font-bold">
              {isToday ? '今天訓練' : format(selectedDate, 'M 月 d 日')}
            </Text>
            {dayWorkouts.length > 0 && (
              <Text className="text-kibo-mute text-xs">{dayWorkouts.length} 次訓練</Text>
            )}
          </View>

          {dayWorkouts.length === 0 && isToday && (
            <View className="bg-kibo-surface rounded-2xl p-6 border border-kibo-card items-center mb-3">
              <Text className="text-5xl mb-2">💪</Text>
              <Text className="text-kibo-mute text-center">今天還沒訓練</Text>
              <Text className="text-kibo-mute text-xs text-center mt-1">動起來餵蛋吧</Text>
            </View>
          )}

          {dayWorkouts.length === 0 && !isToday && (
            <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card">
              <Text className="text-kibo-mute text-xs text-center">這天沒有訓練紀錄</Text>
            </View>
          )}

          {dayWorkouts.map((w) => (
            <Swipeable
              key={w.id}
              ref={(ref) => {
                swipeRefs.current.set(w.id, ref);
              }}
              overshootRight={SWIPE_OVERSHOOT}
              rightThreshold={SWIPE_RIGHT_THRESHOLD}
              renderRightActions={() => (
                <Pressable
                  onPressIn={() => haptic.tapMedium()}
                  onPress={() => confirmDeleteWorkout(w)}
                  className="bg-kibo-danger justify-center px-5 rounded-2xl mb-2 ml-2"
                >
                  <Text className="text-kibo-bg font-bold">🗑 刪除</Text>
                </Pressable>
              )}
            >
              <Pressable
                onPress={() => {
                  haptic.tapLight();
                  router.push({ pathname: '/workout/[id]' as any, params: { id: String(w.id) } });
                }}
                className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-2 active:opacity-70"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-kibo-text font-semibold">
                    {displayTime(w.startedAt)} · {formatDuration(w.durationSec)}
                  </Text>
                  <Text className="text-kibo-accent font-bold">+{w.totalExp} EXP</Text>
                </View>
                <Text className="text-kibo-mute text-xs mt-1">
                  訓練量 {w.totalVolume.toFixed(0)} kg·reps
                </Text>
              </Pressable>
            </Swipeable>
          ))}

          {isToday && (
            <Pressable
              onPress={onStart}
              className="bg-kibo-primary rounded-2xl py-5 mt-2 active:opacity-70"
            >
              <Text className="text-kibo-bg text-center text-xl font-bold">
                {currentWorkoutId ? '繼續訓練 →' : '開始訓練 →'}
              </Text>
              <Text className="text-kibo-bg/70 text-center text-xs mt-1">
                每次運動都會餵養你的蛋
              </Text>
            </Pressable>
          )}
        </View>
        )}
      </ScrollView>

      <SleepEditModal
        visible={wakePromptOpen}
        onClose={() => setWakePromptOpen(false)}
        promptMode
      />
      <MasterTutorialTip />
    </SafeAreaView>
  );
}
