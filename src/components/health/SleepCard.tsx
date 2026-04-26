import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import { format } from 'date-fns';
import * as haptic from '@/lib/haptic';
import { SleepEditModal } from './SleepEditModal';

type Props = { mode?: 'compact' | 'full' };

export function SleepCard({ mode = 'full' }: Props) {
  const palette = useThemePalette();
  const router = useRouter();
  const sleepLast = useAppStore((s) => s.sleepLast);
  const [editOpen, setEditOpen] = useState(false);

  const hours = sleepLast ? Math.floor(sleepLast.durationMin / 60) : 0;
  const mins = sleepLast ? sleepLast.durationMin % 60 : 0;
  const bed = sleepLast ? format(sleepLast.bedtimeAt instanceof Date ? sleepLast.bedtimeAt : new Date(sleepLast.bedtimeAt), 'HH:mm') : '--:--';
  const wake = sleepLast ? format(sleepLast.wakeAt instanceof Date ? sleepLast.wakeAt : new Date(sleepLast.wakeAt), 'HH:mm') : '--:--';

  if (mode === 'compact') {
    return (
      <>
        <Pressable
          onLongPress={() => router.push('/health/sleep' as any)}
          delayLongPress={LONG_PRESS_MS}
          style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: palette.card }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 18, marginRight: 6 }}>😴</Text>
            <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {sleepLast ? `${hours}h ${mins}m` : '尚未記錄'}
            </Text>
          </View>
          <Pressable
            onPress={() => { haptic.tapLight(); setEditOpen(true); }}
            style={{ backgroundColor: palette.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 13 }}>✎ 記錄</Text>
          </Pressable>
        </Pressable>
        <SleepEditModal visible={editOpen} onClose={() => setEditOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => { haptic.tapLight(); setEditOpen(true); }}
        onLongPress={() => router.push('/health/sleep' as any)}
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
          <Text style={{ fontSize: 18, marginRight: 6 }}>😴</Text>
          <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {sleepLast ? `${hours}h ${mins}m` : '尚未記錄'}
          </Text>
        </View>
        <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 8 }}>
          {sleepLast ? `${bed} → ${wake}` : '昨晚資料'}
        </Text>
        <Pressable
          onPress={() => { haptic.tapLight(); setEditOpen(true); }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: palette.card, paddingVertical: 8, borderRadius: 8 }}
        >
          <Text style={{ color: palette.text, fontWeight: '600', fontSize: 12 }}>✎ 編輯</Text>
        </Pressable>
      </Pressable>
      <SleepEditModal visible={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

export default SleepCard;
