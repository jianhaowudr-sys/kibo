import { View, Text, Pressable, Image, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as haptic from '@/lib/haptic';
import { useAppStore } from '@/stores/useAppStore';
import { centerCropTo3x4, ANGLE_LABELS } from '@/lib/progress_photo';
import { useThemePalette } from '@/lib/useThemePalette';

type Angle = 'front' | 'side' | 'back';

export default function ProgressConfirm() {
  const router = useRouter();
  const palette = useThemePalette();
  const params = useLocalSearchParams<{
    angle: Angle;
    uri: string;
    width: string;
    height: string;
    prevUri: string;
  }>();
  const angle = (params.angle ?? 'front') as Angle;
  const srcUri = params.uri ?? '';
  const srcW = Number(params.width ?? '0');
  const srcH = Number(params.height ?? '0');
  const prevUri = params.prevUri || null;

  const addProgressPhoto = useAppStore((s) => s.addProgressPhoto);

  const [croppedUri, setCroppedUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!srcUri || !srcW || !srcH) throw new Error('缺少拍攝參數');
        const out = await centerCropTo3x4(srcUri, srcW, srcH);
        setCroppedUri(out);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, [srcUri, srcW, srcH]);

  const onSave = async () => {
    if (!croppedUri) return;
    setBusy(true);
    try {
      haptic.tapMedium();
      await addProgressPhoto({ angle, photoUri: croppedUri, note: note.trim() || null });
      haptic.success();
      router.replace('/progress' as any);
    } catch (e: any) {
      haptic.error();
      Alert.alert('儲存失敗', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-kibo-text text-base font-bold mb-2">確認 {ANGLE_LABELS[angle]}照片</Text>
      <Text className="text-kibo-mute text-xs mb-4">
        系統會自動裁切成統一比例（1080×1440），讓時間軸動畫不跳框。
      </Text>

      {err && (
        <View className="bg-kibo-danger/20 rounded-xl p-4 mb-4">
          <Text className="text-kibo-danger text-sm">處理失敗：{err}</Text>
        </View>
      )}

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-kibo-mute text-xs mb-1">這張</Text>
          {croppedUri ? (
            <Image source={{ uri: croppedUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} />
          ) : (
            <View style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} className="bg-kibo-card items-center justify-center">
              <ActivityIndicator color={palette.primary} />
            </View>
          )}
        </View>
        {prevUri && (
          <View className="flex-1">
            <Text className="text-kibo-mute text-xs mb-1">上一張</Text>
            <Image source={{ uri: prevUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} />
          </View>
        )}
      </View>

      <Text className="text-kibo-mute text-xs mb-2">備註（選填）</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="例：減脂第 3 週 / 賽前 14 天"
        placeholderTextColor={palette.placeholder}
        maxLength={200}
        className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-6 border border-kibo-card"
      />

      <Pressable
        onPress={onSave}
        disabled={busy || !croppedUri}
        className={`${busy || !croppedUri ? 'bg-kibo-card' : 'bg-kibo-primary'} rounded-2xl py-4 mb-3`}
      >
        <Text className="text-kibo-bg text-center font-bold">{busy ? '儲存中...' : '儲存'}</Text>
      </Pressable>

      <Pressable
        onPress={() => { haptic.tapLight(); router.back(); }}
        disabled={busy}
        className="py-3"
      >
        <Text className="text-kibo-mute text-center text-sm">重拍</Text>
      </Pressable>
    </ScrollView>
  );
}
