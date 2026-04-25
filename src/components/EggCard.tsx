import { View, Text, Pressable } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { eggProgress, EGG_STAGE_LABEL, eggStage, eggConfigFor } from '@/lib/pets';
import type { Egg, EggType } from '@/db/schema';

export function EggCard({ egg, onPress }: { egg: Egg; onPress?: () => void }) {
  const cfg = eggConfigFor(egg.type as EggType);
  const pct = eggProgress(egg.currentExp, egg.requiredExp);
  const stage = eggStage(egg.currentExp, egg.requiredExp);
  const colorMap: Record<string, string> = {
    strength: 'bg-kibo-strength',
    cardio: 'bg-kibo-cardio',
    flex: 'bg-kibo-flex',
  };
  const wobble = stage >= 2 ? 'transform rotate-3' : '';

  return (
    <Pressable
      onPress={onPress}
      className="bg-kibo-surface rounded-3xl p-6 border border-kibo-card"
    >
      <View className="items-center py-6">
        <Text className={`text-8xl ${wobble}`}>🥚</Text>
        <Text className="text-kibo-text text-2xl font-bold mt-3">{cfg.name}</Text>
        <Text className="text-kibo-mute text-sm mt-1">{EGG_STAGE_LABEL[stage]}</Text>
      </View>
      <View className="mt-2">
        <View className="flex-row justify-between mb-1">
          <Text className="text-kibo-mute text-xs">成長進度</Text>
          <Text className="text-kibo-text text-xs font-semibold">
            {egg.currentExp} / {egg.requiredExp} EXP
          </Text>
        </View>
        <ProgressBar value={pct} color={colorMap[egg.type] ?? 'bg-kibo-primary'} height="h-3" />
      </View>
    </Pressable>
  );
}
