import React from 'react';
import { View, Text } from 'react-native';
import { format } from 'date-fns';
import { useThemePalette } from '@/lib/useThemePalette';
import type { PetMessage } from '@/db/schema';
import type { WeeklyReviewData, MetricDelta } from '@/lib/weekly_review_core';

function Tile({ label, value, color, palette, delta, format }: { label: string; value: string; color?: string; palette: any; delta?: MetricDelta; format?: (n: number) => string }) {
  const arrow = delta ? (delta.dir === 'up' ? '↑' : delta.dir === 'down' ? '↓' : '→') : null;
  const deltaText = delta
    ? delta.dir === 'flat'
      ? '→ 持平'
      : `${arrow} ${format ? format(Math.abs(delta.diff)) : Math.abs(delta.diff)}`
    : null;
  return (
    <View style={{ flex: 1, backgroundColor: palette.card, borderRadius: 8, padding: 8 }}>
      <Text style={{ color: palette.mute, fontSize: 10 }}>{label}</Text>
      <Text style={{ color: color ?? palette.text, fontSize: 16, fontWeight: '700', marginTop: 2 }}>{value}</Text>
      {deltaText != null && (
        <Text style={{ color: palette.mute, fontSize: 10, marginTop: 1 }}>{deltaText}</Text>
      )}
    </View>
  );
}

export function WeeklyReviewBlock({ message }: { message: PetMessage }) {
  const palette = useThemePalette();
  const ts = message.generatedAt instanceof Date ? message.generatedAt : new Date(message.generatedAt);

  let data: WeeklyReviewData | null = null;
  try {
    if (message.triggerData) data = JSON.parse(message.triggerData) as WeeklyReviewData;
  } catch {
    data = null;
  }

  const containerStyle = {
    backgroundColor: palette.surface, padding: 12, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: palette.card,
  } as const;

  // triggerData 缺失/壞掉（含部分欄位缺失）→ 只顯示標題文字
  if (!data || typeof data.weekStartKey !== 'string' || typeof data.workoutCount !== 'number') {
    return (
      <View style={containerStyle}>
        <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 4 }}>{format(ts, 'M/d HH:mm')} · 週回顧</Text>
        <Text style={{ color: palette.text, fontSize: 14 }}>📊 {message.text}</Text>
      </View>
    );
  }

  const waterL = (data.waterDailyAvgMl / 1000).toFixed(1); // 與 pickHighlight 同步：統一 1 位小數
  const d = data.deltas;
  const row1 = [
    { label: '訓練', value: `${data.workoutCount} 次`, color: palette.success, delta: d?.workoutCount, format: (n: number) => `${n} 次` },
    { label: '睡眠均', value: `${data.sleepHoursAvg}h`, color: palette.primary, delta: d?.sleepHoursAvg, format: (n: number) => `${n.toFixed(1)}h` },
    { label: '熱量均', value: `${data.calorieAvg}`, delta: d?.calorieAvg, format: (n: number) => `${n}` },
  ];
  const row2 = [
    { label: '蛋白質均', value: `${data.proteinAvg}g`, delta: d?.proteinAvg, format: (n: number) => `${n}g` },
    { label: '喝水均', value: `${waterL}L`, delta: d?.waterDailyAvgMl, format: (n: number) => `${(n / 1000).toFixed(1)}L` },
    { label: '飲食天數', value: `${data.mealDays} 天`, delta: d?.mealDays, format: (n: number) => `${n} 天` },
  ];

  return (
    <View style={containerStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
        <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{message.text}</Text>
      </View>
      <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 8 }}>
        本週回顧 · {data.weekStartKey.slice(5)}–{data.weekEndKey.slice(5)} · {format(ts, 'M/d')}
      </Text>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {row1.map((t, i) => <Tile key={i} {...t} palette={palette} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {row2.map((t, i) => <Tile key={i} {...t} palette={palette} />)}
        </View>
      </View>
    </View>
  );
}

export default WeeklyReviewBlock;
