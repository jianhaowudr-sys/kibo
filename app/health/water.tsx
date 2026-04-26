import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as healthRepo from '@/db/health_repo';
import { format } from 'date-fns';
import * as haptic from '@/lib/haptic';
import { SwipeableRow } from '@/components/common/SwipeableRow';

export default function WaterHistory() {
  const palette = useThemePalette();
  const user = useAppStore((s) => s.user);
  const refreshHealth = useAppStore((s) => s.refreshHealth);
  const waterToday = useAppStore((s) => s.waterToday);
  const settings = useAppStore((s) => s.healthSettings);
  const [last7, setLast7] = useState<{ key: string; total: number }[]>([]);

  const total = waterToday.reduce((s, w) => s + w.amountMl, 0);
  const pushUndo = useAppStore((s) => s.pushUndo);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const days: { key: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const logs = await healthRepo.listWaterBetween(user.id, d.getTime(), next.getTime());
        const sum = logs.reduce((s, w) => s + w.amountMl, 0);
        days.push({ key: format(d, 'M/d'), total: sum });
      }
      setLast7(days);
    })();
  }, [user, waterToday]);

  const max = Math.max(settings.water.dailyGoalMl, ...last7.map((d) => d.total));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: palette.text, fontSize: 24, fontWeight: '700' }}>
        {(total / 1000).toFixed(2)}L / {(settings.water.dailyGoalMl / 1000).toFixed(1)}L
      </Text>
      <Text style={{ color: palette.mute, marginTop: 4, marginBottom: 16 }}>今日總攝取</Text>

      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>過去 7 天</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120, marginBottom: 24 }}>
        {last7.map((d) => {
          const h = max > 0 ? (d.total / max) * 100 : 0;
          return (
            <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}>
                <View style={{ height: `${h}%`, backgroundColor: '#29adff', borderRadius: 4, minHeight: 2 }} />
              </View>
              <Text style={{ color: palette.mute, fontSize: 10, marginTop: 4 }}>{d.key}</Text>
            </View>
          );
        })}
      </View>

      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>今日明細 ({waterToday.length})</Text>
      {waterToday.map((w) => {
        const ts = w.loggedAt instanceof Date ? w.loggedAt : new Date(w.loggedAt);
        return (
          <SwipeableRow
            key={w.id}
            onDelete={async () => {
              const snapshot = { ...w };
              await healthRepo.deleteWater(w.id);
              await refreshHealth();
              pushUndo({
                id: `water-restore-${w.id}`,
                type: 'water',
                message: `已刪除 +${w.amountMl}ml`,
                undo: async () => {
                  await healthRepo.addWater({
                    userId: snapshot.userId,
                    amountMl: snapshot.amountMl,
                    loggedAt: +new Date(snapshot.loggedAt as any),
                    batchKey: snapshot.batchKey ?? undefined,
                  });
                  await refreshHealth();
                },
              });
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: palette.surface,
                padding: 12,
                borderRadius: 12,
                marginBottom: 6,
                borderWidth: 1,
                borderColor: palette.card,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>+{w.amountMl} ml</Text>
              <Text style={{ color: palette.mute, fontSize: 12 }}>{format(ts, 'HH:mm')}</Text>
            </View>
          </SwipeableRow>
        );
      })}
      {waterToday.length === 0 && (
        <Text style={{ color: palette.mute, textAlign: 'center', marginTop: 12 }}>今天還沒喝水</Text>
      )}
    </ScrollView>
  );
}
