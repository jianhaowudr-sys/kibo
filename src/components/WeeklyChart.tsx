import { View, Text } from 'react-native';
import { format } from 'date-fns';

export function WeeklyChart({ data }: { data: Record<string, number> }) {
  const keys = Object.keys(data);
  const max = Math.max(1, ...Object.values(data));

  return (
    <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card">
      <Text className="text-kibo-mute text-xs mb-3">近 7 日訓練量</Text>
      <View className="flex-row items-end justify-between h-32 gap-1">
        {keys.map((k) => {
          const v = data[k];
          const h = max > 0 ? Math.max(4, (v / max) * 100) : 4;
          const active = v > 0;
          return (
            <View key={k} className="flex-1 items-center">
              <View
                className={`w-full rounded-t-md ${active ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
                style={{ height: `${h}%` }}
              />
              <Text className="text-kibo-mute text-[10px] mt-1">
                {format(new Date(k), 'M/d')}
              </Text>
              <Text className={`text-[10px] ${active ? 'text-kibo-text' : 'text-kibo-mute'}`}>
                {v}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
