import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { computeCyclePrediction } from '@/lib/period_predict';
import * as healthRepo from '@/db/health_repo';
import { format } from 'date-fns';
import * as haptic from '@/lib/haptic';
import { SwipeableRow } from '@/components/common/SwipeableRow';

const FLOW_COLOR: Record<string, string> = {
  spot: '#fdb4d6',
  light: '#ff9bbf',
  medium: '#ff77a8',
  heavy: '#cc4477',
};

export default function PeriodHistory() {
  const palette = useThemePalette();
  const periodRecent = useAppStore((s) => s.periodRecent);
  const settings = useAppStore((s) => s.healthSettings);
  const refreshHealth = useAppStore((s) => s.refreshHealth);
  const pushUndo = useAppStore((s) => s.pushUndo);
  const upsertPeriodDay = useAppStore((s) => s.upsertPeriodDay);

  const pred = useMemo(
    () => computeCyclePrediction(periodRecent, {
      avgCycleDays: settings.period.avgCycleDays,
      avgPeriodDays: settings.period.avgPeriodDays,
    }),
    [periodRecent, settings.period.avgCycleDays, settings.period.avgPeriodDays],
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.card, marginBottom: 16 }}>
        <Text style={{ color: palette.mute, fontSize: 12 }}>當前狀態</Text>
        <Text style={{ color: palette.text, fontSize: 20, fontWeight: '700', marginTop: 4 }}>
          {pred.isOnPeriod ? `經期中（第 ${pred.dayOfPeriod} 天）` : pred.predictedNextMs ? `下次預估還 ${pred.daysUntilNext} 天` : '尚未開始追蹤'}
        </Text>
        <Text style={{ color: palette.mute, fontSize: 12, marginTop: 8 }}>
          平均週期 {pred.avgCycleDays} 天 · 已知 {pred.cyclesKnown} 個週期
          {pred.cyclesKnown < 3 && '（資料不足，預測僅供參考）'}
        </Text>
      </View>

      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>記錄明細（最近 90 天）</Text>
      {periodRecent.map((p) => {
        const date = p.date instanceof Date ? p.date : new Date(p.date);
        return (
          <SwipeableRow
            key={p.id}
            onDelete={async () => {
              const snapshot = { ...p };
              await healthRepo.deletePeriodDay(p.id);
              await refreshHealth();
              pushUndo({
                id: `period-restore-${p.id}`,
                type: 'period',
                message: '已刪除經期紀錄',
                undo: async () => {
                  await upsertPeriodDay({
                    date: +new Date(snapshot.date as any),
                    flow: snapshot.flow as any,
                    notes: snapshot.notes ?? undefined,
                    isCycleStart: !!snapshot.isCycleStart,
                  });
                  await refreshHealth();
                },
              });
            }}
          >
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: palette.surface, padding: 12,
              borderRadius: 12, marginBottom: 6,
              borderWidth: 1, borderColor: palette.card,
            }}>
              <View style={{ width: 8, height: 28, borderRadius: 2, backgroundColor: FLOW_COLOR[p.flow] ?? palette.accent, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>{format(date, 'yyyy/M/d')} · {p.flow}</Text>
                {!!p.isCycleStart && <Text style={{ color: palette.accent, fontSize: 11 }}>新週期第一天</Text>}
                {p.notes && <Text style={{ color: palette.mute, fontSize: 11 }}>{p.notes}</Text>}
              </View>
            </View>
          </SwipeableRow>
        );
      })}
      {periodRecent.length === 0 && (
        <Text style={{ color: palette.mute, textAlign: 'center', marginTop: 12 }}>尚無紀錄</Text>
      )}
    </ScrollView>
  );
}
