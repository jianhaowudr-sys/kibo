import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { LONG_PRESS_MS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';
import { BristolPicker } from './BristolPicker';

type Props = { mode?: 'compact' | 'full' };

export function BowelCard({ mode = 'full' }: Props) {
  const palette = useThemePalette();
  const router = useRouter();
  const bowelToday = useAppStore((s) => s.bowelToday);
  const addBowel = useAppStore((s) => s.addBowel);
  const upsertBowel = useAppStore((s) => s.upsertBowel);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const last = bowelToday[0];
  const lastTs = last ? (last.loggedAt instanceof Date ? last.loggedAt.getTime() : Number(last.loggedAt)) : 0;
  const hours = lastTs ? Math.floor((Date.now() - lastTs) / 3600_000) : null;

  const onTap = async () => {
    const id = await addBowel();
    setEditingId(id);
  };

  if (mode === 'compact') {
    return (
      <>
        <Pressable
          onLongPress={() => router.push('/health/bowel' as any)}
          delayLongPress={LONG_PRESS_MS}
          style={{
            flex: 1, backgroundColor: palette.surface, borderRadius: 16,
            padding: 12, borderWidth: 1, borderColor: palette.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 18, marginRight: 6 }}>💩</Text>
            <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              今日 {bowelToday.length} 次
            </Text>
          </View>
          <Pressable
            onPress={onTap}
            style={{ backgroundColor: palette.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 13 }}>+ 排便</Text>
          </Pressable>
        </Pressable>
        <BristolPicker
          visible={pickerOpen || editingId !== null}
          initial={editingId && last ? { bristol: last.bristol, hasBlood: !!last.hasBlood, hasPain: !!last.hasPain, notes: last.notes ?? '' } : undefined}
          onClose={() => { setPickerOpen(false); setEditingId(null); }}
          onSave={async (data) => {
            if (editingId) await upsertBowel(editingId, { bristol: data.bristol, hasBlood: data.hasBlood ? 1 : 0, hasPain: data.hasPain ? 1 : 0, notes: data.notes });
            else await addBowel({ bristol: data.bristol, hasBlood: data.hasBlood ? 1 : 0, hasPain: data.hasPain ? 1 : 0, notes: data.notes });
            setPickerOpen(false); setEditingId(null);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={onTap}
        onLongPress={() => router.push('/health/bowel' as any)}
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
          <Text style={{ fontSize: 18, marginRight: 6 }}>💩</Text>
          <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            今日 {bowelToday.length} 次
          </Text>
          <Pressable hitSlop={12} onPress={(e) => { e.stopPropagation?.(); haptic.tapMedium(); setEditingId(null); setPickerOpen(true); }}>
            <Text style={{ color: palette.mute, fontSize: 18, paddingHorizontal: 4 }}>⋯</Text>
          </Pressable>
        </View>
        <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 8 }}>
          {hours !== null ? `距上次 ${hours}h` : '今天還沒記錄'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            onPress={onTap}
            style={{
              flex: 1,
              backgroundColor: palette.primary,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 12 }}>💩 +1</Text>
          </Pressable>
        </View>
      </Pressable>

      <BristolPicker
        visible={pickerOpen || editingId !== null}
        initial={editingId && last ? {
          bristol: last.bristol,
          hasBlood: !!last.hasBlood,
          hasPain: !!last.hasPain,
          notes: last.notes ?? '',
        } : undefined}
        onClose={() => { setPickerOpen(false); setEditingId(null); }}
        onSave={async (data) => {
          if (editingId) {
            await upsertBowel(editingId, {
              bristol: data.bristol,
              hasBlood: data.hasBlood ? 1 : 0,
              hasPain: data.hasPain ? 1 : 0,
              notes: data.notes,
            });
          } else {
            // 從卡片長按進入：直接新增一筆完整資料
            await addBowel({
              bristol: data.bristol,
              hasBlood: data.hasBlood ? 1 : 0,
              hasPain: data.hasPain ? 1 : 0,
              notes: data.notes,
            });
          }
          setPickerOpen(false); setEditingId(null);
        }}
      />
    </>
  );
}

export default BowelCard;
