import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import * as repo from '@/db/repo';
import { StatCard } from '@/components/StatCard';
import { displayDateTime } from '@/lib/date';
import type { Exercise, WorkoutSet } from '@/db/schema';

type SetWithTime = WorkoutSet & { workoutStartedAt: number };

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAppStore((s) => s.user);
  const exercises = useAppStore((s) => s.exercises);
  const exercise: Exercise | undefined = exercises.find((e) => e.id === Number(id));

  const [sets, setSets] = useState<SetWithTime[]>([]);
  const [prs, setPrs] = useState<{ maxWeight: number | null; maxReps: number | null; maxVolume: number | null; totalSets: number; totalReps: number } | null>(null);

  useEffect(() => {
    if (!user || !exercise) return;
    (async () => {
      const ss = await repo.listSetsForExercise(user.id, exercise.id, 100);
      const p = await repo.getExercisePRs(user.id, exercise.id);
      setSets(ss);
      setPrs(p);
    })();
  }, [user, exercise]);

  if (!exercise) return null;

  const grouped: Record<string, SetWithTime[]> = {};
  for (const s of sets) {
    const d = new Date(s.workoutStartedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="bg-kibo-surface rounded-2xl p-5 border border-kibo-card mb-4 items-center">
        <Text className="text-6xl mb-2">{exercise.icon}</Text>
        <Text className="text-kibo-text text-xl font-bold">{exercise.name}</Text>
        <Text className="text-kibo-mute text-xs mt-1">
          {exercise.category === 'strength' ? '重訓' : exercise.category === 'cardio' ? '有氧' : '柔軟'} · {exercise.muscleGroup}
        </Text>
      </View>

      {prs && (
        <>
          <Text className="text-kibo-text text-base font-bold mb-2">🏆 個人紀錄 (PR)</Text>
          {exercise.unit === 'reps' ? (
            <>
              <View className="flex-row gap-3 mb-3">
                <StatCard
                  label="最大重量"
                  value={prs.maxWeight ?? '-'}
                  suffix="kg"
                  icon="🏋️"
                  color="text-kibo-accent"
                />
                <StatCard
                  label="最多次數"
                  value={prs.maxReps ?? '-'}
                  suffix="次"
                  icon="💪"
                />
              </View>
              <View className="flex-row gap-3 mb-4">
                <StatCard
                  label="單組最高 Volume"
                  value={prs.maxVolume ? prs.maxVolume.toFixed(0) : '-'}
                  suffix="kg·reps"
                  icon="📈"
                  color="text-kibo-success"
                />
                <StatCard
                  label="累計組數"
                  value={prs.totalSets}
                  icon="🔢"
                />
              </View>
            </>
          ) : (
            <View className="flex-row gap-3 mb-4">
              <StatCard
                label="累計組數"
                value={prs.totalSets}
                icon="🔢"
              />
              <StatCard
                label="總次數"
                value={prs.totalReps || '-'}
                icon="💪"
                color="text-kibo-success"
              />
            </View>
          )}
        </>
      )}

      <Text className="text-kibo-text text-base font-bold mb-2">
        歷史紀錄 {sets.length > 0 && `(${sets.length})`}
      </Text>

      {sets.length === 0 && (
        <View className="bg-kibo-surface rounded-2xl p-6 border border-kibo-card items-center">
          <Text className="text-kibo-mute text-center">還沒有這個動作的紀錄</Text>
        </View>
      )}

      {Object.entries(grouped).map(([dateKey, ss]) => (
        <View key={dateKey} className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
          <Text className="text-kibo-mute text-xs mb-2">{displayDateTime(ss[0].workoutStartedAt)}</Text>
          <View className="gap-1">
            {ss.map((s, idx) => (
              <View key={s.id} className="flex-row justify-between bg-kibo-card rounded-lg px-3 py-2">
                <Text className="text-kibo-mute text-xs">#{idx + 1}</Text>
                <Text className="text-kibo-text text-sm flex-1 text-center">
                  {exercise.unit === 'reps' && `${s.weight ?? '自重'} kg × ${s.reps}`}
                  {exercise.unit === 'seconds' && `${s.durationSec}s`}
                  {exercise.unit === 'minutes' && `${Math.round((s.durationSec ?? 0) / 60)} min${s.distanceM ? ` · ${(s.distanceM / 1000).toFixed(1)} km` : ''}`}
                  {exercise.unit === 'meters' && `${s.distanceM}m`}
                </Text>
                <Text className="text-kibo-accent text-xs">+{s.exp}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
