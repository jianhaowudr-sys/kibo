import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { WaterRecordModal } from './WaterRecordModal';

type Props = {
  /** compact = 緊湊版面、full = 大字版面；兩者互動一致：「📝 記錄」鈕開 modal */
  mode?: 'compact' | 'full';
};

export function WaterCard({ mode = 'full' }: Props) {
  const palette = useThemePalette();
  const router = useRouter();
  const waterToday = useAppStore((s) => s.waterToday);
  const settings = useAppStore((s) => s.healthSettings);

  const totalMl = useMemo(() => waterToday.reduce((s, w) => s + w.amountMl, 0), [waterToday]);
  const goal = settings.water.dailyGoalMl;
  const pct = Math.min(1, totalMl / goal);
  const pctDisplay = Math.min(100, Math.round((totalMl / goal) * 100));

  const totalChunks = 8;
  const filled = Math.round(pct * totalChunks);
  const chunks = useMemo(() => Array.from({ length: totalChunks }, (_, i) => i < filled), [filled]);

  const [recordOpen, setRecordOpen] = useState(false);

  const isFull = mode === 'full';

  return (
    <>
      <Pressable
        onLongPress={() => router.push('/health/water' as any)}
        delayLongPress={LONG_PRESS_MS}
        style={{
          flex: 1,
          backgroundColor: palette.surface,
          borderRadius: 16,
          padding: isFull ? 14 : 12,
          borderWidth: 1,
          borderColor: palette.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: isFull ? 22 : 18, marginRight: 6 }}>💧</Text>
          <Text
            style={{
              color: palette.text,
              fontWeight: isFull ? '800' : '700',
              fontSize: isFull ? 22 : 14,
              flex: 1,
            }}
            numberOfLines={1}
          >
            達成 {pctDisplay}%
            {pctDisplay >= 100 && <Text style={{ color: palette.success }}>  ✓</Text>}
          </Text>
          {isFull && (
            <Text style={{ color: palette.mute, fontSize: 11 }}>
              {(totalMl / 1000).toFixed(1)}L / {(goal / 1000).toFixed(1)}L
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: isFull ? 3 : 2, marginBottom: isFull ? 12 : 8 }}>
          {chunks.map((on, i) => (
            <View key={i} style={{ flex: 1, height: isFull ? 8 : 6, backgroundColor: on ? '#29adff' : palette.card, borderRadius: 2 }} />
          ))}
        </View>

        <Pressable
          onPress={() => { haptic.tapMedium(); setRecordOpen(true); }}
          style={{
            backgroundColor: palette.primary,
            paddingVertical: isFull ? 14 : 10,
            borderRadius: isFull ? 12 : 8,
            alignItems: 'center',
            shadowColor: isFull ? palette.primary : undefined,
            shadowOpacity: isFull ? 0.3 : 0,
            shadowRadius: isFull ? 8 : 0,
            shadowOffset: { width: 0, height: 2 },
            elevation: isFull ? 4 : 0,
          }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: isFull ? 16 : 13 }}>
            📝 記錄
          </Text>
        </Pressable>
      </Pressable>
      <WaterRecordModal visible={recordOpen} onClose={() => setRecordOpen(false)} />
    </>
  );
}

export default WaterCard;
