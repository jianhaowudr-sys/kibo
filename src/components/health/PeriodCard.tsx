import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import { computeCyclePrediction } from '@/lib/period_predict';
import * as haptic from '@/lib/haptic';
import { TutorialTip } from '@/components/common/TutorialTip';
import { format } from 'date-fns';

type Props = { mode?: 'compact' | 'full' };

export function PeriodCard({ mode = 'full' }: Props) {
  const palette = useThemePalette();
  const router = useRouter();
  const periodRecent = useAppStore((s) => s.periodRecent);
  const settings = useAppStore((s) => s.healthSettings);
  const upsertPeriodDay = useAppStore((s) => s.upsertPeriodDay);

  const pred = useMemo(
    () => computeCyclePrediction(periodRecent, {
      avgCycleDays: settings.period.avgCycleDays,
      avgPeriodDays: settings.period.avgPeriodDays,
    }),
    [periodRecent, settings.period.avgCycleDays, settings.period.avgPeriodDays],
  );

  const startCycle = async () => {
    haptic.success();
    await upsertPeriodDay({ date: Date.now(), flow: 'medium', isCycleStart: true });
  };

  const logToday = async () => {
    haptic.tapMedium();
    await upsertPeriodDay({ date: Date.now(), flow: 'medium' });
  };

  const bg = pred.isPmsWindow ? '#ffd0e0' : palette.surface;

  if (mode === 'compact') {
    const onCompactTap = pred.isOnPeriod ? logToday : startCycle;
    const label = pred.isOnPeriod ? `第 ${pred.dayOfPeriod} 天 · 記錄` : '🌸 開始 / 記錄';
    return (
      <Pressable
        onLongPress={() => router.push('/health/period' as any)}
        delayLongPress={LONG_PRESS_MS}
        style={{ flex: 1, backgroundColor: bg, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: palette.card }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 18, marginRight: 6 }}>🌸</Text>
          <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {pred.isOnPeriod ? `第 ${pred.dayOfPeriod} 天` : pred.daysUntilNext != null ? `${pred.daysUntilNext} 天後` : '開始追蹤'}
          </Text>
        </View>
        <Pressable
          onPress={onCompactTap}
          style={{ backgroundColor: palette.accent, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 12 }}>{label}</Text>
        </Pressable>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={() => router.push('/health/period' as any)}
      delayLongPress={LONG_PRESS_MS}
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: palette.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 6 }}>🌸</Text>
        {pred.isOnPeriod ? (
          <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            第 {pred.dayOfPeriod} 天
          </Text>
        ) : pred.lastStartMs ? (
          <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            預估還 {pred.daysUntilNext} 天
          </Text>
        ) : (
          <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            開始追蹤
          </Text>
        )}
      </View>

      <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 8 }}>
        {pred.predictedNextMs
          ? `下次 ${format(pred.predictedNextMs, 'M/d')}${pred.cyclesKnown < 3 ? '（資料不足）' : ''}`
          : '尚未記錄第一次週期'}
      </Text>

      {pred.isOnPeriod ? (
        <Pressable
          onPress={logToday}
          style={{ backgroundColor: palette.primary, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 12 }}>今天記錄</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={startCycle}
          style={{ backgroundColor: palette.accent, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 12 }}>🌸 經期開始</Text>
        </Pressable>
      )}

      <TutorialTip id="period-cycle-start" delay={2500} />
    </Pressable>
  );
}

export default PeriodCard;
