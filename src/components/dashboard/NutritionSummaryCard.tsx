import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';

export function NutritionSummaryCard() {
  const palette = useThemePalette();
  const router = useRouter();
  const today = useAppStore((s) => s.todayNutrition);
  const user = useAppStore((s) => s.user);

  const goalCal = user?.dailyCaloriesGoal ?? 2000;
  const goalP = user?.dailyProteinGoal ?? 100;
  const calPct = Math.min(1, today.calories / goalCal);
  const pPct = Math.min(1, today.protein / goalP);

  return (
    <Pressable
      onPress={() => { haptic.tapLight(); router.push('/(tabs)/diet' as any); }}
      style={{
        backgroundColor: palette.surface, padding: 12, borderRadius: 16,
        borderWidth: 1, borderColor: palette.card, marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 6 }}>🥗</Text>
        <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>今日飲食</Text>
        <Text style={{ color: palette.mute, fontSize: 11 }}>{today.count} 餐</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.mute, fontSize: 10 }}>熱量</Text>
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
            {Math.round(today.calories)} / {goalCal}
          </Text>
          <View style={{ height: 4, backgroundColor: palette.card, borderRadius: 2, marginTop: 4 }}>
            <View style={{ width: `${calPct * 100}%`, height: 4, backgroundColor: palette.primary, borderRadius: 2 }} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.mute, fontSize: 10 }}>蛋白質</Text>
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
            {Math.round(today.protein)} / {goalP}g
          </Text>
          <View style={{ height: 4, backgroundColor: palette.card, borderRadius: 2, marginTop: 4 }}>
            <View style={{ width: `${pPct * 100}%`, height: 4, backgroundColor: palette.success, borderRadius: 2 }} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default NutritionSummaryCard;
