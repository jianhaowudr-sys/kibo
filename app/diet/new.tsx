import { View, Text, ScrollView, Pressable, TextInput, Alert, Image, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useThemePalette } from '@/lib/useThemePalette';
import { useAppStore } from '@/stores/useAppStore';
import { readMealTwoPhase, mergeMealReadings, readNutritionLabelFromBase64, type MealReading, type MergeMode, type TwoPhaseResult } from '@/lib/ocr';
import { diffReadings, snapshotOf, mergeVerifiedIntoForm, formatDiffSummary, type MealDiff, type AppliedSnapshot } from '@/lib/meal_verify';
import { hasActiveProviderKey } from '@/lib/ai_provider';
import { compressForVision } from '@/lib/image_compress';
import { recordMealCorrection } from '@/lib/memory';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';
import { useLowPower } from '@/hooks/useLowPower';
import { FoodPickerModal } from '@/components/diet/FoodPickerModal';
import { WheelPicker } from '@/components/common/WheelPicker';
import { dateKey as toDateKey } from '@/lib/date';
import { format } from 'date-fns';
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

// 各餐型的標準時間（用於記錄過去日期時的 loggedAt 預設）
const MEAL_STD_HM: Record<MealType, [number, number]> = {
  breakfast: [8, 0],
  lunch: [12, 0],
  dinner: [18, 30],
  snack: [15, 30],
};

function buildInitialLoggedAt(initDateKey: string | undefined, mealType: MealType): Date {
  const now = new Date();
  if (!initDateKey || initDateKey === toDateKey(now)) {
    return now; // 今天 → 現在這個小時
  }
  // 過去日期 → 該日的餐型標準時間
  const [y, m, d] = initDateKey.split('-').map(Number);
  const [hh, mm] = MEAL_STD_HM[mealType];
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh, mm, 0);
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS = Array.from({ length: 12 }, (_, i) => i * 5);

function TimePickerModal({
  visible,
  value,
  onSave,
  onClose,
}: {
  visible: boolean;
  value: Date;
  onSave: (d: Date) => void;
  onClose: () => void;
}) {
  const [h, setH] = useState(value.getHours());
  const [m, setM] = useState(Math.round(value.getMinutes() / 5) * 5 % 60);

  useEffect(() => {
    if (visible) {
      setH(value.getHours());
      setM(Math.round(value.getMinutes() / 5) * 5 % 60);
    }
  }, [visible, value]);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View className="bg-kibo-bg rounded-t-3xl p-4">
          <View className="flex-row items-center mb-3">
            <Text className="text-kibo-text text-base font-bold flex-1">調整記錄時間</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-kibo-mute text-2xl">✕</Text>
            </Pressable>
          </View>
          <Text className="text-kibo-mute text-xs mb-2">日期：{format(value, 'yyyy/MM/dd')}</Text>
          <View className="flex-row items-center justify-center gap-1 my-3">
            <WheelPicker
              values={HOURS}
              value={h}
              onChange={(v) => setH(v as number)}
              formatLabel={(v) => String(v).padStart(2, '0')}
              width={70}
              itemHeight={36}
              visibleCount={3}
            />
            <Text className="text-kibo-text text-2xl font-bold">:</Text>
            <WheelPicker
              values={MINS}
              value={m}
              onChange={(v) => setM(v as number)}
              formatLabel={(v) => String(v).padStart(2, '0')}
              width={70}
              itemHeight={36}
              visibleCount={3}
            />
          </View>
          <Pressable
            onPress={() => {
              const next = new Date(value);
              next.setHours(h, m, 0, 0);
              onSave(next);
            }}
            className="bg-kibo-primary rounded-2xl py-4 mt-2"
          >
            <Text className="text-kibo-bg text-center font-bold">確認</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function NewMeal() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type: initType, dateKey: initDateKey, quick: initQuick } = useLocalSearchParams<{ type?: MealType; dateKey?: string; quick?: string }>();
  const addMeal = useAppStore((s) => s.addMeal);

  const [mealType, setMealType] = useState<MealType>(initType ?? guessMealType());
  // 記錄到的時間。預設：今天 = 現在；過去日期 = 該日餐型標準時間。
  const [loggedAt, setLoggedAt] = useState<Date>(() => buildInitialLoggedAt(initDateKey, initType ?? guessMealType()));
  const [userTouchedTime, setUserTouchedTime] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const isPastDate = !!initDateKey && initDateKey !== toDateKey(new Date());

  // mealType 切換時自動同步 loggedAt 為該餐型標準時間（除非使用者已手動調過時間）
  useEffect(() => {
    if (userTouchedTime) return;
    setLoggedAt(buildInitialLoggedAt(initDateKey, mealType));
  }, [mealType, initDateKey, userTouchedTime]);

  // quick=1 → 自動展開食物庫（首頁速記入口）
  useEffect(() => {
    if (initQuick === '1') setPickerOpen(true);
  }, [initQuick]);
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
  const [photoMode, setPhotoMode] = useState<'meal' | 'label'>('meal');
  type VerifyState = 'idle' | 'verifying' | 'verified' | 'diff';
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [pendingVerified, setPendingVerified] = useState<MealReading | null>(null);
  const [pendingVerifiedList, setPendingVerifiedList] = useState<MealReading[] | null>(null);
  const [verifyDiff, setVerifyDiff] = useState<MealDiff | null>(null);
  const appliedSnapshot = useRef<AppliedSnapshot | null>(null);
  // 每輪判讀遞增；照片增刪/模式切換也遞增，讓過期的背景複核結果自動作廢
  const parseSeq = useRef(0);
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
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9, exif: true })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          exif: true,
          allowsMultipleSelection: source === 'library',
          selectionLimit: remaining,
        });

    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const preset = photoMode === 'label' ? 'label' : 'food';
    const newSlots: PhotoSlot[] = await Promise.all(
      result.assets.slice(0, remaining).map(async (a: any) => ({
        uri: a.uri,
        base64: await compressForVision(a.uri, preset),
        takenAt: extractTakenAt(a, source),
      })),
    );
    setPhotos((prev) => [...prev, ...newSlots]);
    // 加新照片就清掉之前的 AI 結果（避免混淆）
    parseSeq.current++;
    setAiParsed(false);
    setPerPhotoReadings([]);
    setVerifyState('idle');
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
    parseSeq.current++;
    setPerPhotoReadings([]);
    setAiParsed(false);
    setVerifyState('idle');
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
    setVerifyState('idle');
    setPendingVerified(null);
    setPendingVerifiedList(null);
    setVerifyDiff(null);
    const seq = ++parseSeq.current;
    haptic.tapMedium();
    const palmRef = includePalmRef
      ? { lengthCm: healthSettings.body.palmLengthCm, widthCm: healthSettings.body.palmWidthCm }
      : undefined;
    try {
      // 營養標模式：讀取包裝營養表（單次，不複核）
      if (photoMode === 'label') {
        const reading = await readNutritionLabelFromBase64(photos[0].base64);
        setPerPhotoReadings([reading]);
        apply(reading);
        haptic.success();
        return;
      }

      if (photos.length === 1) {
        const { preliminary, verification } = await readMealTwoPhase(photos[0].base64, {
          capturedAt: photos[0].takenAt ?? Date.now(),
          palmRef,
          skipVerify: lowPower, // 低耗模式維持單次、不複核
        });
        setPerPhotoReadings([preliminary]);
        apply(preliminary);
        if (!lowPower) {
          setVerifyState('verifying');
          verification.then((verified) => {
            if (seq !== parseSeq.current) return; // 過期結果作廢
            if (!verified) {
              setVerifyState('idle'); // 複核失敗：保留初判、不打擾
              return;
            }
            handleVerified(preliminary, verified, [verified]);
          });
        }
      } else {
        // 多照片：每張獨立兩段式。低耗 → 序列且跳過複核（同舊行為的單次序列）
        let results: TwoPhaseResult[] = [];
        if (lowPower) {
          for (const p of photos) {
            try {
              results.push(await readMealTwoPhase(p.base64, { palmRef, skipVerify: true }));
            } catch (e) {
              console.warn('Photo read failed', e);
            }
          }
        } else {
          const settled = await Promise.allSettled(photos.map((p) => readMealTwoPhase(p.base64, { palmRef })));
          results = settled
            .filter((s): s is PromiseFulfilledResult<TwoPhaseResult> => s.status === 'fulfilled')
            .map((s) => s.value);
        }
        const prelims = results.map((r) => r.preliminary);
        setPerPhotoReadings(prelims);
        if (prelims.length === 0) {
          Alert.alert('判讀失敗', '所有照片都判讀失敗，請手動輸入');
          return;
        }
        // 同一餐 → 取平均合併成 1 份；不同餐 → 顯示總和供使用者預覽（儲存時拆 N 餐）
        const merged = mergeMealReadings(prelims, mergeMode);
        apply(merged);
        if (!lowPower) {
          setVerifyState('verifying');
          Promise.all(results.map((r) => r.verification)).then((vs) => {
            if (seq !== parseSeq.current) return;
            if (vs.every((v) => v === null)) {
              setVerifyState('idle');
              return;
            }
            const verifiedList = vs.map((v, i) => v ?? prelims[i]); // 個別複核失敗 → 沿用該張初判
            const mergedVerified = mergeMealReadings(verifiedList, mergeMode);
            handleVerified(merged, mergedVerified, verifiedList);
          });
        }
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
    const next = {
      title: r.title ?? '',
      items: r.items ?? [],
      calories: String(r.totalCalories),
      protein: String(r.totalProtein),
      carb: String(r.totalCarb),
      fat: String(r.totalFat),
    };
    setTitle(next.title);
    setItems(next.items);
    setAiOriginalItems(next.items);
    setCalories(next.calories);
    setProtein(next.protein);
    setCarb(next.carb);
    setFat(next.fat);
    appliedSnapshot.current = snapshotOf(next);
    setAiParsed(true);
  };

  const handleVerified = (prelim: MealReading, verified: MealReading, verifiedList: MealReading[]) => {
    const diff = diffReadings(prelim, verified);
    if (__DEV__) console.log(`[ai] 複核差異 ${diff.calorieDeltaPct}%；新增 ${diff.addedItems.length}、移除 ${diff.removedItems.length}`);
    if (!diff.significant) {
      setVerifyState('verified');
      return;
    }
    setPendingVerified(verified);
    setPendingVerifiedList(verifiedList);
    setVerifyDiff(diff);
    setVerifyState('diff');
  };

  const applyVerifiedFix = () => {
    if (!pendingVerified || !appliedSnapshot.current) return;
    haptic.tapMedium();
    const next = mergeVerifiedIntoForm(
      { title, items, calories, protein, carb, fat },
      appliedSnapshot.current,
      pendingVerified,
    );
    setTitle(next.title);
    setItems(next.items);
    setCalories(next.calories);
    setProtein(next.protein);
    setCarb(next.carb);
    setFat(next.fat);
    setAiOriginalItems(next.items); // 修正後成為 AI 基準，儲存時 memory 學「使用者 vs 複核版」差異
    appliedSnapshot.current = snapshotOf(next);
    if (pendingVerifiedList) setPerPhotoReadings(pendingVerifiedList); // multipleMeals 分筆儲存用同步更新
    setPendingVerified(null);
    setPendingVerifiedList(null);
    setVerifyDiff(null);
    setVerifyState('verified');
  };

  const dismissVerifiedFix = () => {
    haptic.tapLight();
    setPendingVerified(null);
    setPendingVerifiedList(null);
    setVerifyDiff(null);
    setVerifyState('verified');
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
            loggedAt: loggedAt as any,
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

        <View className={`flex-row items-center mb-4 px-4 py-3 rounded-2xl border ${isPastDate ? 'bg-kibo-warning/15 border-kibo-warning' : 'bg-kibo-surface border-kibo-card'}`}>
          <Pressable
            onPress={() => { haptic.tapLight(); setTimePickerOpen(true); }}
            className="flex-1 flex-row items-center"
          >
            <Text className="text-kibo-mute text-xs mr-2">記錄到</Text>
            <Text className={`text-sm font-bold flex-1 ${isPastDate ? 'text-kibo-warning' : 'text-kibo-text'}`}>
              {format(loggedAt, 'yyyy/MM/dd HH:mm')} {isPastDate && '（補登記）'}
            </Text>
            <Text className="text-kibo-mute text-xs ml-2">⏰</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              setUserTouchedTime((v) => !v);
            }}
            className={`ml-2 px-2 py-1 rounded-full ${userTouchedTime ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
          >
            <Text className={`text-xs ${userTouchedTime ? 'text-kibo-bg' : 'text-kibo-mute'}`}>
              {userTouchedTime ? '🔒 鎖' : '🔄 同步'}
            </Text>
          </Pressable>
        </View>
        <Text className="text-kibo-mute text-[10px] mt-[-12] mb-3">
          {userTouchedTime ? '鎖定中：切換餐型不會改時間' : '同步中：切換餐型會自動套用該餐標準時間'}
        </Text>

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
                onPress={() => { haptic.tapLight(); setMergeMode('sameMeal'); parseSeq.current++; setAiParsed(false); setVerifyState('idle'); }}
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
                onPress={() => { haptic.tapLight(); setMergeMode('multipleMeals'); parseSeq.current++; setAiParsed(false); setVerifyState('idle'); }}
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
          {/* 拍攝模式：食物 / 營養標 */}
          <View className="flex-row gap-2 mb-3">
            <Pressable
              onPress={() => { haptic.tapLight(); setPhotoMode('meal'); parseSeq.current++; setAiParsed(false); setVerifyState('idle'); }}
              className={`flex-1 py-2 rounded-xl items-center ${photoMode === 'meal' ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
            >
              <Text className={`font-semibold text-sm ${photoMode === 'meal' ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                📷 食物（AI 估算）
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { haptic.tapLight(); setPhotoMode('label'); parseSeq.current++; setAiParsed(false); setVerifyState('idle'); }}
              className={`flex-1 py-2 rounded-xl items-center ${photoMode === 'label' ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
            >
              <Text className={`font-semibold text-sm ${photoMode === 'label' ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                📑 營養標（直接讀）
              </Text>
            </Pressable>
          </View>

          {photoMode === 'meal' && (
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
          )}

          <Pressable
            onPress={onAIParse}
            disabled={ocrLoading}
            className={`rounded-2xl py-4 mb-4 flex-row items-center justify-center gap-2 ${ocrLoading ? 'bg-kibo-card' : 'bg-kibo-accent'}`}
          >
            {ocrLoading ? (
              <>
                <ActivityIndicator color="#F1F5F9" />
                <Text className="text-kibo-text font-bold">
                  {photoMode === 'label' ? '讀取營養標中...' : `AI 初判中... ${photos.length > 1 ? `(${photos.length} 張${lowPower ? ' 序列' : ' 並行'})` : ''}`}
                </Text>
              </>
            ) : (
              <Text className="text-kibo-bg font-bold text-base">
                {photoMode === 'label'
                  ? '📑 讀取營養標'
                  : `🤖 AI 自動估營養 ${photos.length > 1 ? (mergeMode === 'sameMeal' ? `(${photos.length} 張取平均)` : `(${photos.length} 張分開記)`) : ''}`}
              </Text>
            )}
          </Pressable>
          </>
        )}

        {aiParsed && verifyState === 'verifying' && (
          <View className="flex-row items-center gap-2 mb-3">
            <ActivityIndicator size="small" color={palette.mute} />
            <Text className="text-kibo-mute text-xs">AI 複核中…（結果可先用，有差異會提示）</Text>
          </View>
        )}
        {aiParsed && verifyState === 'verified' && (
          <Text className="text-kibo-success text-xs mb-3">✓ 已複核</Text>
        )}
        {aiParsed && verifyState === 'diff' && verifyDiff && pendingVerified && (
          <View className="bg-kibo-surface border border-kibo-accent rounded-2xl p-3 mb-3">
            <Text className="text-kibo-text text-sm font-semibold mb-1">🔍 複核發現差異</Text>
            <Text className="text-kibo-mute text-xs mb-2">
              {formatDiffSummary(Number(calories) || 0, pendingVerified, verifyDiff)}
            </Text>
            <View className="flex-row gap-2">
              <Pressable onPress={applyVerifiedFix} className="flex-1 bg-kibo-primary rounded-xl py-2">
                <Text className="text-kibo-bg text-center text-sm font-bold">套用修正</Text>
              </Pressable>
              <Pressable onPress={dismissVerifiedFix} className="flex-1 bg-kibo-card rounded-xl py-2">
                <Text className="text-kibo-text text-center text-sm">保留原值</Text>
              </Pressable>
            </View>
          </View>
        )}

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

      <TimePickerModal
        visible={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        value={loggedAt}
        onSave={(d) => {
          setLoggedAt(d);
          setUserTouchedTime(true);
          setTimePickerOpen(false);
        }}
      />
    </View>
  );
}
