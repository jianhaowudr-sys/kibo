import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as healthRepo from '@/db/health_repo';
import { format } from 'date-fns';
import * as haptic from '@/lib/haptic';
import type { SleepLog } from '@/db/schema';
import { SwipeableRow } from '@/components/common/SwipeableRow';

export default function SleepHistory() {
  const palette = useThemePalette();
  const user = useAppStore((s) => s.user);
  const settings = useAppStore((s) => s.healthSettings);
  const refreshHealth = useAppStore((s) => s.refreshHealth);
  const pushUndo = useAppStore((s) => s.pushUndo);
  const [logs, setLogs] = useState<SleepLog[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await healthRepo.listSleepRecent(user.id, 14);
      setLogs(list);
    })();
  }, [user]);

  const target = settings.sleep.targetDurationMin;
  const max = Math.max(target * 1.2, ...logs.map((l) => l.durationMin));

  const last7 = logs.slice(0, 7).reverse();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: palette.text, fontSize: 24, fontWeight: '700' }}>
        最近 14 天 ({logs.length} 筆)
      </Text>

      <Text style={{ color: palette.mute, fontSize: 12, marginTop: 16, marginBottom: 8 }}>過去 7 天時長 vs 目標</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 140, marginBottom: 24 }}>
        {last7.map((l) => {
          const h = (l.durationMin / max) * 100;
          const color = l.durationMin >= target ? palette.success : l.durationMin >= target * 0.85 ? palette.accent : palette.danger;
          return (
            <View key={l.id} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}>
                <View style={{ height: `${h}%`, backgroundColor: color, borderRadius: 4, minHeight: 2 }} />
              </View>
              <Text style={{ color: palette.mute, fontSize: 10, marginTop: 4 }}>{l.dayKey.slice(5)}</Text>
            </View>
          );
        })}
      </View>

      {logs.map((l) => {
        const bed = l.bedtimeAt instanceof Date ? l.bedtimeAt : new Date(l.bedtimeAt);
        const wake = l.wakeAt instanceof Date ? l.wakeAt : new Date(l.wakeAt);
        return (
          <SwipeableRow
            key={l.id}
            onDelete={async () => {
              const snapshot = { ...l };
              await healthRepo.deleteSleep(l.id);
              setLogs((prev) => prev.filter((x) => x.id !== l.id));
              await refreshHealth();
              pushUndo({
                id: `sleep-restore-${l.id}`,
                type: 'sleep',
                message: '已刪除睡眠紀錄',
                undo: async () => {
                  await healthRepo.upsertSleep({
                    userId: snapshot.userId,
                    bedtimeAt: +new Date(snapshot.bedtimeAt as any),
                    wakeAt: +new Date(snapshot.wakeAt as any),
                    quality: snapshot.quality,
                  });
                  await refreshHealth();
                  setLogs(await healthRepo.listSleepRecent(snapshot.userId, 14));
                },
              });
            }}
          >
            <View style={{
              backgroundColor: palette.surface, padding: 12,
              borderRadius: 12, marginBottom: 6,
              borderWidth: 1, borderColor: palette.card,
            }}>
              <Text style={{ color: palette.text, fontWeight: '700' }}>{l.dayKey}</Text>
              <Text style={{ color: palette.mute, fontSize: 12, marginTop: 4 }}>
                {format(bed, 'HH:mm')} → {format(wake, 'HH:mm')} · {Math.floor(l.durationMin / 60)}h {l.durationMin % 60}m
              </Text>
            </View>
          </SwipeableRow>
        );
      })}
    </ScrollView>
  );
}
