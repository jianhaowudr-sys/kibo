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
  const todayTotal = useAppStore((s) => s.todaySleepTotal);
  const [editOpen, setEditOpen] = useState(false);

  // v1.0.6+：優先顯示今天的「主睡 + 小睡」總時數；今天還沒記時 fallback 到 sleepLast 主睡
  const showingToday = todayTotal.totalMin > 0;
  const totalMin = showingToday ? todayTotal.totalMin : (sleepLast?.durationMin ?? 0);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const napMin = todayTotal.napMin;
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
              {totalMin > 0 ? `${hours}h ${mins}m` : '尚未記錄'}
            </Text>
          </View>
          {napMin > 0 && (
            <Text style={{ color: palette.mute, fontSize: 9, marginBottom: 4 }} numberOfLines={1}>
              含 {Math.floor(napMin / 60)}h {napMin % 60}m 小睡
            </Text>
          )}
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
            {totalMin > 0 ? `${hours}h ${mins}m` : '尚未記錄'}
          </Text>
        </View>
        <Text style={{ color: palette.mute, fontSize: 11, marginBottom: napMin > 0 ? 2 : 8 }}>
          {sleepLast ? `${bed} → ${wake}` : '昨晚資料'}
        </Text>
        {napMin > 0 && (
          <Text style={{ color: palette.mute, fontSize: 10, marginBottom: 8 }}>
            + {Math.floor(napMin / 60)}h {napMin % 60}m 小睡
          </Text>
        )}
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
