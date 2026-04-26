import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { evaluateTrinity } from '@/lib/daily_trinity';

export function DailyTrinityCard() {
  const palette = useThemePalette();
  // 注意：selector 只回傳原 reference，filter/map 一律放元件內 useMemo（避免無限 re-render）
  const recentWorkouts = useAppStore((s) => s.recentWorkouts);
  const todayMeals = useAppStore((s) => s.todayMeals);
  const todayWater = useAppStore((s) => s.waterToday);
  const todayBowel = useAppStore((s) => s.bowelToday);
  const sleepLast = useAppStore((s) => s.sleepLast);
  const periodRecent = useAppStore((s) => s.periodRecent);
  const settings = useAppStore((s) => s.healthSettings);
  const user = useAppStore((s) => s.user);
  const tokens = useAppStore((s) => s.streakFreezeTokens);

  const todayWorkouts = useMemo(
    () => recentWorkouts.filter((w: any) => {
      const d = new Date(w.startedAt);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }),
    [recentWorkouts]
  );

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const todayPeriodDays = useMemo(
    () => periodRecent.filter((p) => p.dayKey === todayKey),
    [periodRecent, todayKey]
  );

  const trinity = evaluateTrinity({
    todayWorkouts: todayWorkouts as any,
    todayMeals,
    todayWater,
    waterGoalMl: settings.water.dailyGoalMl,
    todayBowel,
    sleepLast,
    todayPeriodDays: todayPeriodDays as any,
  });

  const Circle = ({ filled, label, emoji }: any) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View
        style={{
          width: 56, height: 56, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: filled ? palette.success : palette.card,
          borderWidth: 2, borderColor: filled ? palette.success : palette.mute,
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 24 }}>{filled ? '✓' : emoji}</Text>
      </View>
      <Text style={{ color: filled ? palette.success : palette.mute, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  return (
    <View style={{
      backgroundColor: palette.surface, padding: 14, borderRadius: 16,
      borderWidth: 1, borderColor: palette.card, marginBottom: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>
          🔥 連續 {user?.streak ?? 0} 天 · 補課券 ×{tokens}
        </Text>
        {trinity.complete && <Text style={{ color: palette.success, fontWeight: '700' }}>🎉 全達成</Text>}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Circle filled={trinity.move} label="動" emoji="💪" />
        <Circle filled={trinity.eat} label="食" emoji="🍱" />
        <Circle filled={trinity.rest} label="息" emoji="😴" />
      </View>
    </View>
  );
}

export default DailyTrinityCard;
