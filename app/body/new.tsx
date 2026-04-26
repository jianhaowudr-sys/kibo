import { View, Text, ScrollView, Pressable, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useThemePalette } from '@/lib/useThemePalette';
import { useAppStore } from '@/stores/useAppStore';
import { readInBodyFromBase64, type InBodyReading } from '@/lib/ocr';
import { hasActiveProviderKey } from '@/lib/ai_provider';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';

type Form = {
  measuredAt: string;
  weightKg: string;
  bodyFatPct: string;
  skeletalMuscleKg: string;
  muscleMassKg: string;
  proteinKg: string;
  bodyFatKg: string;
  mineralKg: string;
  bodyWaterKg: string;
  bmr: string;
  visceralFatLevel: string;
  bodyScore: string;
  note: string;
};

const EMPTY: Form = {
  measuredAt: new Date().toISOString().slice(0, 10),
  weightKg: '',
  bodyFatPct: '',
  skeletalMuscleKg: '',
  muscleMassKg: '',
  proteinKg: '',
  bodyFatKg: '',
  mineralKg: '',
  bodyWaterKg: '',
  bmr: '',
  visceralFatLevel: '',
  bodyScore: '',
  note: '',
};

export default function NewBodyMeasurement() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addBodyMeasurement = useAppStore((s) => s.addBodyMeasurement);

  const [form, setForm] = useState<Form>(EMPTY);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    haptic.tapLight();
    const req = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!req.granted) {
      Alert.alert('需要權限', source === 'camera' ? '需相機權限' : '需相簿權限');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        });

    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setPhotoUri(a.uri);
    setPhotoBase64(a.base64 ?? null);
  };

  const onChoosePhoto = () => {
    Alert.alert('選擇照片', '', [
      { text: '拍照', onPress: () => pick('camera') },
      { text: '從相簿選', onPress: () => pick('library') },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const onAIParse = async () => {
    if (!photoBase64) {
      Alert.alert('請先選照片');
      return;
    }
    const check = await hasActiveProviderKey();
    if (!check.has) {
      Alert.alert(
        `需要 ${check.providerLabel} API Key`,
        `當前模型：${check.modelName}\n\n請到「我 → 設定」填入 ${check.providerLabel} 的 API Key 再試\n\n或直接手動輸入數值`,
      );
      return;
    }

    setOcrLoading(true);
    haptic.tapMedium();
    try {
      const reading = await readInBodyFromBase64(photoBase64);
      applyReading(reading);
      haptic.success();
      Alert.alert('✅ 判讀完成', '請檢查數值是否正確');
    } catch (e: any) {
      haptic.error();
      Alert.alert('判讀失敗', e?.message ?? String(e));
    } finally {
      setOcrLoading(false);
    }
  };

  const applyReading = (r: InBodyReading) => {
    setForm((prev) => ({
      ...prev,
      measuredAt: r.measuredAt ?? prev.measuredAt,
      weightKg: r.weightKg != null ? String(r.weightKg) : prev.weightKg,
      bodyFatPct: r.bodyFatPct != null ? String(r.bodyFatPct) : prev.bodyFatPct,
      skeletalMuscleKg: r.skeletalMuscleKg != null ? String(r.skeletalMuscleKg) : prev.skeletalMuscleKg,
      muscleMassKg: r.muscleMassKg != null ? String(r.muscleMassKg) : prev.muscleMassKg,
      proteinKg: r.proteinKg != null ? String(r.proteinKg) : prev.proteinKg,
      bodyFatKg: r.bodyFatKg != null ? String(r.bodyFatKg) : prev.bodyFatKg,
      mineralKg: r.mineralKg != null ? String(r.mineralKg) : prev.mineralKg,
      bodyWaterKg: r.bodyWaterKg != null ? String(r.bodyWaterKg) : prev.bodyWaterKg,
      bmr: r.bmr != null ? String(r.bmr) : prev.bmr,
      visceralFatLevel: r.visceralFatLevel != null ? String(r.visceralFatLevel) : prev.visceralFatLevel,
      bodyScore: r.bodyScore != null ? String(r.bodyScore) : prev.bodyScore,
    }));
  };

  const save = async () => {
    haptic.tapMedium();
    try {
      const measuredAt = new Date(form.measuredAt).getTime();
      if (isNaN(measuredAt)) {
        Alert.alert('日期格式錯誤', '請用 YYYY-MM-DD 格式');
        return;
      }
      await addBodyMeasurement({
        measuredAt: new Date(measuredAt) as any,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        bodyFatPct: form.bodyFatPct ? Number(form.bodyFatPct) : null,
        skeletalMuscleKg: form.skeletalMuscleKg ? Number(form.skeletalMuscleKg) : null,
        muscleMassKg: form.muscleMassKg ? Number(form.muscleMassKg) : null,
        proteinKg: form.proteinKg ? Number(form.proteinKg) : null,
        bodyFatKg: form.bodyFatKg ? Number(form.bodyFatKg) : null,
        mineralKg: form.mineralKg ? Number(form.mineralKg) : null,
        bodyWaterKg: form.bodyWaterKg ? Number(form.bodyWaterKg) : null,
        bmr: form.bmr ? Number(form.bmr) : null,
        visceralFatLevel: form.visceralFatLevel ? Number(form.visceralFatLevel) : null,
        bodyScore: form.bodyScore ? Number(form.bodyScore) : null,
        photoUri: photoUri,
        note: form.note.trim() || null,
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error();
      Alert.alert('儲存失敗', e?.message ?? String(e));
    }
  };

  const field = (label: string, key: keyof Form, unit = '', kb: 'numeric' | 'default' = 'numeric') => (
    <View className="flex-1">
      <Text className="text-kibo-mute text-[10px] mb-1">
        {label} {unit && <Text className="text-kibo-mute">({unit})</Text>}
      </Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm((p) => ({ ...p, [key]: v }))}
        keyboardType={kb}
        placeholder="-"
        placeholderTextColor={palette.placeholder}
        className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 text-center"
      />
    </View>
  );

  return (
    <View className="flex-1 bg-kibo-bg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}>
        <Text className="text-kibo-mute text-xs mb-2">測量日期</Text>
        <TextInput
          value={form.measuredAt}
          onChangeText={(v) => setForm((p) => ({ ...p, measuredAt: v }))}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={palette.placeholder}
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
        />

        <Text className="text-kibo-mute text-xs mb-2">InBody 報告照片</Text>
        {photoUri ? (
          <View className="mb-3">
            <Image source={{ uri: photoUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 16 }} resizeMode="contain" />
            <View className="flex-row gap-2 mt-2">
              <Pressable
                onPress={onChoosePhoto}
                className="flex-1 bg-kibo-surface border border-kibo-card rounded-xl py-2"
              >
                <Text className="text-kibo-text text-center text-sm">更換照片</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoBase64(null);
                }}
                className="bg-kibo-surface border border-kibo-danger rounded-xl py-2 px-4"
              >
                <Text className="text-kibo-danger text-sm">移除</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={onChoosePhoto}
            className="bg-kibo-surface border-2 border-dashed border-kibo-card rounded-2xl py-10 mb-3 items-center"
          >
            <Text className="text-4xl mb-2">📷</Text>
            <Text className="text-kibo-primary font-semibold">選擇 InBody 照片</Text>
            <Text className="text-kibo-mute text-xs mt-1">拍照或從相簿選</Text>
          </Pressable>
        )}

        {photoBase64 && (
          <Pressable
            onPress={onAIParse}
            disabled={ocrLoading}
            className={`rounded-2xl py-3 mb-4 flex-row items-center justify-center gap-2 ${ocrLoading ? 'bg-kibo-card' : 'bg-kibo-accent'}`}
          >
            {ocrLoading ? (
              <>
                <ActivityIndicator color="#F1F5F9" />
                <Text className="text-kibo-text font-bold">AI 判讀中...</Text>
              </>
            ) : (
              <Text className="text-kibo-bg font-bold">🤖 AI 自動判讀</Text>
            )}
          </Pressable>
        )}

        <Text className="text-kibo-text text-base font-bold mb-2">體組成數值</Text>

        <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
          <View className="flex-row gap-2 mb-3">
            {field('體重', 'weightKg', 'kg')}
            {field('體脂率', 'bodyFatPct', '%')}
          </View>
          <View className="flex-row gap-2 mb-3">
            {field('骨骼肌量', 'skeletalMuscleKg', 'kg')}
            {field('肌肉量', 'muscleMassKg', 'kg')}
          </View>
          <View className="flex-row gap-2 mb-3">
            {field('蛋白質量', 'proteinKg', 'kg')}
            {field('體脂肪量', 'bodyFatKg', 'kg')}
          </View>
          <View className="flex-row gap-2 mb-3">
            {field('骨鹽量', 'mineralKg', 'kg')}
            {field('身體水分', 'bodyWaterKg', 'kg')}
          </View>
          <View className="flex-row gap-2 mb-3">
            {field('基礎代謝', 'bmr', 'kcal')}
            {field('內臟脂肪等級', 'visceralFatLevel', '')}
          </View>
          <View className="flex-row gap-2">
            {field('身體分數', 'bodyScore', '')}
            <View className="flex-1" />
          </View>
        </View>

        <Text className="text-kibo-mute text-xs mb-2">備註</Text>
        <TextInput
          value={form.note}
          onChangeText={(v) => setForm((p) => ({ ...p, note: v }))}
          placeholder="今天狀態、早上量的、空腹..."
          placeholderTextColor={palette.placeholder}
          multiline
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card min-h-[60px]"
        />
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-kibo-surface border-t border-kibo-card px-4 pt-3 flex-row gap-2"
        style={{ paddingBottom: Math.max(12, insets.bottom) }}
      >
        <Pressable
          onPress={() => router.back()}
          className="bg-kibo-card rounded-2xl py-4 px-6"
        >
          <Text className="text-kibo-text font-semibold">取消</Text>
        </Pressable>
        <Pressable
          onPress={save}
          className="flex-1 bg-kibo-primary rounded-2xl py-4"
        >
          <Text className="text-kibo-bg text-center font-bold text-lg">儲存</Text>
        </Pressable>
      </View>
    </View>
  );
}
