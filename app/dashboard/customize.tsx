import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { parseLayout, stringifyLayout, CARD_LABELS, type DashboardCard } from '@/lib/dashboard';
import { LONG_PRESS_MS } from '@/lib/gestures';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';
import * as haptic from '@/lib/haptic';

export default function CustomizeDashboard() {
  const palette = useThemePalette();
  const router = useRouter();
  const layoutJson = useAppStore((s) => s.dashboardLayoutJson);
  const setLayoutJson = useAppStore((s) => s.setDashboardLayoutJson);
  const [cards, setCards] = useState<DashboardCard[]>([]);

  useEffect(() => {
    setCards(parseLayout(layoutJson).cards);
  }, [layoutJson]);

  const onSave = async () => {
    haptic.success();
    const ordered = cards.map((c, i) => ({ ...c, order: i }));
    await setLayoutJson(stringifyLayout({ cards: ordered }));
    router.back();
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<DashboardCard>) => (
    <Pressable
      onLongPress={() => { haptic.tapMedium(); drag(); }}
      delayLongPress={LONG_PRESS_MS}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: palette.surface,
        padding: 14, marginBottom: 8, borderRadius: 12,
        borderWidth: 1, borderColor: palette.card,
        opacity: isActive ? 0.92 : 1,
        transform: [{ scale: isActive ? 1.02 : 1 }],
      }}
    >
      <Text style={{ color: palette.mute, fontSize: 18, marginRight: 12 }}>≡</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontWeight: '700' }}>{CARD_LABELS[item.id]}</Text>
        <Text style={{ color: palette.mute, fontSize: 11 }}>{item.size === 'full' ? '完整模式' : '緊湊模式'}</Text>
      </View>
      <Switch
        value={item.visible}
        onValueChange={(v) => {
          haptic.tapLight();
          setCards((prev) => prev.map((c) => c.id === item.id ? { ...c, visible: v } : c));
        }}
      />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <DraggableFlatList
        data={cards}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        onDragEnd={({ data }) => setCards(data)}
        ListHeaderComponent={
          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 12 }}>
            長按拖曳調整順序，右側開關控制是否顯示在首頁
          </Text>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}
        activationDistance={5}
      />

      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.card,
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexDirection: 'row', gap: 8,
      }}>
        <Pressable
          onPress={() => router.back()}
          style={{ backgroundColor: palette.card, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12 }}
        >
          <Text style={{ color: palette.text, fontWeight: '600' }}>取消</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          style={{ flex: 1, backgroundColor: palette.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>完成</Text>
        </Pressable>
      </View>
    </View>
  );
}
