import { View, Text, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { displayTime, dateKey, displayDate } from '@/lib/date';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import * as haptic from '@/lib/haptic';
import * as repo from '@/db/repo';
import type { MealType, Meal } from '@/db/schema';

const MEAL_META: Record<MealType, { label: string; emoji: string }> = {
  breakfast: { label: '早餐', emoji: '🌅' },
  lunch: { label: '午餐', emoji: '🍱' },
  dinner: { label: '晚餐', emoji: '🌙' },
  snack: { label: '點心', emoji: '🍪' },
};

export default function DietScreen() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const todayMealsStore = useAppStore((s) => s.todayMeals);
  const todayNutritionStore = useAppStore((s) => s.todayNutrition);
  const refreshToday = useAppStore((s) => s.refreshTodayMeals);
  const removeMeal = useAppStore((s) => s.deleteMeal);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const selectedKey = useMemo(() => dateKey(selectedDate), [selectedDate]);
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const viewingToday = selectedKey === todayKey;

  const [pastMeals, setPastMeals] = useState<Meal[]>([]);
  const [pastNutrition, setPastNutrition] = useState({ calories: 0, protein: 0, carb: 0, fat: 0, count: 0 });

  useEffect(() => {
    if (viewingToday) {
      refreshToday();
    }
  }, [viewingToday, refreshToday]);

  useEffect(() => {
    if (!user || viewingToday) return;
    (async () => {
      const [meals, nutri] = await Promise.all([
        repo.listMealsByDate(user.id, selectedKey),
        repo.dailyNutritionTotals(user.id, selectedKey),
      ]);
      setPastMeals(meals);
      setPastNutrition(nutri);
    })();
  }, [user, selectedKey, viewingToday]);

  const meals = viewingToday ? todayMealsStore : pastMeals;
  const nutrition = viewingToday ? todayNutritionStore : pastNutrition;

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewingToday) {
      await refreshToday();
    } else if (user) {
      const [m, n] = await Promise.all([
        repo.listMealsByDate(user.id, selectedKey),
        repo.dailyNutritionTotals(user.id, selectedKey),
      ]);
      setPastMeals(m);
      setPastNutrition(n);
    }
    setRefreshing(false);
  };

  if (!user) return null;

  const calGoal = user.dailyCaloriesGoal || 2000;
  const proteinGoal = user.dailyProteinGoal || 100;
  const calPct = Math.min(1, nutrition.calories / calGoal);
  const proteinPct = Math.min(1, nutrition.protein / proteinGoal);

  const grouped = meals.reduce<Record<MealType, typeof meals>>((acc, m) => {
    const t = m.mealType as MealType;
    if (!acc[t]) acc[t] = [];
    acc[t].push(m);
    return acc;
  }, { breakfast: [], lunch: [], dinner: [], snack: [] });

  const onAdd = (mealType?: MealType) => {
    haptic.tapMedium();
    router.push({
      pathname: '/diet/new' as any,
      params: mealType ? { type: mealType } : {},
    });
  };

  const onDelete = (id: number) => {
    Alert.alert('刪除這餐？', '', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await removeMeal(id);
          if (!viewingToday && user) {
            const [m, n] = await Promise.all([
              repo.listMealsByDate(user.id, selectedKey),
              repo.dailyNutritionTotals(user.id, selectedKey),
            ]);
            setPastMeals(m);
            setPastNutrition(n);
          }
        },
      },
    ]);
  };

  const goPrevDay = () => {
    haptic.tapLight();
    setSelectedDate((d) => addDays(d, -1));
  };

  const goNextDay = () => {
    if (viewingToday) return;
    haptic.tapLight();
    setSelectedDate((d) => {
      const next = addDays(d, 1);
      return next > new Date() ? new Date() : next;
    });
  };

  const goToday = () => {
    if (viewingToday) return;
    haptic.tapLight();
    setSelectedDate(new Date());
  };

  const dateLabel = isToday(selectedDate)
    ? '今天'
    : isSameDay(selectedDate, addDays(new Date(), -1))
    ? '昨天'
    : format(selectedDate, 'M/d EEE');

  return (
    <View className="flex-1 bg-kibo-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22D3EE" />}
      >
        {/* 日期切換條 */}
        <View className="flex-row items-center justify-between bg-kibo-surface rounded-2xl px-2 py-2 border border-kibo-card mb-3">
          <Pressable onPress={goPrevDay} hitSlop={8} className="px-3 py-1.5 rounded-lg active:opacity-60">
            <Text className="text-kibo-text text-lg">‹</Text>
          </Pressable>
          <Pressable onPress={goToday} hitSlop={8} className="flex-1 items-center">
            <Text className="text-kibo-text font-bold text-base">{dateLabel}</Text>
            <Text className="text-kibo-mute text-[10px] mt-0.5">{format(selectedDate, 'yyyy/MM/dd')}</Text>
          </Pressable>
          <Pressable
            onPress={goNextDay}
            hitSlop={8}
            disabled={viewingToday}
            className={`px-3 py-1.5 rounded-lg active:opacity-60 ${viewingToday ? 'opacity-30' : ''}`}
          >
            <Text className="text-kibo-text text-lg">›</Text>
          </Pressable>
        </View>
        {!viewingToday && (
          <Pressable onPress={goToday} className="self-end px-3 py-1 rounded-full bg-kibo-card mb-3 active:opacity-70">
            <Text className="text-kibo-primary text-xs font-semibold">回今天 →</Text>
          </Pressable>
        )}

        <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
          <Text className="text-kibo-mute text-xs mb-3">{viewingToday ? '今日攝取' : `${dateLabel}攝取`}</Text>
          <View className="flex-row items-baseline justify-between mb-1">
            <Text className="text-kibo-text text-sm">熱量</Text>
            <Text className="text-kibo-text font-bold">
              {Math.round(nutrition.calories)} / {calGoal} <Text className="text-kibo-mute text-xs">kcal</Text>
            </Text>
          </View>
          <View className="h-3 bg-kibo-card rounded-full overflow-hidden mb-3">
            <View
              className={`h-3 rounded-full ${calPct >= 1 ? 'bg-kibo-danger' : 'bg-kibo-primary'}`}
              style={{ width: `${calPct * 100}%` }}
            />
          </View>

          <View className="flex-row items-baseline justify-between mb-1">
            <Text className="text-kibo-text text-sm">蛋白質</Text>
            <Text className="text-kibo-text font-bold">
              {Math.round(nutrition.protein)} / {proteinGoal} <Text className="text-kibo-mute text-xs">g</Text>
            </Text>
          </View>
          <View className="h-3 bg-kibo-card rounded-full overflow-hidden mb-3">
            <View
              className={`h-3 rounded-full ${proteinPct >= 1 ? 'bg-kibo-success' : 'bg-kibo-accent'}`}
              style={{ width: `${proteinPct * 100}%` }}
            />
          </View>

          <View className="flex-row gap-4 pt-2 border-t border-kibo-card">
            <View>
              <Text className="text-kibo-mute text-[10px]">碳水</Text>
              <Text className="text-kibo-text text-sm font-bold">{Math.round(nutrition.carb)}g</Text>
            </View>
            <View>
              <Text className="text-kibo-mute text-[10px]">脂肪</Text>
              <Text className="text-kibo-text text-sm font-bold">{Math.round(nutrition.fat)}g</Text>
            </View>
            <View className="ml-auto">
              <Text className="text-kibo-mute text-[10px]">紀錄</Text>
              <Text className="text-kibo-text text-sm font-bold">{nutrition.count} 餐</Text>
            </View>
          </View>
        </View>

        {viewingToday && (
          <Pressable
            onPress={() => onAdd()}
            className="bg-kibo-primary rounded-2xl py-4 mb-4 active:opacity-70"
          >
            <Text className="text-kibo-bg text-center font-bold">📷 拍照記錄一餐</Text>
            <Text className="text-kibo-bg/70 text-center text-xs mt-1">AI 自動估熱量/蛋白質</Text>
          </Pressable>
        )}

        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => {
          const ms = grouped[type] ?? [];
          const total = ms.reduce((s, m) => s + (m.caloriesKcal ?? 0), 0);
          const meta = MEAL_META[type];
          return (
            <View key={type} className="mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xl">{meta.emoji}</Text>
                  <Text className="text-kibo-text font-bold">{meta.label}</Text>
                  {ms.length > 0 && (
                    <Text className="text-kibo-mute text-xs">
                      · {total} kcal
                    </Text>
                  )}
                </View>
                {viewingToday && (
                  <Pressable onPress={() => onAdd(type)} className="p-1">
                    <Text className="text-kibo-primary text-sm">＋ 加</Text>
                  </Pressable>
                )}
              </View>

              {ms.length === 0 && (
                <View className="bg-kibo-surface rounded-xl p-3 border border-kibo-card">
                  <Text className="text-kibo-mute text-xs text-center">沒有紀錄</Text>
                </View>
              )}

              {ms.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    haptic.tapLight();
                    router.push({ pathname: '/diet/[id]' as any, params: { id: String(m.id) } });
                  }}
                  onLongPress={() => onDelete(m.id)}
                  className="bg-kibo-surface rounded-xl p-3 border border-kibo-card mb-2 flex-row items-center gap-3 active:opacity-70"
                >
                  <Text className="text-2xl">🍽</Text>
                  <View className="flex-1">
                    <Text className="text-kibo-text font-semibold text-sm" numberOfLines={1}>
                      {m.title || '一餐'}
                    </Text>
                    <Text className="text-kibo-mute text-[10px] mt-0.5">
                      {displayTime(m.loggedAt)}
                      {m.aiParsed && ' · 🤖 AI 判讀'}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-kibo-accent font-bold text-sm">
                      {m.caloriesKcal ?? 0} kcal
                    </Text>
                    <Text className="text-kibo-mute text-[10px]">
                      蛋白 {Math.round(m.proteinG ?? 0)}g
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
