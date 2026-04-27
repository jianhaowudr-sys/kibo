import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { WaterRecordModal } from './WaterRecordModal';

type Props = {
  /** compact = 緊湊版面、full = 大字版面；結構相同，字級不同 */
  mode?: 'compact' | 'full';
};

export function WaterCard({ mode = 'full' }: Props) {
  const palette = useThemePalette();
  const router = useRouter();
  const waterToday = useAppStore((s) => s.waterToday);
  const settings = useAppStore((s) => s.healthSettings);

  const totalMl = useMemo(() => waterToday.reduce((s, w) => s + w.amountMl, 0), [waterToday]);
  const goal = settings.water.dailyGoalMl;
  const pctDisplay = Math.min(100, Math.round((totalMl / goal) * 100));

  const [modalOpen, setModalOpen] = useState(false);
  const isFull = mode === 'full';

  const openModal = () => {
    haptic.tapLight();
    setModalOpen(true);
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isFull ? 12 : 8 }}>
          <Text style={{ fontSize: isFull ? 22 : 18, marginRight: 6 }}>💧</Text>
          <Text
            style={{
              color: palette.text,
              fontWeight: isFull ? '800' : '700',
              fontSize: isFull ? 18 : 14,
              flex: 1,
            }}
            numberOfLines={1}
          >
            喝水
          </Text>
          <Text
            style={{
              color: pctDisplay >= 100 ? palette.success : palette.text,
              fontWeight: '800',
              fontSize: isFull ? 22 : 16,
            }}
          >
            {pctDisplay}%
            {pctDisplay >= 100 && <Text style={{ color: palette.success }}> ✓</Text>}
          </Text>
        </View>

        <Pressable
          onPress={openModal}
          style={{
            backgroundColor: palette.primary,
            paddingVertical: isFull ? 12 : 9,
            borderRadius: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: isFull ? 14 : 12 }}>📝 記錄</Text>
        </Pressable>
      </Pressable>

      <WaterRecordModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

export default WaterCard;
