import { View, Text, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';

const JKO_URL = 'https://service.jkopay.com/r/transfer?j=Transfer:900804722';

export default function Sponsor() {
  const palette = useThemePalette();

  const open = async () => {
    haptic.tapMedium();
    try {
      const ok = await Linking.canOpenURL(JKO_URL);
      if (ok) await Linking.openURL(JKO_URL);
      else Alert.alert('無法開啟連結', JKO_URL);
    } catch (e: any) {
      Alert.alert('開啟失敗', e?.message ?? String(e));
    }
  };

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="items-center mb-6 mt-4">
        <Text className="text-6xl mb-2">☕</Text>
        <Text className="text-kibo-text text-xl font-bold mb-2">請我喝杯咖啡？</Text>
        <Text className="text-kibo-mute text-xs text-center px-6">
          Kibo 是業餘時間做的小品 App。如果它對你有幫助，{'\n'}
          一杯咖啡的支持就是我繼續更新的動力 🙏
        </Text>
      </View>

      <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
        <View className="flex-row items-center mb-2">
          <Text className="text-2xl mr-2">🟠</Text>
          <Text className="text-kibo-text font-bold text-base flex-1">街口支付</Text>
        </View>
        <Text className="text-kibo-mute text-xs mb-3">
          街口 App 用戶可直接點擊連結轉帳給作者
        </Text>
        <Pressable
          onPress={open}
          className="bg-kibo-primary rounded-xl py-3"
        >
          <Text className="text-kibo-bg text-center font-bold text-sm">前往街口贊助</Text>
        </Pressable>
      </View>

      <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mt-4">
        <Text className="text-kibo-mute text-xs text-center">
          所有支持都會用在：{'\n'}
          • 雲端費用（Supabase）{'\n'}
          • AI API 額度（拍照辨識）{'\n'}
          • 開發者咖啡因補給 ☕
        </Text>
      </View>
    </ScrollView>
  );
}
