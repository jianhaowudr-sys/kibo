import { View, Text, ScrollView, Image, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as repo from '@/db/repo';
import { useAppStore } from '@/stores/useAppStore';
import { displayDateTime } from '@/lib/date';
import * as haptic from '@/lib/haptic';
import type { Meal, MealItem, MealType } from '@/db/schema';

const MEAL_META: Record<MealType, { label: string; emoji: string }> = {
  breakfast: { label: '早餐', emoji: '🌅' },
  lunch: { label: '午餐', emoji: '🍱' },
  dinner: { label: '晚餐', emoji: '🌙' },
  snack: { label: '點心', emoji: '🍪' },
};

export default function MealDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<Meal | null>(null);
  const deleteFn = useAppStore((s) => s.deleteMeal);

  useEffect(() => {
    (async () => {
      const r = await repo.getMeal(Number(id));
      setM(r);
    })();
  }, [id]);

  if (!m) return null;

  const items: MealItem[] = m.itemsJson ? (() => {
    try { return JSON.parse(m.itemsJson); } catch { return []; }
  })() : [];

  const meta = MEAL_META[m.mealType as MealType];

  const onDelete = () => {
    Alert.alert('刪除這餐？', '', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await deleteFn(m.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-2xl">{meta?.emoji ?? '🍽'}</Text>
          <Text className="text-kibo-primary text-sm font-semibold">{meta?.label ?? m.mealType}</Text>
          {m.aiParsed && (
            <View className="bg-kibo-accent/20 rounded-full px-2 py-0.5 ml-1">
              <Text className="text-kibo-accent text-[10px]">🤖 AI 判讀</Text>
            </View>
          )}
        </View>
        <Text className="text-kibo-text text-lg font-bold">{m.title || '一餐'}</Text>
        <Text className="text-kibo-mute text-xs mt-1">{displayDateTime(m.loggedAt)}</Text>
      </View>

      {m.photoUri && (
        <Image
          source={{ uri: m.photoUri }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, marginBottom: 16 }}
          resizeMode="cover"
        />
      )}

      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center">
          <Text className="text-kibo-mute text-[10px]">熱量</Text>
          <Text className="text-kibo-primary text-xl font-bold">{m.caloriesKcal ?? 0}</Text>
          <Text className="text-kibo-mute text-[10px]">kcal</Text>
        </View>
        <View className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center">
          <Text className="text-kibo-mute text-[10px]">蛋白質</Text>
          <Text className="text-kibo-success text-xl font-bold">{Math.round(m.proteinG ?? 0)}</Text>
          <Text className="text-kibo-mute text-[10px]">g</Text>
        </View>
        <View className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center">
          <Text className="text-kibo-mute text-[10px]">碳水</Text>
          <Text className="text-kibo-text text-xl font-bold">{Math.round(m.carbG ?? 0)}</Text>
          <Text className="text-kibo-mute text-[10px]">g</Text>
        </View>
        <View className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center">
          <Text className="text-kibo-mute text-[10px]">脂肪</Text>
          <Text className="text-kibo-text text-xl font-bold">{Math.round(m.fatG ?? 0)}</Text>
          <Text className="text-kibo-mute text-[10px]">g</Text>
        </View>
      </View>

      {items.length > 0 && (
        <>
          <Text className="text-kibo-text text-base font-bold mb-2">食物明細</Text>
          <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card mb-4">
            {items.map((it, i) => (
              <View key={i} className={`py-2 ${i > 0 ? 'border-t border-kibo-card' : ''}`}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-kibo-text font-semibold text-sm">{it.name}</Text>
                    {it.portion && <Text className="text-kibo-mute text-xs">{it.portion}</Text>}
                  </View>
                  <Text className="text-kibo-accent text-sm font-semibold">{it.calories} kcal</Text>
                </View>
                <View className="flex-row gap-3 mt-1">
                  <Text className="text-kibo-mute text-[10px]">蛋白 {it.protein}g</Text>
                  <Text className="text-kibo-mute text-[10px]">碳水 {it.carb}g</Text>
                  <Text className="text-kibo-mute text-[10px]">脂肪 {it.fat}g</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {m.note && (
        <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
          <Text className="text-kibo-mute text-xs mb-1">備註</Text>
          <Text className="text-kibo-text">{m.note}</Text>
        </View>
      )}

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => { haptic.tapLight(); router.push(`/diet/edit/${m.id}` as any); }}
          className="flex-1 bg-kibo-primary rounded-2xl py-3"
        >
          <Text className="text-kibo-bg text-center font-bold">✎ 編輯</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          className="flex-1 bg-kibo-danger/20 border border-kibo-danger rounded-2xl py-3"
        >
          <Text className="text-kibo-danger text-center font-semibold">🗑 刪除</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
