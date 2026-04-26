import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { format } from 'date-fns';
import * as repo from '@/db/repo';
import * as haptic from '@/lib/haptic';
import type { BodyMeasurement } from '@/db/schema';

export function BodySummaryCard() {
  const palette = useThemePalette();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [latest, setLatest] = useState<BodyMeasurement | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await repo.listBodyMeasurements?.(user.id, 1).catch(() => []);
      setLatest(list?.[0] ?? null);
    })();
  }, [user?.id]);

  return (
    <Pressable
      onPress={() => { haptic.tapLight(); router.push('/body' as any); }}
      style={{
        backgroundColor: palette.surface, padding: 12, borderRadius: 16,
        borderWidth: 1, borderColor: palette.card, marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 6 }}>🏋️</Text>
        <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>體態</Text>
        <Text style={{ color: palette.mute, fontSize: 11 }}>▶</Text>
      </View>
      {latest ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.mute, fontSize: 10 }}>體重</Text>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>
              {latest.weightKg ? `${latest.weightKg.toFixed(1)} kg` : '—'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.mute, fontSize: 10 }}>體脂</Text>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>
              {latest.bodyFatPct ? `${latest.bodyFatPct.toFixed(1)}%` : '—'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.mute, fontSize: 10 }}>上次</Text>
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>
              {format(latest.measuredAt instanceof Date ? latest.measuredAt : new Date(latest.measuredAt), 'M/d')}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={{ color: palette.mute, fontSize: 12 }}>尚無 InBody 紀錄</Text>
      )}
    </Pressable>
  );
}

export default BodySummaryCard;
