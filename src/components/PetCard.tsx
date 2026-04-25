import { View, Text } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { levelFromExp } from '@/lib/exp';
import type { Pet } from '@/db/schema';

export function PetCard({ pet }: { pet: Pet }) {
  const lvl = levelFromExp(pet.exp);
  const typeColor: Record<string, string> = {
    strength: 'text-kibo-strength',
    cardio: 'text-kibo-cardio',
    flex: 'text-kibo-flex',
  };
  const barColor: Record<string, string> = {
    strength: 'bg-kibo-strength',
    cardio: 'bg-kibo-cardio',
    flex: 'bg-kibo-flex',
  };

  return (
    <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card flex-row items-center gap-4">
      <Text className="text-5xl">{pet.emoji}</Text>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-kibo-text font-bold text-base">{pet.name}</Text>
          <Text className={`text-xs font-semibold ${typeColor[pet.type] ?? ''}`}>
            LV.{lvl.level}
          </Text>
        </View>
        <Text className="text-kibo-mute text-xs mt-0.5">{pet.species}</Text>
        <View className="mt-2">
          <ProgressBar
            value={lvl.current}
            max={lvl.required}
            color={barColor[pet.type] ?? 'bg-kibo-primary'}
            height="h-1.5"
          />
        </View>
      </View>
    </View>
  );
}
