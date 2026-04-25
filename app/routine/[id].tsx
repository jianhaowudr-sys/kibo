import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as repo from '@/db/repo';
import * as haptic from '@/lib/haptic';
import type { Routine, RoutineExercise, Exercise } from '@/db/schema';

const EMOJI_PRESET = ['💪', '🦵', '🔥', '🏋️', '🏃', '🧘', '🤸', '🎯'];

export default function RoutineEdit() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const routineId = Number(id);
  const exercises = useAppStore((s) => s.exercises);
  const refreshRoutines = useAppStore((s) => s.refreshRoutines);

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [rexs, setRexs] = useState<(RoutineExercise & { ex: Exercise })[]>([]);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [note, setNote] = useState('');

  const load = async () => {
    const r = await repo.getRoutine(routineId);
    if (!r) {
      router.back();
      return;
    }
    setRoutine(r);
    setName(r.name);
    setEmoji(r.emoji);
    setNote(r.note ?? '');

    const byId = new Map(exercises.map((e) => [e.id, e]));
    const list = await repo.listRoutineExercises(routineId);
    setRexs(list.map((re) => ({ ...re, ex: byId.get(re.exerciseId)! })).filter((x) => x.ex));
  };

  useEffect(() => {
    load();
  }, [routineId]);

  const save = async () => {
    haptic.tapMedium();
    await repo.updateRoutine(routineId, { name: name.trim() || '未命名', emoji, note: note.trim() });
    await refreshRoutines();
    haptic.success();
    Alert.alert('✅ 已儲存');
  };

  const updateSets = async (rexId: number, delta: number) => {
    haptic.tapLight();
    const rex = rexs.find((r) => r.id === rexId);
    if (!rex) return;
    const newSets = Math.max(1, Math.min(10, rex.targetSets + delta));
    await repo.updateRoutineExercise(rexId, { targetSets: newSets });
    setRexs((prev) => prev.map((r) => (r.id === rexId ? { ...r, targetSets: newSets } : r)));
  };

  const removeExercise = (rexId: number, exName: string) => {
    Alert.alert('從課表移除？', exName, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await repo.removeExerciseFromRoutine(rexId);
          setRexs((prev) => prev.filter((r) => r.id !== rexId));
        },
      },
    ]);
  };

  if (!routine) return null;

  return (
    <View className="flex-1 bg-kibo-bg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text className="text-kibo-mute text-xs mb-2">名稱</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={24}
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
        />

        <Text className="text-kibo-mute text-xs mb-2">圖示</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {EMOJI_PRESET.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                haptic.tapLight();
                setEmoji(e);
              }}
              className={`w-12 h-12 items-center justify-center rounded-xl ${emoji === e ? 'bg-kibo-primary' : 'bg-kibo-surface border border-kibo-card'}`}
            >
              <Text className="text-2xl">{e}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-kibo-mute text-xs mb-2">備註</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="訓練重點、提醒事項"
          placeholderTextColor={palette.placeholder}
          maxLength={60}
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
        />

        <Text className="text-kibo-text text-base font-bold mb-2">
          動作清單 ({rexs.length})
        </Text>
        <View className="gap-2 mb-4">
          {rexs.map((r) => (
            <View key={r.id} className="bg-kibo-surface rounded-xl p-3 border border-kibo-card flex-row items-center gap-3">
              <Text className="text-2xl">{r.ex.icon}</Text>
              <View className="flex-1">
                <Text className="text-kibo-text font-semibold">{r.ex.name}</Text>
                <Text className="text-kibo-mute text-xs">{r.ex.muscleGroup}</Text>
              </View>
              <View className="flex-row items-center gap-1 bg-kibo-card rounded-lg px-1">
                <Pressable onPress={() => updateSets(r.id, -1)} className="px-3 py-1">
                  <Text className="text-kibo-text text-lg">−</Text>
                </Pressable>
                <Text className="text-kibo-text font-bold w-5 text-center">{r.targetSets}</Text>
                <Pressable onPress={() => updateSets(r.id, 1)} className="px-3 py-1">
                  <Text className="text-kibo-text text-lg">＋</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => removeExercise(r.id, r.ex.name)} className="p-2">
                <Text className="text-kibo-danger">✕</Text>
              </Pressable>
            </View>
          ))}
          {rexs.length === 0 && (
            <Text className="text-kibo-mute text-center text-xs py-4">動作已全部移除</Text>
          )}
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-kibo-surface border-t border-kibo-card px-4 pt-3 flex-row gap-2"
        style={{ paddingBottom: Math.max(12, insets.bottom) }}
      >
        <Pressable
          onPress={() => router.back()}
          className="bg-kibo-card rounded-2xl py-4 px-6"
        >
          <Text className="text-kibo-text font-semibold">取消</Text>
        </Pressable>
        <Pressable
          onPress={save}
          className="flex-1 bg-kibo-primary rounded-2xl py-4"
        >
          <Text className="text-kibo-bg text-center font-bold text-lg">儲存</Text>
        </Pressable>
      </View>
    </View>
  );
}
