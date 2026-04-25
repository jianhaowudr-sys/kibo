import { View } from 'react-native';

export function ProgressBar({
  value,
  max = 1,
  color = 'bg-kibo-primary',
  height = 'h-2',
}: {
  value: number;
  max?: number;
  color?: string;
  height?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View className={`w-full ${height} bg-kibo-card rounded-full overflow-hidden`}>
      <View
        className={`${height} ${color} rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
