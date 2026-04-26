import { View, Text, TextInput, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import type { Exercise, WorkoutSet } from '@/db/schema';
import type { PlannedSet } from '@/stores/useAppStore';
import * as haptic from '@/lib/haptic';
import { useThemePalette } from '@/lib/useThemePalette';

type Row =
  | { kind: 'done'; set: WorkoutSet; idx: number }
  | { kind: 'planned'; set: PlannedSet; idx: number };

export function ExerciseSetTable({
  exercise,
  doneSets,
  plannedSets,
  onUpdatePlanned,
  onCommitPlanned,
  onRemovePlanned,
  onUncommit,
  onAddPlanned,
  onOpenOptions,
}: {
  exercise: Exercise;
  doneSets: WorkoutSet[];
  plannedSets: PlannedSet[];
  onUpdatePlanned: (key: string, patch: Partial<PlannedSet>) => void;
  onCommitPlanned: (key: string) => void;
  onRemovePlanned: (key: string) => void;
  onUncommit: (setId: number) => void;
  onAddPlanned: () => void;
  onOpenOptions: () => void;
}) {
  const palette = useThemePalette();
  const rows: Row[] = [
    ...doneSets.map((s, i) => ({ kind: 'done' as const, set: s, idx: i })),
    ...plannedSets.map((s, i) => ({ kind: 'planned' as const, set: s, idx: doneSets.length + i })),
  ];

  const useReps = exercise.unit === 'reps';
  const useSeconds = exercise.unit === 'seconds';
  const useMinutes = exercise.unit === 'minutes';
  const useMeters = exercise.unit === 'meters';

  return (
    <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1">
          <Text className="text-kibo-text font-bold text-lg" numberOfLines={1}>
            {exercise.name}
          </Text>
          <Text className="text-kibo-mute text-[10px] mt-0.5">
            {exercise.part ?? exercise.muscleGroup}
            {exercise.equipment && ` · ${exercise.equipment}`}
          </Text>
        </View>
        <Pressable
          onPressIn={() => haptic.tapLight()}
          onPress={onOpenOptions}
          hitSlop={10}
          className="p-2"
        >
          <Text className="text-kibo-mute text-xl">⋯</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center mb-2 px-1">
        <Text className="text-kibo-mute text-[10px] w-6">組</Text>
        {useReps && (
          <>
            <Text className="text-kibo-mute text-[10px] flex-1 text-center">kg</Text>
            <Text className="text-kibo-mute text-[10px] flex-1 text-center">次數</Text>
          </>
        )}
        {useSeconds && <Text className="text-kibo-mute text-[10px] flex-1 text-center">秒</Text>}
        {useMinutes && (
          <>
            <Text className="text-kibo-mute text-[10px] flex-1 text-center">分鐘</Text>
            <Text className="text-kibo-mute text-[10px] flex-1 text-center">km</Text>
          </>
        )}
        {useMeters && <Text className="text-kibo-mute text-[10px] flex-1 text-center">公尺</Text>}
        <View className="w-10" />
      </View>

      <View className="gap-2">
        {rows.length === 0 && (
          <Text className="text-kibo-mute text-center text-xs py-4">
            沒有組數 · 點下方「＋ 新增組」開始
          </Text>
        )}

        {rows.map((row) => {
          const isDone = row.kind === 'done';
          const key = isDone ? `d-${row.set.id}` : `p-${row.set.key}`;
          const weight = isDone ? row.set.weight ?? null : row.set.weight ?? null;
          const reps = isDone ? row.set.reps ?? null : row.set.reps ?? null;
          const durationSec = isDone ? row.set.durationSec ?? null : row.set.durationSec ?? null;
          const distanceM = isDone ? row.set.distanceM ?? null : row.set.distanceM ?? null;

          const weightStr = weight != null ? String(weight) : '';
          const repsStr = reps != null ? String(reps) : '';
          const secStr = durationSec != null ? String(durationSec) : '';
          const minStr = durationSec != null ? String(Math.round(durationSec / 60)) : '';
          const kmStr = distanceM != null ? (distanceM / 1000).toFixed(1) : '';
          const mStr = distanceM != null ? String(distanceM) : '';

          const isPR = isDone ? (row.set as any).isPR : null;

          return (
            <View key={key} className="flex-row items-center gap-2">
              <View style={{ width: 24, alignItems: 'center' }}>
                <Text className={`text-center font-bold ${isDone ? 'text-kibo-primary' : 'text-kibo-mute'}`}>
                  {row.idx + 1}
                </Text>
                {isPR && (
                  <Text style={{ fontSize: 12 }}>🏆</Text>
                )}
              </View>

              {useReps && (
                <>
                  <NumInput
                    value={weightStr}
                    readOnly={isDone}
                    onChangeNumber={(v) => !isDone && onUpdatePlanned(row.set.key, { weight: v })}
                  />
                  <NumInput
                    value={repsStr}
                    readOnly={isDone}
                    onChangeNumber={(v) => !isDone && onUpdatePlanned(row.set.key, { reps: v })}
                  />
                </>
              )}

              {useSeconds && (
                <NumInput
                  value={secStr}
                  readOnly={isDone}
                  onChangeNumber={(v) => !isDone && onUpdatePlanned(row.set.key, { durationSec: v })}
                />
              )}

              {useMinutes && (
                <>
                  <NumInput
                    value={minStr}
                    readOnly={isDone}
                    onChangeNumber={(v) =>
                      !isDone && onUpdatePlanned(row.set.key, { durationSec: v != null ? v * 60 : null })
                    }
                  />
                  <NumInput
                    value={kmStr}
                    readOnly={isDone}
                    onChangeNumber={(v) =>
                      !isDone && onUpdatePlanned(row.set.key, { distanceM: v != null ? v * 1000 : null })
                    }
                  />
                </>
              )}

              {useMeters && (
                <NumInput
                  value={mStr}
                  readOnly={isDone}
                  onChangeNumber={(v) => !isDone && onUpdatePlanned(row.set.key, { distanceM: v })}
                />
              )}

              <Pressable
                onPressIn={() => haptic.tapMedium()}
                onPress={() => {
                  if (isDone) {
                    onUncommit(row.set.id);
                  } else {
                    onCommitPlanned(row.set.key);
                  }
                }}
                onLongPress={() => {
                  if (!isDone) {
                    haptic.warning();
                    onRemovePlanned(row.set.key);
                  }
                }}
                className={`w-10 h-10 rounded-full items-center justify-center ${isDone ? 'bg-kibo-primary' : 'bg-kibo-card border border-kibo-card'}`}
              >
                <Text className={isDone ? 'text-kibo-bg text-lg' : 'text-kibo-mute text-lg'}>✓</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Pressable
        onPressIn={() => haptic.tapLight()}
        onPress={onAddPlanned}
        className="mt-4 flex-row items-center justify-center gap-1 py-2 active:opacity-70"
      >
        <Text className="text-kibo-primary font-semibold">＋ 新增組</Text>
      </Pressable>
    </View>
  );
}

function NumInput({
  value,
  onChangeNumber,
  readOnly = false,
}: {
  value: string;
  onChangeNumber: (n: number | null) => void;
  readOnly?: boolean;
}) {
  const palette = useThemePalette();
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);

  // Sync external value into local text only when not focused (avoid stomping the user's typing)
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);

  return (
    <TextInput
      value={focused ? text : value}
      onChangeText={(t) => {
        const clean = t.replace(/[^0-9.]/g, '');
        setText(clean);
        if (clean === '' || clean === '.') {
          onChangeNumber(null);
          return;
        }
        const n = Number(clean);
        if (!isNaN(n)) onChangeNumber(n);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      editable={!readOnly}
      keyboardType="decimal-pad"
      selectTextOnFocus
      placeholder="-"
      placeholderTextColor={palette.placeholder}
      className={`flex-1 text-center py-2 rounded-full border ${readOnly ? 'bg-transparent border-kibo-card text-kibo-mute' : 'bg-kibo-card border-kibo-card text-kibo-text'}`}
    />
  );
}
