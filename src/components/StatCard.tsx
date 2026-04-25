import { View, Text } from 'react-native';

export function StatCard({
  label,
  value,
  suffix,
  icon,
  color = 'text-kibo-primary',
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: string;
  color?: string;
}) {
  return (
    <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card flex-1">
      {icon && <Text className="text-xl mb-1">{icon}</Text>}
      <Text className="text-kibo-mute text-xs">{label}</Text>
      <View className="flex-row items-baseline mt-1">
        <Text className={`text-2xl font-bold ${color}`}>{value}</Text>
        {suffix && <Text className="text-kibo-mute text-xs ml-1">{suffix}</Text>}
      </View>
    </View>
  );
}
