import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { WaterRecordModal } from './WaterRecordModal';

type Props = {
  /** 'compact' = 只顯示一顆「+喝水」按鈕；'full' = 進度 + 記錄鈕（→ modal）*/
  mode?: 'compact' | 'full';
};

export function WaterCard({ mode = 'full' }: Props) {
  const palette = useThemePalette();
  const router = useRouter();
  const waterToday = useAppStore((s) => s.waterToday);
  const settings = useAppStore((s) => s.healthSettings);
  const addWater = useAppStore((s) => s.addWater);

  const totalMl = useMemo(() => waterToday.reduce((s, w) => s + w.amountMl, 0), [waterToday]);
  const goal = settings.water.dailyGoalMl;
  const pct = Math.min(1, totalMl / goal);
  const pctDisplay = Math.min(100, Math.round((totalMl / goal) * 100));

  const [recordOpen, setRecordOpen] = useState(false);

  // 進度條 chunks
  const totalChunks = 8;
  const filled = Math.round(pct * totalChunks);
  const chunks = useMemo(() => Array.from({ length: totalChunks }, (_, i) => i < filled), [filled]);

  // ===== Compact 模式（一鍵直接記錄）=====
  if (mode === 'compact') {
    return (
      <Pressable
        onLongPress={() => router.push('/health/water' as any)}
        delayLongPress={LONG_PRESS_MS}
        style={{
          flex: 1,
          backgroundColor: palette.surface,
          borderRadius: 16,
          padding: 12,
          borderWidth: 1,
          borderColor: palette.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 18, marginRight: 6 }}>💧</Text>
          <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            達成 {pctDisplay}%
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 2, marginBottom: 8 }}>
          {chunks.map((on, i) => (
            <View key={i} style={{ flex: 1, height: 6, backgroundColor: on ? '#29adff' : palette.card, borderRadius: 2 }} />
          ))}
        </View>
        <Pressable
          onPress={() => { haptic.tapLight(); addWater(settings.water.favoriteCupMl, { batch: false }); }}
          style={{ backgroundColor: palette.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 13 }}>+ 喝水 {settings.water.favoriteCupMl}ml</Text>
        </Pressable>
      </Pressable>
    );
  }

  // ===== Full 模式（精簡：%+進度+記錄鈕）=====
  return (
    <>
      <Pressable
        onLongPress={() => router.push('/health/water' as any)}
        delayLongPress={LONG_PRESS_MS}
        style={{
          backgroundColor: palette.surface,
          borderRadius: 16,
          padding: 14,
          borderWidth: 1,
          borderColor: palette.card,
        }}
      >
        {/* 達成 % */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 22, marginRight: 8 }}>💧</Text>
          <Text style={{ color: palette.text, fontWeight: '800', fontSize: 24, flex: 1 }}>
            達成 {pctDisplay}%
            {pctDisplay >= 100 && <Text style={{ color: palette.success, fontSize: 18 }}>  ✓</Text>}
          </Text>
        </View>
        <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 10 }}>
          {(totalMl / 1000).toFixed(1)}L / {(goal / 1000).toFixed(1)}L
        </Text>

        {/* 進度條 */}
        <View style={{ flexDirection: 'row', gap: 3, marginBottom: 12 }}>
          {chunks.map((on, i) => (
            <View key={i} style={{ flex: 1, height: 8, backgroundColor: on ? '#29adff' : palette.card, borderRadius: 2 }} />
          ))}
        </View>

        {/* 記錄按鈕 */}
        <Pressable
          onPress={() => { haptic.tapLight(); setRecordOpen(true); }}
          style={{
            backgroundColor: palette.primary,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            shadowColor: palette.primary,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>📝 記錄</Text>
        </Pressable>
      </Pressable>

      <WaterRecordModal visible={recordOpen} onClose={() => setRecordOpen(false)} />
    </>
  );
}

export default WaterCard;
