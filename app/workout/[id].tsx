import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as repo from '@/db/repo';
import type { Workout, WorkoutSet, Exercise } from '@/db/schema';
import { displayDateTime, formatDuration } from '@/lib/date';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';

export default function WorkoutDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, justFinished } = useLocalSearchParams<{ id: string; justFinished?: string }>();
  const isCelebration = justFinished === '1';

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Record<number, Exercise>>({});
  const shotRef = useRef<ViewShot | null>(null);

  useEffect(() => {
    (async () => {
      const wid = Number(id);
      const w = await repo.getWorkout(wid);
      const ss = await repo.listSetsForWorkout(wid);
      const xs = await repo.listExercises();
      setWorkout(w);
      setSets(ss);
      setExercises(Object.fromEntries(xs.map((e) => [e.id, e])));
    })();
  }, [id]);

  const grouped: Record<number, WorkoutSet[]> = {};
  for (const s of sets) {
    if (!grouped[s.exerciseId]) grouped[s.exerciseId] = [];
    grouped[s.exerciseId].push(s);
  }

  const onShare = async () => {
    haptic.tapMedium();
    try {
      if (!shotRef.current) return;
      const uri = await (shotRef.current as any).capture();
      if (!uri) {
        Alert.alert('截圖失敗');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '分享訓練成果' });
        haptic.success();
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.granted) {
          await MediaLibrary.saveToLibraryAsync(uri);
          haptic.success();
          Alert.alert('✅ 已儲存到相簿');
        } else {
          Alert.alert('需要相簿權限才能儲存');
        }
      }
    } catch (e: any) {
      haptic.error();
      Alert.alert('操作失敗', e?.message ?? String(e));
    }
  };

  const onSave = async () => {
    haptic.tapMedium();
    try {
      if (!shotRef.current) return;
      const uri = await (shotRef.current as any).capture();
      if (!uri) return;
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('需要相簿權限才能儲存');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      haptic.success();
      Alert.alert('✅ 已儲存到相簿');
    } catch (e: any) {
      haptic.error();
      Alert.alert('儲存失敗', e?.message ?? String(e));
    }
  };

  if (!workout) return null;

  const totalReps = sets.reduce((s, x) => s + (x.reps ?? 0), 0);

  return (
    <View className="flex-1 bg-kibo-bg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}>
        {isCelebration && (
          <View className="bg-kibo-accent/15 border border-kibo-accent rounded-2xl p-4 mb-4 items-center">
            <Text className="text-3xl">🎉</Text>
            <Text className="text-kibo-accent font-bold text-lg mt-1">訓練完成！</Text>
            <Text className="text-kibo-text text-sm mt-1">+{workout.totalExp} EXP</Text>
          </View>
        )}

        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
          <View className="bg-kibo-bg">
            <View className="bg-kibo-surface rounded-2xl p-5 border border-kibo-card mb-4">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-2xl">🏋️</Text>
                <Text className="text-kibo-primary font-bold">Kibo 訓練紀錄</Text>
              </View>
              <Text className="text-kibo-text text-xl font-bold mt-1">
                {displayDateTime(workout.startedAt)}
              </Text>
              <View className="flex-row flex-wrap gap-4 mt-3">
                <View>
                  <Text className="text-kibo-mute text-xs">時長</Text>
                  <Text className="text-kibo-text font-bold">{formatDuration(workout.durationSec)}</Text>
                </View>
                <View>
                  <Text className="text-kibo-mute text-xs">EXP</Text>
                  <Text className="text-kibo-accent font-bold">+{workout.totalExp}</Text>
                </View>
                <View>
                  <Text className="text-kibo-mute text-xs">訓練量</Text>
                  <Text className="text-kibo-text font-bold">{workout.totalVolume.toFixed(0)}</Text>
                </View>
                <View>
                  <Text className="text-kibo-mute text-xs">動作</Text>
                  <Text className="text-kibo-text font-bold">{Object.keys(grouped).length}</Text>
                </View>
                <View>
                  <Text className="text-kibo-mute text-xs">組數</Text>
                  <Text className="text-kibo-text font-bold">{sets.length}</Text>
                </View>
                <View>
                  <Text className="text-kibo-mute text-xs">總次數</Text>
                  <Text className="text-kibo-text font-bold">{totalReps || '-'}</Text>
                </View>
              </View>
            </View>

            {Object.entries(grouped).map(([exId, exSets]) => {
              const ex = exercises[Number(exId)];
              if (!ex) return null;
              const maxWeight = Math.max(0, ...exSets.map((s) => s.weight ?? 0));
              const exVol = exSets.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0);
              return (
                <View key={exId} className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-9 h-9 rounded-full bg-kibo-card items-center justify-center">
                      <Text className="text-kibo-text font-bold">{ex.name.trim().charAt(0)}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-kibo-text font-bold">{ex.name}</Text>
                      <Text className="text-kibo-mute text-[10px]">
                        {ex.part ?? ex.muscleGroup}
                        {ex.equipment && ` · ${ex.equipment}`}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-kibo-mute text-[10px]">{exSets.length} 組</Text>
                      {exVol > 0 && <Text className="text-kibo-text text-xs">{exVol.toFixed(0)}</Text>}
                    </View>
                  </View>
                  <View className="gap-1">
                    {exSets.map((s, idx) => (
                      <View key={s.id} className="flex-row justify-between bg-kibo-card rounded-lg px-3 py-2">
                        <Text className="text-kibo-mute text-xs">#{idx + 1}</Text>
                        <Text className="text-kibo-text text-sm flex-1 text-center">
                          {ex.unit === 'reps' && `${s.weight ?? '自重'} kg × ${s.reps}`}
                          {ex.unit === 'seconds' && `${s.durationSec}s`}
                          {ex.unit === 'minutes' && `${Math.round((s.durationSec ?? 0) / 60)} min${s.distanceM ? ` · ${(s.distanceM / 1000).toFixed(1)} km` : ''}`}
                          {ex.unit === 'meters' && `${s.distanceM}m`}
                          {s.weight === maxWeight && (s.weight ?? 0) > 0 && <Text className="text-kibo-accent"> 🏆</Text>}
                        </Text>
                        <Text className="text-kibo-accent text-xs">+{s.exp}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            <Text className="text-kibo-mute text-[10px] text-center">— Kibo 健身 —</Text>
          </View>
        </ViewShot>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-kibo-surface border-t border-kibo-card px-4 pt-3 flex-row gap-2"
        style={{ paddingBottom: Math.max(12, insets.bottom) }}
      >
        <Pressable
          onPress={onSave}
          className="flex-1 bg-kibo-card rounded-2xl py-3 active:opacity-70"
        >
          <Text className="text-kibo-text text-center font-semibold">💾 存相簿</Text>
        </Pressable>
        <Pressable
          onPress={onShare}
          className="flex-1 bg-kibo-primary rounded-2xl py-3 active:opacity-70"
        >
          <Text className="text-kibo-bg text-center font-bold">📤 分享</Text>
        </Pressable>
        {isCelebration && (
          <Pressable
            onPress={() => router.replace('/(tabs)' as any)}
            className="bg-kibo-accent rounded-2xl py-3 px-4 active:opacity-70"
          >
            <Text className="text-kibo-bg font-bold">完成</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
