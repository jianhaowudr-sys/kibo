import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { WheelPicker } from '@/components/common/WheelPicker';

type Props = {
  /** 'compact' = 一鍵記錄；'full' = inline wheel + 杯/瓶 + 記錄鍵 */
  mode?: 'compact' | 'full';
};

const WHEEL_VALUES = Array.from({ length: 20 }, (_, i) => (i + 1) * 50);

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

  // ===== Full 模式（inline wheel，無 modal）=====
  const initial = WHEEL_VALUES.includes(settings.water.favoriteCupMl as any)
    ? settings.water.favoriteCupMl
    : 250;
  const [picked, setPicked] = useState<number>(initial);

  const onRecord = async () => {
    haptic.success();
    await addWater(picked, { batch: false });
  };

  return (
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 22, marginRight: 8 }}>💧</Text>
        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 22, flex: 1 }}>
          達成 {pctDisplay}%
          {pctDisplay >= 100 && <Text style={{ color: palette.success, fontSize: 16 }}>  ✓</Text>}
        </Text>
        <Text style={{ color: palette.mute, fontSize: 11 }}>
          {(totalMl / 1000).toFixed(1)}L / {(goal / 1000).toFixed(1)}L
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 3, marginBottom: 10 }}>
        {chunks.map((on, i) => (
          <View key={i} style={{ flex: 1, height: 8, backgroundColor: on ? '#29adff' : palette.card, borderRadius: 2 }} />
        ))}
      </View>

      {/* Inline wheel + 杯/瓶 + 記錄 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Pressable
          onPress={() => { haptic.tapLight(); setPicked(settings.water.favoriteCupMl); }}
          style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.mute, fontSize: 9 }}>杯</Text>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>{settings.water.favoriteCupMl}</Text>
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <WheelPicker
            values={WHEEL_VALUES}
            value={picked}
            onChange={setPicked}
            formatLabel={(v) => `${v}`}
            width={110}
            itemHeight={40}
            visibleCount={3}
            activeFontSize={26}
          />
          <Text style={{ color: palette.mute, fontSize: 9, marginTop: -3 }}>ml</Text>
        </View>

        <Pressable
          onPress={() => { haptic.tapLight(); setPicked(settings.water.bottleMl); }}
          style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.mute, fontSize: 9 }}>瓶</Text>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>{settings.water.bottleMl}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onRecord}
        style={{
          backgroundColor: palette.primary,
          paddingVertical: 11,
          borderRadius: 10,
          alignItems: 'center',
          shadowColor: palette.primary,
          shadowOpacity: 0.3,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 14 }}>📝 記錄 {picked}ml</Text>
      </Pressable>
    </Pressable>
  );
}

export default WaterCard;
