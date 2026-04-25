import { View, Text, TextInput, Pressable } from 'react-native';
import { useState } from 'react';
import type { Exercise, WorkoutSet } from '@/db/schema';
import * as haptic from '@/lib/haptic';
import { useThemePalette } from '@/lib/useThemePalette';

export function SetInputRow({
  exercise,
  index,
  lastSet,
  onSubmit,
  onRemove,
}: {
  exercise: Exercise;
  index: number;
  lastSet?: WorkoutSet | null;
  onSubmit: (data: { weight?: number; reps?: number; durationSec?: number; distanceM?: number }) => void;
  onRemove?: () => void;
}) {
  const palette = useThemePalette();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [mins, setMins] = useState('');
  const [dist, setDist] = useState('');

  const lastWeightPh = lastSet?.weight != null ? String(lastSet.weight) : '0';
  const lastRepsPh = lastSet?.reps != null ? String(lastSet.reps) : '10';
  const lastMinsPh =
    lastSet?.durationSec != null
      ? exercise.unit === 'seconds'
        ? String(lastSet.durationSec)
        : String(Math.round(lastSet.durationSec / 60))
      : exercise.unit === 'seconds' ? '30' : '30';
  const lastDistPh =
    lastSet?.distanceM != null
      ? exercise.unit === 'minutes'
        ? String((lastSet.distanceM / 1000).toFixed(1))
        : String(lastSet.distanceM)
      : exercise.unit === 'minutes' ? '5' : '100';

  const handle = () => {
    haptic.tapMedium();
    if (exercise.unit === 'reps') {
      const w = weight ? Number(weight) : lastSet?.weight ?? undefined;
      const r = reps ? Number(reps) : lastSet?.reps ?? undefined;
      onSubmit({ weight: w == null ? undefined : w, reps: r == null ? undefined : r });
      setReps('');
    } else if (exercise.unit === 'seconds') {
      const s = mins ? Number(mins) : lastSet?.durationSec ?? undefined;
      onSubmit({ durationSec: s == null ? undefined : s });
      setMins('');
    } else if (exercise.unit === 'minutes') {
      const s = mins ? Number(mins) * 60 : lastSet?.durationSec ?? undefined;
      const d = dist ? Number(dist) * 1000 : lastSet?.distanceM ?? undefined;
      onSubmit({
        durationSec: s == null ? undefined : s,
        distanceM: d == null ? undefined : d,
      });
      setMins('');
      setDist('');
    } else if (exercise.unit === 'meters') {
      const d = dist ? Number(dist) : lastSet?.distanceM ?? undefined;
      onSubmit({ distanceM: d == null ? undefined : d });
      setDist('');
    }
  };

  return (
    <View className="bg-kibo-card rounded-xl p-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-kibo-text font-semibold">第 {index + 1} 組</Text>
        {lastSet && (
          <Text className="text-kibo-mute text-[10px]">上次同動作已帶入</Text>
        )}
        {onRemove && (
          <Pressable onPress={onRemove}>
            <Text className="text-kibo-danger text-xs">移除</Text>
          </Pressable>
        )}
      </View>

      {exercise.unit === 'reps' && (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-kibo-mute text-[10px] mb-1">重量 (kg)</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholder={lastWeightPh}
              placeholderTextColor={palette.placeholder}
              className="bg-kibo-surface text-kibo-text rounded-lg px-3 py-2 text-center text-lg"
            />
          </View>
          <View className="flex-1">
            <Text className="text-kibo-mute text-[10px] mb-1">次數</Text>
            <TextInput
              value={reps}
              onChangeText={setReps}
              keyboardType="numeric"
              placeholder={lastRepsPh}
              placeholderTextColor={palette.placeholder}
              className="bg-kibo-surface text-kibo-text rounded-lg px-3 py-2 text-center text-lg"
            />
          </View>
        </View>
      )}

      {exercise.unit === 'seconds' && (
        <View>
          <Text className="text-kibo-mute text-[10px] mb-1">秒數</Text>
          <TextInput
            value={mins}
            onChangeText={setMins}
            keyboardType="numeric"
            placeholder={lastMinsPh}
            placeholderTextColor={palette.placeholder}
            className="bg-kibo-surface text-kibo-text rounded-lg px-3 py-2 text-center text-lg"
          />
        </View>
      )}

      {exercise.unit === 'minutes' && (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-kibo-mute text-[10px] mb-1">分鐘</Text>
            <TextInput
              value={mins}
              onChangeText={setMins}
              keyboardType="numeric"
              placeholder={lastMinsPh}
              placeholderTextColor={palette.placeholder}
              className="bg-kibo-surface text-kibo-text rounded-lg px-3 py-2 text-center text-lg"
            />
          </View>
          <View className="flex-1">
            <Text className="text-kibo-mute text-[10px] mb-1">距離 (km)</Text>
            <TextInput
              value={dist}
              onChangeText={setDist}
              keyboardType="numeric"
              placeholder={lastDistPh}
              placeholderTextColor={palette.placeholder}
              className="bg-kibo-surface text-kibo-text rounded-lg px-3 py-2 text-center text-lg"
            />
          </View>
        </View>
      )}

      {exercise.unit === 'meters' && (
        <View>
          <Text className="text-kibo-mute text-[10px] mb-1">公尺</Text>
          <TextInput
            value={dist}
            onChangeText={setDist}
            keyboardType="numeric"
            placeholder={lastDistPh}
            placeholderTextColor={palette.placeholder}
            className="bg-kibo-surface text-kibo-text rounded-lg px-3 py-2 text-center text-lg"
          />
        </View>
      )}

      <Pressable
        onPress={handle}
        className="bg-kibo-primary rounded-lg py-2 mt-3"
      >
        <Text className="text-kibo-bg text-center font-bold">✓ 記錄這組</Text>
      </Pressable>
    </View>
  );
}
