import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { WheelPicker } from '@/components/common/WheelPicker';

type Props = {
  /** compact = 緊湊版面、full = 大字版面；兩者皆 inline wheel */
  mode?: 'compact' | 'full';
};

const WHEEL_VALUES = Array.from({ length: 20 }, (_, i) => (i + 1) * 50); // 50, 100, ..., 1000

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

  const totalChunks = 8;
  const filled = Math.round(pct * totalChunks);
  const chunks = useMemo(() => Array.from({ length: totalChunks }, (_, i) => i < filled), [filled]);

  const initial = WHEEL_VALUES.includes(settings.water.favoriteCupMl as any) ? settings.water.favoriteCupMl : 250;
  const [picked, setPicked] = useState<number>(initial);

  const onRecord = async () => {
    haptic.success();
    await addWater(picked, { batch: false });
  };

  const isFull = mode === 'full';

  return (
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
            fontSize: isFull ? 20 : 14,
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

      {/* Inline wheel + 杯/瓶 + 記錄 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 4 }}>
        <Pressable
          onPress={() => { haptic.tapLight(); setPicked(settings.water.favoriteCupMl); }}
          style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center', minWidth: 44 }}
        >
          <Text style={{ color: palette.mute, fontSize: 9 }}>杯</Text>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 11 }}>{settings.water.favoriteCupMl}</Text>
        </Pressable>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <WheelPicker
            values={WHEEL_VALUES}
            value={picked}
            onChange={setPicked}
            formatLabel={(v) => `${v}`}
            width={isFull ? 110 : 90}
            itemHeight={isFull ? 40 : 32}
            visibleCount={3}
            activeFontSize={isFull ? 24 : 18}
          />
          <Text style={{ color: palette.mute, fontSize: 9, marginTop: -3 }}>ml</Text>
        </View>

        <Pressable
          onPress={() => { haptic.tapLight(); setPicked(settings.water.bottleMl); }}
          style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center', minWidth: 44 }}
        >
          <Text style={{ color: palette.mute, fontSize: 9 }}>瓶</Text>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 11 }}>{settings.water.bottleMl}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onRecord}
        style={{
          backgroundColor: palette.primary,
          paddingVertical: isFull ? 12 : 9,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: palette.bg, fontWeight: '700', fontSize: isFull ? 14 : 12 }}>📝 記錄 {picked}ml</Text>
      </Pressable>
    </Pressable>
  );
}

export default WaterCard;
