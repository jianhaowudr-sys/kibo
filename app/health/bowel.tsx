import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as healthRepo from '@/db/health_repo';
import { format } from 'date-fns';
import * as haptic from '@/lib/haptic';
import type { BowelLog } from '@/db/schema';
import { SwipeableRow } from '@/components/common/SwipeableRow';

const BRISTOL_LABELS = ['', '硬塊', '塊狀', '裂紋', '正常', '軟塊', '糊狀', '水狀'];

export default function BowelHistory() {
  const palette = useThemePalette();
  const user = useAppStore((s) => s.user);
  const refreshHealth = useAppStore((s) => s.refreshHealth);
  const pushUndo = useAppStore((s) => s.pushUndo);
  const [last30, setLast30] = useState<BowelLog[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cutoff = Date.now() - 30 * 86400_000;
      const logs = await healthRepo.listBowelBetween(user.id, cutoff, Date.now() + 86400_000);
      setLast30(logs);
    })();
  }, [user]);

  const distribution: Record<number, number> = {};
  last30.forEach((b) => { distribution[b.bristol] = (distribution[b.bristol] ?? 0) + 1; });
  const totalCount = last30.length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: palette.text, fontSize: 24, fontWeight: '700' }}>{totalCount} 次</Text>
      <Text style={{ color: palette.mute, marginTop: 4, marginBottom: 16 }}>過去 30 天</Text>

      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>Bristol 分布</Text>
      <View style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4, 5, 6, 7].map((t) => {
          const count = distribution[t] ?? 0;
          const pct = totalCount > 0 ? count / totalCount : 0;
          return (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: palette.text, width: 60, fontSize: 12 }}>T{t} {BRISTOL_LABELS[t]}</Text>
              <View style={{ flex: 1, height: 12, backgroundColor: palette.card, borderRadius: 6 }}>
                <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: t === 4 ? palette.success : t < 4 ? palette.danger : palette.accent, borderRadius: 6 }} />
              </View>
              <Text style={{ color: palette.mute, marginLeft: 8, width: 30, textAlign: 'right' }}>{count}</Text>
            </View>
          );
        })}
      </View>

      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>明細</Text>
      {last30.map((b) => {
        const ts = b.loggedAt instanceof Date ? b.loggedAt : new Date(b.loggedAt);
        return (
          <SwipeableRow
            key={b.id}
            onDelete={async () => {
              const snapshot = { ...b };
              await healthRepo.deleteBowel(b.id);
              setLast30((prev) => prev.filter((x) => x.id !== b.id));
              await refreshHealth();
              pushUndo({
                id: `bowel-restore-${b.id}`,
                type: 'bowel',
                message: '已刪除排便紀錄',
                undo: async () => {
                  const restored = await healthRepo.addBowel({
                    userId: snapshot.userId,
                    loggedAt: +new Date(snapshot.loggedAt as any),
                    bristol: snapshot.bristol,
                    hasBlood: snapshot.hasBlood,
                    hasPain: snapshot.hasPain,
                    notes: snapshot.notes ?? undefined,
                  });
                  setLast30((prev) => [{ ...snapshot, id: restored }, ...prev].sort((x, y) => +new Date(y.loggedAt as any) - +new Date(x.loggedAt as any)));
                  await refreshHealth();
                },
              });
            }}
          >
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: palette.surface, padding: 12,
                borderRadius: 12, marginBottom: 6,
                borderWidth: 1, borderColor: palette.card,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>
                T{b.bristol} {BRISTOL_LABELS[b.bristol]}
                {!!b.hasBlood && ' 🩸'}
                {!!b.hasPain && ' 😣'}
              </Text>
              <Text style={{ color: palette.mute, fontSize: 12 }}>{format(ts, 'M/d HH:mm')}</Text>
            </View>
          </SwipeableRow>
        );
      })}
    </ScrollView>
  );
}
