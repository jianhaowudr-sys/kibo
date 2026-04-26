import { View, Text, ScrollView, Pressable, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useThemePalette } from '@/lib/useThemePalette';
import { useAppStore } from '@/stores/useAppStore';
import { readMealFromBase64, type MealReading } from '@/lib/ocr';
import { hasActiveProviderKey } from '@/lib/ai_provider';
import { recordMealCorrection } from '@/lib/memory';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';
import type { MealType, MealItem } from '@/db/schema';

const MEAL_OPTIONS: { code: MealType; label: string; emoji: string }[] = [
  { code: 'breakfast', label: '早餐', emoji: '🌅' },
  { code: 'lunch', label: '午餐', emoji: '🍱' },
  { code: 'dinner', label: '晚餐', emoji: '🌙' },
  { code: 'snack', label: '點心', emoji: '🍪' },
];

function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
}

export default function NewMeal() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type: initType } = useLocalSearchParams<{ type?: MealType }>();
  const addMeal = useAppStore((s) => s.addMeal);

  const [mealType, setMealType] = useState<MealType>(initType ?? guessMealType());
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoTakenAt, setPhotoTakenAt] = useState<number | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [aiParsed, setAiParsed] = useState(false);
  const [aiOriginalItems, setAiOriginalItems] = useState<MealItem[] | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    haptic.tapLight();
    const req = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!req.granted) {
      Alert.alert('需要權限');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true, exif: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true, exif: true });

    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setPhotoUri(a.uri);
    setPhotoBase64(a.base64 ?? null);
    const exif: any = a.exif;
    const taken = exif?.DateTimeOriginal || exif?.DateTime;
    if (taken && typeof taken === 'string') {
      const fixed = taken.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const t = Date.parse(fixed);
      setPhotoTakenAt(isNaN(t) ? Date.now() : t);
    } else {
      setPhotoTakenAt(source === 'camera' ? Date.now() : null);
    }
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
      const reading = await readMealFromBase64(photoBase64, {
        capturedAt: photoTakenAt ?? Date.now(),
      });
      apply(reading);
      haptic.success();
    } catch (e: any) {
      haptic.error();
      Alert.alert('判讀失敗', e?.message ?? String(e));
    } finally {
      setOcrLoading(false);
    }
  };

  const apply = (r: MealReading) => {
    setTitle(r.title ?? '');
    setItems(r.items ?? []);
    setAiOriginalItems(r.items ?? []);
    setCalories(String(r.totalCalories));
    setProtein(String(r.totalProtein));
    setCarb(String(r.totalCarb));
    setFat(String(r.totalFat));
    setAiParsed(true);
  };

  const recalcFromItems = (list: MealItem[]) => {
    const c = list.reduce((s, x) => s + (x.calories || 0), 0);
    const p = list.reduce((s, x) => s + (x.protein || 0), 0);
    const cb = list.reduce((s, x) => s + (x.carb || 0), 0);
    const f = list.reduce((s, x) => s + (x.fat || 0), 0);
    setCalories(String(c));
    setProtein(String(p));
    setCarb(String(cb));
    setFat(String(f));
  };

  const removeItem = (idx: number) => {
    haptic.tapLight();
    const list = items.filter((_, i) => i !== idx);
    setItems(list);
    recalcFromItems(list);
  };

  const save = async () => {
    haptic.tapMedium();
    try {
      await addMeal({
        loggedAt: new Date() as any,
        mealType,
        title: title.trim() || null,
        itemsJson: items.length > 0 ? JSON.stringify(items) : null,
        caloriesKcal: calories ? Number(calories) : null,
        proteinG: protein ? Number(protein) : null,
        carbG: carb ? Number(carb) : null,
        fatG: fat ? Number(fat) : null,
        photoUri,
        note: note.trim() || null,
        aiParsed,
      });

      if (aiParsed && items.length > 0) {
        recordMealCorrection(aiOriginalItems, items).catch(() => {});
      }

      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error();
      Alert.alert('儲存失敗', e?.message ?? String(e));
    }
  };

  return (
    <View className="flex-1 bg-kibo-bg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}>
        <Text className="text-kibo-mute text-xs mb-2">餐別</Text>
        <View className="flex-row gap-2 mb-4">
          {MEAL_OPTIONS.map((m) => (
            <Pressable
              key={m.code}
              onPress={() => {
                haptic.tapLight();
                setMealType(m.code);
              }}
              className={`flex-1 py-2 rounded-xl ${mealType === m.code ? 'bg-kibo-primary' : 'bg-kibo-surface border border-kibo-card'}`}
            >
              <Text className={`text-center text-xs ${mealType === m.code ? 'text-kibo-bg font-bold' : 'text-kibo-text'}`}>
                {m.emoji} {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-kibo-mute text-xs mb-2">食物照片</Text>
        {photoUri ? (
          <View className="mb-3">
            <Image source={{ uri: photoUri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16 }} resizeMode="cover" />
            <View className="flex-row gap-2 mt-2">
              <Pressable onPress={onChoosePhoto} className="flex-1 bg-kibo-surface border border-kibo-card rounded-xl py-2">
                <Text className="text-kibo-text text-center text-sm">更換</Text>
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
          <>
            <Pressable
              onPress={onChoosePhoto}
              className="bg-kibo-surface border-2 border-dashed border-kibo-card rounded-2xl py-10 mb-2 items-center"
            >
              <Text className="text-4xl mb-2">📷</Text>
              <Text className="text-kibo-primary font-semibold">拍食物 / 從相簿選</Text>
            </Pressable>
            <Text className="text-kibo-mute text-[10px] text-center mb-3">
              💡 盤子旁放手機 / AirPods / 硬幣當比例尺，AI 估份量更準
            </Text>
          </>
        )}

        {photoBase64 && (
          <Pressable
            onPress={onAIParse}
            disabled={ocrLoading}
            className={`rounded-2xl py-4 mb-4 flex-row items-center justify-center gap-2 ${ocrLoading ? 'bg-kibo-card' : 'bg-kibo-accent'}`}
          >
            {ocrLoading ? (
              <>
                <ActivityIndicator color="#F1F5F9" />
                <Text className="text-kibo-text font-bold">AI 精準估算中...（約 5-8 秒）</Text>
              </>
            ) : (
              <Text className="text-kibo-bg font-bold text-base">🤖 AI 自動估營養</Text>
            )}
          </Pressable>
        )}

        <Text className="text-kibo-mute text-xs mb-2">名稱（可選）</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="例如：早餐｜燕麥 + 香蕉"
          placeholderTextColor={palette.placeholder}
          maxLength={40}
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
        />

        {items.length > 0 && (
          <>
            <Text className="text-kibo-text text-base font-bold mb-2">食物明細</Text>
            <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card mb-4">
              {items.map((it, i) => (
                <View
                  key={i}
                  className={`flex-row items-center gap-2 py-2 ${i > 0 ? 'border-t border-kibo-card' : ''}`}
                >
                  <View className="flex-1">
                    <Text className="text-kibo-text font-semibold text-sm">{it.name}</Text>
                    {it.portion && <Text className="text-kibo-mute text-xs">{it.portion}</Text>}
                  </View>
                  <Text className="text-kibo-accent text-xs">{it.calories} kcal</Text>
                  <Pressable onPress={() => removeItem(i)}>
                    <Text className="text-kibo-danger ml-2">✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        <Text className="text-kibo-text text-base font-bold mb-2">營養素總計</Text>
        <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-kibo-mute text-[10px] mb-1">熱量 (kcal)</Text>
              <TextInput
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={palette.placeholder}
                className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 text-center"
              />
            </View>
            <View className="flex-1">
              <Text className="text-kibo-mute text-[10px] mb-1">蛋白質 (g)</Text>
              <TextInput
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={palette.placeholder}
                className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 text-center"
              />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="text-kibo-mute text-[10px] mb-1">碳水 (g)</Text>
              <TextInput
                value={carb}
                onChangeText={setCarb}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={palette.placeholder}
                className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 text-center"
              />
            </View>
            <View className="flex-1">
              <Text className="text-kibo-mute text-[10px] mb-1">脂肪 (g)</Text>
              <TextInput
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={palette.placeholder}
                className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 text-center"
              />
            </View>
          </View>
        </View>

        <Text className="text-kibo-mute text-xs mb-2">備註</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="地點、心情、提醒..."
          placeholderTextColor={palette.placeholder}
          multiline
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card min-h-[60px]"
        />
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-kibo-surface border-t border-kibo-card px-4 pt-3 flex-row gap-2"
        style={{ paddingBottom: Math.max(12, insets.bottom) }}
      >
        <Pressable onPress={() => router.back()} className="bg-kibo-card rounded-2xl py-4 px-6">
          <Text className="text-kibo-text font-semibold">取消</Text>
        </Pressable>
        <Pressable onPress={save} className="flex-1 bg-kibo-primary rounded-2xl py-4">
          <Text className="text-kibo-bg text-center font-bold text-lg">儲存</Text>
        </Pressable>
      </View>
    </View>
  );
}
