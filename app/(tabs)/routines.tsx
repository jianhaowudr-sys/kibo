import { View, Text, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useAppStore } from '@/stores/useAppStore';
import * as repo from '@/db/repo';
import * as haptic from '@/lib/haptic';
import { LONG_PRESS_MS } from '@/lib/gestures';
import { TutorialTip } from '@/components/common/TutorialTip';
import type { RoutineExercise, Exercise, Routine } from '@/db/schema';

type RoutineDetail = {
  exercises: (RoutineExercise & { ex: Exercise })[];
  estMin: number;
  totalSets: number;
};

export default function RoutinesScreen() {
  const router = useRouter();
  const routines = useAppStore((s) => s.routines);
  const exercises = useAppStore((s) => s.exercises);
  const refreshRoutines = useAppStore((s) => s.refreshRoutines);
  const reorderRoutines = useAppStore((s) => s.reorderRoutines);
  const deleteRoutine = useAppStore((s) => s.deleteRoutine);
  const duplicateRoutine = useAppStore((s) => s.duplicateRoutine);
  const loadRoutineAsQueue = useAppStore((s) => s.loadRoutineAsQueue);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const currentWorkoutId = useAppStore((s) => s.currentWorkoutId);

  const [details, setDetails] = useState<Record<number, RoutineDetail>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadDetails = async () => {
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const out: Record<number, RoutineDetail> = {};
    for (const r of routines) {
      const rexs = await repo.listRoutineExercises(r.id);
      const list = rexs
        .map((re) => {
          const ex = byId.get(re.exerciseId);
          return ex ? { ...re, ex } : null;
        })
        .filter((x): x is RoutineExercise & { ex: Exercise } => !!x);
      const totalSets = list.reduce((s, v) => s + v.targetSets, 0);
      const estMin = Math.round(totalSets * 2.5 + list.length * 1.5);
      out[r.id] = { exercises: list, estMin, totalSets };
    }
    setDetails(out);
  };

  useEffect(() => {
    refreshRoutines();
  }, [refreshRoutines]);

  useEffect(() => {
    if (routines.length > 0 && exercises.length > 0) loadDetails();
  }, [routines, exercises]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshRoutines();
    await loadDetails();
    setRefreshing(false);
  };

  const onStart = async (routineId: number) => {
    haptic.tapMedium();
    await loadRoutineAsQueue(routineId);
    if (!currentWorkoutId) await startWorkout();
    router.push('/workout/active' as any);
  };

  const onDuplicate = async (routineId: number, name: string) => {
    haptic.tapMedium();
    await duplicateRoutine(routineId);
    Alert.alert('✅ 已複製', `「${name} (複本)」`);
  };

  const onDelete = (routineId: number, name: string) => {
    Alert.alert('刪除樣板？', `「${name}」會被移除`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await deleteRoutine(routineId);
        },
      },
    ]);
  };

  const onOptions = (routineId: number, name: string) => {
    Alert.alert(name, '選擇動作', [
      { text: '取消', style: 'cancel' },
      { text: '編輯', onPress: () => router.push({ pathname: '/routine/[id]' as any, params: { id: String(routineId) } }) },
      { text: '複製', onPress: () => onDuplicate(routineId, name) },
      { text: '刪除', style: 'destructive', onPress: () => onDelete(routineId, name) },
    ]);
  };

  const onNewWorkout = async () => {
    haptic.tapMedium();
    if (!currentWorkoutId) await startWorkout();
    router.push('/workout/active' as any);
  };

  const onDragEnd = useCallback(
    ({ data }: { data: Routine[] }) => {
      haptic.tapLight();
      reorderRoutines(data.map((r) => r.id));
    },
    [reorderRoutines],
  );

  const renderItem = useCallback(
    ({ item: r, drag, isActive }: RenderItemParams<Routine>) => {
      const d = details[r.id];
      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={drag}
            delayLongPress={LONG_PRESS_MS}
            disabled={isActive}
            className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3"
            style={{ opacity: isActive ? 0.7 : 1 }}
          >
            <View className="flex-row items-center gap-3 mb-3">
              <Text className="text-3xl">{r.emoji}</Text>
              <View className="flex-1">
                <Text className="text-kibo-text font-bold text-base">{r.name}</Text>
                {d ? (
                  <Text className="text-kibo-mute text-xs mt-0.5">
                    {d.exercises.length} 動作 · {d.totalSets} 組 · 約 {d.estMin} 分鐘
                  </Text>
                ) : (
                  <Text className="text-kibo-mute text-xs mt-0.5">載入中...</Text>
                )}
                {r.note && (
                  <Text className="text-kibo-mute text-xs mt-0.5" numberOfLines={1}>
                    {r.note}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => onOptions(r.id, r.name)} className="p-2">
                <Text className="text-kibo-mute text-lg">⋯</Text>
              </Pressable>
            </View>

            {d && d.exercises.length > 0 && (
              <View className="flex-row flex-wrap gap-1 mb-3">
                {d.exercises.slice(0, 6).map((re) => (
                  <View key={re.id} className="bg-kibo-card rounded-full px-2 py-1 flex-row items-center gap-1">
                    <Text className="text-xs">{re.ex.icon}</Text>
                    <Text className="text-kibo-text text-[10px]">{re.ex.name}</Text>
                  </View>
                ))}
                {d.exercises.length > 6 && (
                  <View className="bg-kibo-card rounded-full px-2 py-1">
                    <Text className="text-kibo-mute text-[10px]">+{d.exercises.length - 6}</Text>
                  </View>
                )}
              </View>
            )}

            <Pressable
              onPress={() => onStart(r.id)}
              className="bg-kibo-primary rounded-xl py-3 active:opacity-70"
            >
              <Text className="text-kibo-bg text-center font-bold">開始訓練 →</Text>
            </Pressable>
          </Pressable>
        </ScaleDecorator>
      );
    },
    [details, onStart, onOptions],
  );

  return (
    <View className="flex-1 bg-kibo-bg">
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View className="flex-row gap-2 mb-4">
          <Pressable
            onPress={onNewWorkout}
            className="flex-1 bg-kibo-primary rounded-2xl py-4 active:opacity-70"
          >
            <Text className="text-kibo-bg text-center font-bold">
              {currentWorkoutId ? '繼續訓練 →' : '＋ 自由訓練'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              router.push('/routine/new' as any);
            }}
            className="bg-kibo-surface border border-kibo-primary rounded-2xl py-4 px-4"
          >
            <Text className="text-kibo-primary font-bold">＋ 新樣板</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-kibo-text text-lg font-bold">
            📋 我的課表 {routines.length > 0 && `(${routines.length})`}
          </Text>
          {routines.length > 1 && (
            <Text className="text-kibo-mute text-xs">長按拖曳排序</Text>
          )}
        </View>
      </View>

      {routines.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22D3EE" />}
        >
          <View className="bg-kibo-surface rounded-2xl p-8 border border-kibo-card items-center">
            <Text className="text-5xl mb-2">📋</Text>
            <Text className="text-kibo-text font-semibold">還沒有課表</Text>
            <Text className="text-kibo-mute text-xs text-center mt-1">
              建立「胸日」「腿日」等課表{'\n'}下次訓練一鍵套用
            </Text>
            <Pressable
              onPress={() => {
                haptic.tapLight();
                router.push('/routine/new' as any);
              }}
              className="bg-kibo-primary rounded-xl px-6 py-2 mt-4"
            >
              <Text className="text-kibo-bg font-bold">建立第一份課表</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <DraggableFlatList
          data={routines}
          keyExtractor={(item) => String(item.id)}
          onDragEnd={onDragEnd}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22D3EE" />}
        />
      )}

      <TutorialTip id="routine-list-drag" delay={1200} />
    </View>
  );
}
