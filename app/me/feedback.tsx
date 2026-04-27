import { View, Text, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as haptic from '@/lib/haptic';
import Constants from 'expo-constants';

const TYPES = [
  { code: 'bug', label: '🐛 Bug 回報' },
  { code: 'feature', label: '💡 功能建議' },
  { code: 'praise', label: '❤️ 讚美' },
  { code: 'other', label: '🗣 其他' },
] as const;

type FeedbackType = typeof TYPES[number]['code'];

export default function Feedback() {
  const palette = useThemePalette();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const session = useAppStore((s) => s.authSession);

  const [type, setType] = useState<FeedbackType>('feature');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('請填寫內容');
      return;
    }
    if (!isSupabaseConfigured()) {
      Alert.alert('未設定雲端', '請先到「我」分頁登入帳號才能送出回饋');
      return;
    }
    setSubmitting(true);
    try {
      haptic.tapMedium();
      const { error } = await supabase.from('feedback').insert({
        user_id: session?.user?.id ?? null,
        user_name: user?.name ?? null,
        type,
        content: content.trim(),
        contact: contact.trim() || null,
        app_version: (Constants.expoConfig?.version ?? null) as any,
        platform: Platform.OS,
        device_info: `${Platform.OS} ${Platform.Version}`,
      });
      if (error) throw error;
      haptic.success();
      Alert.alert('已送出', '感謝你的回饋，我會仔細看每一則 🙏', [
        { text: '好', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      haptic.error();
      Alert.alert('送出失敗', e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-kibo-text text-base font-bold mb-3">告訴我哪裡可以更好</Text>

      <Text className="text-kibo-mute text-xs mb-2">類型</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {TYPES.map((t) => {
          const active = type === t.code;
          return (
            <Pressable
              key={t.code}
              onPress={() => { haptic.tapLight(); setType(t.code); }}
              className={`px-3 py-2 rounded-xl ${active ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
            >
              <Text className={`text-xs ${active ? 'text-kibo-bg font-bold' : 'text-kibo-text'}`}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-kibo-mute text-xs mb-2">內容</Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="想吐槽的、想要的功能、用得卡卡的地方都歡迎"
        placeholderTextColor={palette.placeholder}
        multiline
        maxLength={1000}
        className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
        style={{ minHeight: 140, textAlignVertical: 'top' }}
      />

      <Text className="text-kibo-mute text-xs mb-2">聯絡方式（選填）</Text>
      <TextInput
        value={contact}
        onChangeText={setContact}
        placeholder="Email / IG / Line ID — 想被回覆才填"
        placeholderTextColor={palette.placeholder}
        className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-6 border border-kibo-card"
      />

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        className={`${submitting ? 'bg-kibo-card' : 'bg-kibo-primary'} rounded-2xl py-4`}
      >
        <Text className="text-kibo-bg text-center font-bold">
          {submitting ? '送出中...' : '送出回饋'}
        </Text>
      </Pressable>

      <Text className="text-kibo-mute text-[10px] text-center mt-3">
        匿名亦可送出（不留聯絡方式即匿名）
      </Text>
    </ScrollView>
  );
}
