import { View, Text, ScrollView, Pressable, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useThemePalette } from '@/lib/useThemePalette';
import { useAppStore } from '@/stores/useAppStore';
import { readMealFromBase64, readMealsFromMultiplePhotos, mergeMealReadings, type MealReading, type MergeMode } from '@/lib/ocr';
import { hasActiveProviderKey } from '@/lib/ai_provider';
import { recordMealCorrection } from '@/lib/memory';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';
import { useLowPower } from '@/hooks/useLowPower';
import { TutorialTip } from '@/components/common/TutorialTip';
import { FoodPickerModal } from '@/components/diet/FoodPickerModal';
import type { MealType, MealItem } from '@/db/schema';

type PhotoSlot = { uri: string; base64: string; takenAt: number | null };
const MAX_PHOTOS = 5;

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
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [aiParsed, setAiParsed] = useState(false);
  const [aiOriginalItems, setAiOriginalItems] = useState<MealItem[] | null>(null);
  const [perPhotoReadings, setPerPhotoReadings] = useState<MealReading[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>('sameMeal');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [includePalmRef, setIncludePalmRef] = useState(false);
  const lowPower = useLowPower();
  const healthSettings = useAppStore((s) => s.healthSettings);

  const onPickFromLibrary = (item: MealItem) => {
    const newItems = [...items, item];
    setItems(newItems);
    setCalories(String(newItems.reduce((s, x) => s + (x.calories || 0), 0)));
    setProtein(String(Math.round(newItems.reduce((s, x) => s + (x.protein || 0), 0) * 10) / 10));
    setCarb(String(Math.round(newItems.reduce((s, x) => s + (x.carb || 0), 0) * 10) / 10));
    setFat(String(Math.round(newItems.reduce((s, x) => s + (x.fat || 0), 0) * 10) / 10));
    haptic.success();
  };

  // 食物庫去重檢查 — 已經在庫的 item.name 標 ★
  const customFoods = useAppStore((s) => s.customFoods);
  const addCustomFood = useAppStore((s) => s.addCustomFood);
  const isInLibrary = (name: string) => customFoods.some((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());

  const saveItemToLibrary = async (item: MealItem) => {
    if (isInLibrary(item.name)) {
      Alert.alert('已在食物庫', `「${item.name}」已存在於食物庫`);
      return;
    }
    haptic.tapMedium();
    await addCustomFood({
      name: item.name,
      emoji: '🍽',
      caloriesKcal: Math.round(item.calories || 0),
      proteinG: Math.round((item.protein || 0) * 10) / 10,
      carbG: Math.round((item.carb || 0) * 10) / 10,
      fatG: Math.round((item.fat || 0) * 10) / 10,
      portion: item.portion || '1 份',
      photoUri: photos[0]?.uri ?? null,
      source: 'ai',
    });
    haptic.success();
    Alert.alert('✓ 已加入食物庫', `「${item.name}」下次可直接點選不必再拍`);
  };

  const extractTakenAt = (asset: any, source: 'camera' | 'library'): number | null => {
    const exif: any = asset.exif;
    const taken = exif?.DateTimeOriginal || exif?.DateTime;
    if (taken && typeof taken === 'string') {
      const fixed = taken.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const t = Date.parse(fixed);
      return isNaN(t) ? Date.now() : t;
    }
    return source === 'camera' ? Date.now() : null;
  };

  const pick = async (source: 'camera' | 'library') => {
    haptic.tapLight();
    const req = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!req.granted) {
      Alert.alert('需要權限');
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert(`最多 ${MAX_PHOTOS} 張`);
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true, exif: true })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true,
          exif: true,
          allowsMultipleSelection: source === 'library',
          selectionLimit: remaining,
        });

    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const newSlots: PhotoSlot[] = result.assets.slice(0, remaining).map((a: any) => ({
      uri: a.uri,
      base64: a.base64 ?? '',
      takenAt: extractTakenAt(a, source),
    }));
    setPhotos((prev) => [...prev, ...newSlots]);
    // 加新照片就清掉之前的 AI 結果（避免混淆）
    setAiParsed(false);
    setPerPhotoReadings([]);
  };

  const onChoosePhoto = () => {
    Alert.alert('選擇照片', `最多 ${MAX_PHOTOS} 張`, [
      { text: '拍照', onPress: () => pick('camera') },
      { text: '從相簿選', onPress: () => pick('library') },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const removePhoto = (idx: number) => {
    haptic.tapLight();
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPerPhotoReadings([]);
    setAiParsed(false);
  };

  const onAIParse = async () => {
    if (photos.length === 0) {
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
    const palmRef = includePalmRef
      ? { lengthCm: healthSettings.body.palmLengthCm, widthCm: healthSettings.body.palmWidthCm }
      : undefined;
    try {
      if (photos.length === 1) {
        const reading = await readMealFromBase64(photos[0].base64, {
          capturedAt: photos[0].takenAt ?? Date.now(),
          palmRef,
        });
        setPerPhotoReadings([reading]);
        apply(reading);
      } else {
        const readings = await readMealsFromMultiplePhotos(
          photos.map((p) => p.base64),
          { palmRef },
          lowPower, // 低負擔模式 → 序列
        );
        setPerPhotoReadings(readings);
        if (readings.length === 0) {
          Alert.alert('判讀失敗', '所有照片都判讀失敗，請手動輸入');
          return;
        }
        // 同一餐 → 取平均合併成 1 份；不同餐 → 顯示總和供使用者預覽（儲存時拆 N 餐）
        const merged = mergeMealReadings(readings, mergeMode);
        apply(merged);
      }
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
      // 多張照片 + 不同餐模式 → 拆 N 餐分別存
      if (photos.length > 1 && mergeMode === 'multipleMeals' && perPhotoReadings.length === photos.length) {
        for (let i = 0; i < photos.length; i++) {
          const r = perPhotoReadings[i];
          await addMeal({
            loggedAt: new Date() as any,
            mealType,
            title: r.title || null,
            itemsJson: r.items.length > 0 ? JSON.stringify(r.items) : null,
            caloriesKcal: r.totalCalories || null,
            proteinG: r.totalProtein || null,
            carbG: r.totalCarb || null,
            fatG: r.totalFat || null,
            photoUri: photos[i].uri,
            note: i === 0 ? (note.trim() || null) : null,
            aiParsed: true,
          });
        }
        haptic.success();
        router.back();
        return;
      }

      // 單張或同一餐合併 → 1 筆
      await addMeal({
        loggedAt: new Date() as any,
        mealType,
        title: title.trim() || null,
        itemsJson: items.length > 0 ? JSON.stringify(items) : null,
        caloriesKcal: calories ? Number(calories) : null,
        proteinG: protein ? Number(protein) : null,
        carbG: carb ? Number(carb) : null,
        fatG: fat ? Number(fat) : null,
        photoUri: photos[0]?.uri ?? null,
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

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text className="text-kibo-mute text-xs">食物照片 ({photos.length}/{MAX_PHOTOS})</Text>
          {photos.length > 0 && photos.length < MAX_PHOTOS && (
            <Pressable onPress={onChoosePhoto}>
              <Text className="text-kibo-primary text-xs">＋ 加照片</Text>
            </Pressable>
          )}
        </View>

        {photos.length === 0 ? (
          <>
            <View className="flex-row gap-2 mb-2">
              <Pressable
                onPress={onChoosePhoto}
                className="flex-1 bg-kibo-accent rounded-2xl py-8 items-center"
              >
                <Text className="text-3xl mb-1">📷</Text>
                <Text className="text-kibo-bg font-bold">拍食物 + AI</Text>
                <Text className="text-kibo-bg/70 text-[10px] mt-1">最多 5 張</Text>
              </Pressable>
              <Pressable
                onPress={() => { haptic.tapLight(); setPickerOpen(true); }}
                className="flex-1 bg-kibo-surface border-2 border-kibo-card rounded-2xl py-8 items-center"
              >
                <Text className="text-3xl mb-1">🍽</Text>
                <Text className="text-kibo-text font-bold">食物庫</Text>
                <Text className="text-kibo-mute text-[10px] mt-1">挑選常吃食物</Text>
              </Pressable>
            </View>
            <Text className="text-kibo-mute text-[10px] text-center mb-3">
              💡 常吃的食物（高蛋白、飯糰）建到食物庫後 → 直接挑選不必拍照
            </Text>
          </>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8 }}>
            {photos.map((p, i) => {
              const reading = perPhotoReadings[i];
              return (
                <View key={i} style={{ width: 120 }}>
                  <View style={{ position: 'relative' }}>
                    <Image source={{ uri: p.uri }} style={{ width: 120, height: 120, borderRadius: 12 }} resizeMode="cover" />
                    <Pressable
                      onPress={() => removePhoto(i)}
                      style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>✕</Text>
                    </Pressable>
                  </View>
                  {reading && (
                    <Text className="text-kibo-mute text-[10px] mt-1 text-center">
                      {reading.totalCalories} kcal
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* 多張照片時：選同一餐 or 不同餐 */}
        {photos.length > 1 && (
          <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card mb-3">
            <Text className="text-kibo-text font-semibold mb-2 text-sm">這幾張照片是…</Text>
            <View className="flex-row gap-2 mb-2">
              <Pressable
                onPress={() => { haptic.tapLight(); setMergeMode('sameMeal'); setAiParsed(false); }}
                className={`flex-1 py-3 rounded-xl items-center ${mergeMode === 'sameMeal' ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
              >
                <Text className={`font-semibold text-sm ${mergeMode === 'sameMeal' ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                  📷 同一餐多角度
                </Text>
                <Text className={`text-[10px] mt-1 ${mergeMode === 'sameMeal' ? 'text-kibo-bg/80' : 'text-kibo-mute'}`}>
                  算一份營養（取平均，避免重複）
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { haptic.tapLight(); setMergeMode('multipleMeals'); setAiParsed(false); }}
                className={`flex-1 py-3 rounded-xl items-center ${mergeMode === 'multipleMeals' ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
              >
                <Text className={`font-semibold text-sm ${mergeMode === 'multipleMeals' ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                  🍱 不同餐分別記
                </Text>
                <Text className={`text-[10px] mt-1 ${mergeMode === 'multipleMeals' ? 'text-kibo-bg/80' : 'text-kibo-mute'}`}>
                  存成 {photos.length} 筆，各算各的
                </Text>
              </Pressable>
            </View>
            <Text className="text-kibo-mute text-[10px] leading-4">
              {mergeMode === 'sameMeal'
                ? '💡 同一個便當/盤子拍多張角度 → 選這個，AI 會把每張的估算取平均當作一份'
                : '💡 早餐 + 午餐放在一起拍 → 選這個，每張會分別存成獨立一筆紀錄'}
            </Text>
          </View>
        )}

        {photos.length > 0 && (
          <>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              if (!includePalmRef) {
                const isDefault = healthSettings.body.palmLengthCm === 18 && healthSettings.body.palmWidthCm === 9;
                if (isDefault) {
                  Alert.alert(
                    '手掌參照已開啟',
                    '目前使用預設值 18×9 cm（成人平均）。建議到「我 → 健康偏好 → 我的手掌尺寸」填自己的會更準。',
                    [{ text: '知道了', onPress: () => setIncludePalmRef(true) }],
                  );
                  return;
                }
              }
              setIncludePalmRef(!includePalmRef);
            }}
            className={`flex-row items-center p-3 mb-3 rounded-xl ${includePalmRef ? 'bg-kibo-primary' : 'bg-kibo-surface border border-kibo-card'}`}
          >
            <Text style={{ fontSize: 18, marginRight: 8 }}>✋</Text>
            <View style={{ flex: 1 }}>
              <Text className={`font-semibold text-sm ${includePalmRef ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                拍照時手掌入鏡？{includePalmRef ? 'ON' : 'OFF'}
              </Text>
              <Text className={`text-[10px] mt-0.5 ${includePalmRef ? 'text-kibo-bg/80' : 'text-kibo-mute'}`}>
                {includePalmRef
                  ? `AI 會用你的手掌 (${healthSettings.body.palmLengthCm}×${healthSettings.body.palmWidthCm} cm) 校準份量`
                  : '勾選後 AI 用你手掌當比例尺，估算更準（解決常見高估）'}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onAIParse}
            disabled={ocrLoading}
            className={`rounded-2xl py-4 mb-4 flex-row items-center justify-center gap-2 ${ocrLoading ? 'bg-kibo-card' : 'bg-kibo-accent'}`}
          >
            {ocrLoading ? (
              <>
                <ActivityIndicator color="#F1F5F9" />
                <Text className="text-kibo-text font-bold">
                  AI 估算中... {photos.length > 1 ? `(${photos.length} 張${lowPower ? ' 序列' : ' 並行'})` : ''}
                </Text>
              </>
            ) : (
              <Text className="text-kibo-bg font-bold text-base">
                🤖 AI 自動估營養 {photos.length > 1 && (mergeMode === 'sameMeal' ? `(${photos.length} 張取平均)` : `(${photos.length} 張分開記)`)}
              </Text>
            )}
          </Pressable>
          </>
        )}

        <TutorialTip id="diet-multi-photo" delay={1500} />
        <FoodPickerModal
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={onPickFromLibrary}
        />

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
              {items.map((it, i) => {
                const inLib = isInLibrary(it.name);
                return (
                  <View
                    key={i}
                    className={`flex-row items-center gap-2 py-2 ${i > 0 ? 'border-t border-kibo-card' : ''}`}
                  >
                    <View className="flex-1">
                      <Text className="text-kibo-text font-semibold text-sm">{it.name}</Text>
                      {it.portion && <Text className="text-kibo-mute text-xs">{it.portion}</Text>}
                    </View>
                    <Text className="text-kibo-accent text-xs">{it.calories} kcal</Text>
                    <Pressable
                      onPress={() => saveItemToLibrary(it)}
                      hitSlop={8}
                      style={{ paddingHorizontal: 4 }}
                    >
                      <Text style={{ fontSize: 16, color: inLib ? '#ffa300' : '#83769c' }}>
                        {inLib ? '★' : '☆'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => removeItem(i)}>
                      <Text className="text-kibo-danger ml-1">✕</Text>
                    </Pressable>
                  </View>
                );
              })}
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
