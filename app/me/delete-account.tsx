import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { isSupabaseConfigured } from '@/lib/supabase';
import { deleteAccount as authDeleteAccount } from '@/lib/auth';
import { resetDatabase } from '@/db/migrate';
import * as haptic from '@/lib/haptic';

export default function DeleteAccount() {
  const palette = useThemePalette();
  const router = useRouter();
  const session = useAppStore((s) => s.authSession);
  const logout = useAppStore((s) => s.logout);
  const bootstrap = useAppStore((s) => s.bootstrap);

  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const userId = session?.user?.id;

  const onDelete = async () => {
    if (confirm.trim() !== '刪除帳號') {
      Alert.alert('請輸入「刪除帳號」四個字');
      return;
    }
    Alert.alert(
      '最後確認',
      '此動作無法復原。將清除：\n• 雲端所有資料\n• 本機所有資料\n• 登入狀態',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定刪除',
          style: 'destructive',
          onPress: doDelete,
        },
      ],
    );
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      haptic.warning();

      // 1. 雲端：呼叫 RPC delete_my_account → 刪 auth user → 所有 user_id FK 表 cascade 清除
      if (isSupabaseConfigured() && userId) {
        try { await authDeleteAccount(); } catch (e) { console.warn('[delete] cloud failed:', e); }
      } else {
        try { await logout(); } catch {}
      }

      // 2. 清空本機 SQLite
      try { await resetDatabase(); } catch {}

      // 3. 重新 bootstrap（會建空資料）
      try { await bootstrap(); } catch {}

      haptic.success();
      Alert.alert('帳號已刪除', '所有資料已清除', [
        { text: '好', onPress: () => router.replace('/' as any) },
      ]);
    } catch (e: any) {
      haptic.error();
      Alert.alert('刪除失敗', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="items-center mb-4 mt-2">
        <Text className="text-5xl mb-2">⚠️</Text>
        <Text className="text-kibo-danger text-xl font-bold mb-2">刪除帳號</Text>
      </View>

      <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-danger/40 mb-4">
        <Text className="text-kibo-text font-semibold mb-2">將永久刪除：</Text>
        <Text className="text-kibo-text text-sm mb-1">• 所有訓練、飲食、健康紀錄</Text>
        <Text className="text-kibo-text text-sm mb-1">• 體組成、寵物、蛋的資料</Text>
        <Text className="text-kibo-text text-sm mb-1">• 雲端備份（Supabase）</Text>
        <Text className="text-kibo-text text-sm mb-1">• 本機 App 資料</Text>
        <Text className="text-kibo-danger text-sm font-bold mt-3">此動作無法復原。</Text>
      </View>

      {!isSupabaseConfigured() && (
        <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card mb-4">
          <Text className="text-kibo-mute text-xs">
            目前未啟用雲端，刪除只會清掉本機資料。
          </Text>
        </View>
      )}

      <Text className="text-kibo-mute text-xs mb-2">輸入「刪除帳號」四個字以確認</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="刪除帳號"
        placeholderTextColor={palette.placeholder}
        className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-6 border border-kibo-card"
      />

      <Pressable
        onPress={onDelete}
        disabled={busy || confirm.trim() !== '刪除帳號'}
        className={`rounded-2xl py-4 ${
          busy || confirm.trim() !== '刪除帳號' ? 'bg-kibo-card' : 'bg-kibo-danger'
        }`}
      >
        <Text className="text-kibo-bg text-center font-bold">
          {busy ? '刪除中...' : '永久刪除帳號'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        className="rounded-2xl py-4 mt-2"
      >
        <Text className="text-kibo-text text-center">取消</Text>
      </Pressable>
    </ScrollView>
  );
}
