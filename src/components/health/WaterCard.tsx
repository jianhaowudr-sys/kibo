import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { HOLD_TICK_MS, LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { TutorialTip } from '@/components/common/TutorialTip';

export function WaterCard() {
  const palette = useThemePalette();
  const router = useRouter();
  const waterToday = useAppStore((s) => s.waterToday);
  const settings = useAppStore((s) => s.healthSettings);
  const addWater = useAppStore((s) => s.addWater);

  const totalMl = waterToday.reduce((s, w) => s + w.amountMl, 0);
  const goal = settings.water.dailyGoalMl;
  const pct = Math.min(1, totalMl / goal);

  // 按住累積 state
  const [holdAmount, setHoldAmount] = useState<number>(0);
  const holdRef = useRef<{ timer: ReturnType<typeof setInterval> | null; startedAt: number }>({ timer: null, startedAt: 0 });

  const onPress100 = async () => {
    if (holdRef.current.timer) return;
    haptic.tapLight();
    await addWater(settings.water.minStepMl);
  };

  const startHold = () => {
    if (holdRef.current.timer) return;
    haptic.tapMedium();
    holdRef.current.startedAt = Date.now();
    setHoldAmount(settings.water.minStepMl);
    holdRef.current.timer = setInterval(() => {
      setHoldAmount((p) => p + settings.water.minStepMl);
      haptic.tapLight();
    }, HOLD_TICK_MS);
  };

  const stopHold = async () => {
    if (!holdRef.current.timer) return;
    clearInterval(holdRef.current.timer);
    holdRef.current.timer = null;
    const amount = holdAmount;
    setHoldAmount(0);
    if (amount > 0) {
      // 累積總量寫入單一 batch
      const batchKey = `hold_${Date.now()}`;
      // 直接呼叫 addWater 一次即可（amount 為總量）
      await addWater(amount, { batch: false });
    }
  };

  // 畫像素分塊進度條
  const totalChunks = 8;
  const filled = Math.round(pct * totalChunks);
  const chunks = Array.from({ length: totalChunks }, (_, i) => i < filled);

  const display = holdAmount > 0 ? `+${holdAmount}ml` : `${(totalMl / 1000).toFixed(1)}L / ${(goal / 1000).toFixed(1)}L`;

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
          {display}
        </Text>
      </View>

      {/* 進度條 */}
      <View style={{ flexDirection: 'row', gap: 2, marginBottom: 8 }}>
        {chunks.map((on, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 8,
              backgroundColor: on ? '#29adff' : palette.card,
              borderRadius: 2,
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable
          onPress={onPress100}
          onLongPress={startHold}
          delayLongPress={250}
          onPressOut={stopHold}
          style={{
            flex: 1,
            backgroundColor: palette.primary,
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 12 }}>+{settings.water.minStepMl}</Text>
        </Pressable>
        <Pressable
          onPress={() => { haptic.tapLight(); addWater(settings.water.favoriteCupMl, { batch: false }); }}
          style={{ flex: 1, backgroundColor: palette.card, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.text, fontWeight: '600', fontSize: 12 }}>+杯{settings.water.favoriteCupMl}</Text>
        </Pressable>
        <Pressable
          onPress={() => { haptic.tapLight(); addWater(settings.water.bottleMl, { batch: false }); }}
          style={{ flex: 1, backgroundColor: palette.card, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
        >
          <Text style={{ color: palette.text, fontWeight: '600', fontSize: 12 }}>+瓶{settings.water.bottleMl}</Text>
        </Pressable>
      </View>

      <TutorialTip id="water-card-hold" delay={1500} />
    </Pressable>
  );
}

export default WaterCard;
