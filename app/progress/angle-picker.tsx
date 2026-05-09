import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as haptic from '@/lib/haptic';
import { ANGLE_LABELS, ANGLE_ORDER } from '@/lib/progress_photo';

export default function AnglePicker() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-kibo-text text-base font-bold mb-2">這次拍哪個角度？</Text>
      <Text className="text-kibo-mute text-xs mb-6">
        三個角度都記比較好對比；同一角度站位、距離盡量一致，動畫播放時才不會跳。
      </Text>

      {ANGLE_ORDER.map((angle) => (
        <Pressable
          key={angle}
          onPress={() => {
            haptic.tapMedium();
            router.replace({ pathname: '/progress/capture', params: { angle } } as any);
          }}
          className="bg-kibo-surface rounded-2xl p-5 mb-3 border border-kibo-card flex-row items-center"
        >
          <Text className="text-3xl mr-4">
            {angle === 'front' ? '🧍' : angle === 'side' ? '🚶' : '🔙'}
          </Text>
          <View className="flex-1">
            <Text className="text-kibo-text font-bold text-base">{ANGLE_LABELS[angle]}</Text>
            <Text className="text-kibo-mute text-xs mt-1">
              {angle === 'front' ? '看肩寬／腰腰差' : angle === 'side' ? '看腹／臀曲線' : '看背肌／斜方'}
            </Text>
          </View>
          <Text className="text-kibo-mute text-2xl ml-2">›</Text>
        </Pressable>
      ))}

      <Pressable
        onPress={() => { haptic.tapLight(); router.back(); }}
        className="mt-3 py-3"
      >
        <Text className="text-kibo-mute text-center text-sm">取消</Text>
      </Pressable>
    </ScrollView>
  );
}
