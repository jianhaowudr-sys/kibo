import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useThemePalette } from '@/lib/useThemePalette';
import { useAppStore } from '@/stores/useAppStore';
import * as repo from '@/db/repo';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';
import type { MealType, MealItem, Meal } from '@/db/schema';

const MEAL_OPTIONS: { code: MealType; label: string; emoji: string }[] = [
  { code: 'breakfast', label: '早餐', emoji: '🌅' },
  { code: 'lunch', label: '午餐', emoji: '🍱' },
  { code: 'dinner', label: '晚餐', emoji: '🌙' },
  { code: 'snack', label: '點心', emoji: '🍪' },
];

export default function EditMeal() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealId = Number(id);
  const updateMealById = useAppStore((s) => s.updateMealById);

  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    (async () => {
      const m = await repo.getMeal(mealId);
      if (!m) {
        router.back();
        return;
      }
      setMeal(m);
      setMealType(m.mealType as MealType);
      setTitle(m.title ?? '');
      setItems(m.itemsJson ? (() => { try { return JSON.parse(m.itemsJson!); } catch { return []; } })() : []);
      setCalories(String(m.caloriesKcal ?? ''));
      setProtein(String(m.proteinG ?? ''));
      setCarb(String(m.carbG ?? ''));
      setFat(String(m.fatG ?? ''));
      setNote(m.note ?? '');
    })();
  }, [mealId]);

  const removeItem = (idx: number) => {
    haptic.tapLight();
    const list = items.filter((_, i) => i !== idx);
    setItems(list);
    setCalories(String(list.reduce((s, x) => s + (x.calories || 0), 0)));
    setProtein(String(Math.round(list.reduce((s, x) => s + (x.protein || 0), 0) * 10) / 10));
    setCarb(String(Math.round(list.reduce((s, x) => s + (x.carb || 0), 0) * 10) / 10));
    setFat(String(Math.round(list.reduce((s, x) => s + (x.fat || 0), 0) * 10) / 10));
  };

  const onSave = async () => {
    haptic.tapMedium();
    try {
      await updateMealById(mealId, {
        mealType,
        title: title.trim() || null,
        itemsJson: items.length > 0 ? JSON.stringify(items) : null,
        caloriesKcal: calories ? Number(calories) : null,
        proteinG: protein ? Number(protein) : null,
        carbG: carb ? Number(carb) : null,
        fatG: fat ? Number(fat) : null,
        note: note.trim() || null,
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error();
      Alert.alert('儲存失敗', e?.message ?? String(e));
    }
  };

  if (!meal) return null;

  return (
    <View className="flex-1 bg-kibo-bg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}>
        <Text className="text-kibo-mute text-xs mb-2">餐別</Text>
        <View className="flex-row gap-2 mb-4">
          {MEAL_OPTIONS.map((m) => (
            <Pressable
              key={m.code}
              onPress={() => { haptic.tapLight(); setMealType(m.code); }}
              className={`flex-1 py-2 rounded-xl ${mealType === m.code ? 'bg-kibo-primary' : 'bg-kibo-surface border border-kibo-card'}`}
            >
              <Text className={`text-center text-xs ${mealType === m.code ? 'text-kibo-bg font-bold' : 'text-kibo-text'}`}>
                {m.emoji} {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-kibo-mute text-xs mb-2">名稱</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="例如：午餐｜雞腿便當"
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
        <Pressable onPress={onSave} className="flex-1 bg-kibo-primary rounded-2xl py-4">
          <Text className="text-kibo-bg text-center font-bold text-lg">儲存</Text>
        </Pressable>
      </View>
    </View>
  );
}
