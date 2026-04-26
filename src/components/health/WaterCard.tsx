import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { TutorialTip } from '@/components/common/TutorialTip';
import { WheelPicker } from '@/components/common/WheelPicker';

type Props = {
  /** 'compact' = 只顯示一顆「+喝水」按鈕；'full' = 完整 wheel + 自訂按鈕 */
  mode?: 'compact' | 'full';
};

const WHEEL_VALUES = Array.from({ length: 20 }, (_, i) => (i + 1) * 50); // 50, 100, ..., 1000

export function WaterCard({ mode = 'full' }: Props) {
  const palette = useThemePalette();
  const router = useRouter();
  const waterToday = useAppStore((s) => s.waterToday);
  const settings = useAppStore((s) => s.healthSettings);
  const addWater = useAppStore((s) => s.addWater);

  const totalMl = waterToday.reduce((s, w) => s + w.amountMl, 0);
  const goal = settings.water.dailyGoalMl;
  const pct = Math.min(1, totalMl / goal);

  // 進度條 chunks
  const totalChunks = 8;
  const filled = Math.round(pct * totalChunks);
  const chunks = useMemo(() => Array.from({ length: totalChunks }, (_, i) => i < filled), [filled]);

  // ===== Compact 模式 =====
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
            {(totalMl / 1000).toFixed(1)}L / {(goal / 1000).toFixed(1)}L
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

  // ===== Full 模式（wheel）=====
  const initial = WHEEL_VALUES.includes(settings.water.favoriteCupMl as any)
    ? settings.water.favoriteCupMl
    : 250;
  const [picked, setPicked] = useState<number>(initial);

  const onRecord = async () => {
    haptic.success();
    await addWater(picked, { batch: false });
    // 不重置 picked，讓使用者重複喝同量更快
  };

  return (
    <Pressable
      onLongPress={() => router.push('/health/water' as any)}
      delayLongPress={LONG_PRESS_MS}
      style={{
        backgroundColor: palette.surface,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: palette.card,
      }}
    >
      {/* 標題 + 今日進度 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 6 }}>💧</Text>
        <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {(totalMl / 1000).toFixed(1)}L / {(goal / 1000).toFixed(1)}L
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 2, marginBottom: 12 }}>
        {chunks.map((on, i) => (
          <View key={i} style={{ flex: 1, height: 6, backgroundColor: on ? '#29adff' : palette.card, borderRadius: 2 }} />
        ))}
      </View>

      {/* 中央 wheel + 兩側按鈕 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Pressable
          onPress={() => { haptic.tapLight(); setPicked(settings.water.favoriteCupMl); }}
          style={{
            backgroundColor: palette.card,
            paddingVertical: 10, paddingHorizontal: 12,
            borderRadius: 8, alignItems: 'center',
          }}
        >
          <Text style={{ color: palette.text, fontSize: 11 }}>杯</Text>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>{settings.water.favoriteCupMl}</Text>
        </Pressable>

        <WheelPicker
          values={WHEEL_VALUES}
          value={picked}
          onChange={setPicked}
          formatLabel={(v) => `${v}ml`}
          width={140}
          itemHeight={36}
          visibleCount={3}
        />

        <Pressable
          onPress={() => { haptic.tapLight(); setPicked(settings.water.bottleMl); }}
          style={{
            backgroundColor: palette.card,
            paddingVertical: 10, paddingHorizontal: 12,
            borderRadius: 8, alignItems: 'center',
          }}
        >
          <Text style={{ color: palette.text, fontSize: 11 }}>瓶</Text>
          <Text style={{ color: palette.text, fontWeight: '700', fontSize: 13 }}>{settings.water.bottleMl}</Text>
        </Pressable>
      </View>

      {/* 記錄鍵 */}
      <Pressable
        onPress={onRecord}
        style={{
          backgroundColor: palette.primary,
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 14 }}>📝 記錄 +{picked}ml</Text>
      </Pressable>

      <TutorialTip id="water-wheel-pick" delay={1500} />
    </Pressable>
  );
}

export default WaterCard;
