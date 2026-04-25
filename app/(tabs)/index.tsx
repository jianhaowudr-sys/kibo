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
                router.push('/me' as any);
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

        <MonthCalendar
          month={month}
          onChangeMonth={setMonth}
          workoutDates={dateSet}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />

        <View className="mt-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-kibo-text text-base font-bold">
              {isToday ? '今天' : format(selectedDate, 'M 月 d 日')}
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
              overshootRight={false}
              rightThreshold={60}
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
      </ScrollView>
    </SafeAreaView>
  );
}
