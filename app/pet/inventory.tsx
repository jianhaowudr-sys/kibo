import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { REWARD_POOL } from '@/lib/daily_trinity';
import * as healthRepo from '@/db/health_repo';
import { format } from 'date-fns';

const RARITY_COLOR: Record<string, string> = {
  common: '#94a3b8',
  rare: '#29adff',
  epic: '#ff77a8',
};

const RARITY_LABEL: Record<string, string> = {
  common: '一般',
  rare: '稀有',
  epic: '史詩',
};

export default function InventoryPage() {
  const palette = useThemePalette();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await healthRepo.listInventory(user.id);
      setItems(list);
    })();
  }, [user]);

  // 圖鑑進度（每個 reward pool 物件被收幾次）
  const progress = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => {
      counts[i.itemId] = (counts[i.itemId] ?? 0) + 1;
    });
    return REWARD_POOL.map((r) => ({
      ...r,
      count: counts[r.id] ?? 0,
      collected: (counts[r.id] ?? 0) > 0,
    }));
  }, [items]);

  const collected = progress.filter((p) => p.collected).length;
  const total = REWARD_POOL.length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ backgroundColor: palette.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: palette.card, marginBottom: 16 }}>
        <Text style={{ color: palette.mute, fontSize: 12 }}>圖鑑進度</Text>
        <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>{collected} / {total}</Text>
        <Text style={{ color: palette.mute, fontSize: 11, marginTop: 4 }}>累積 {items.length} 件物品</Text>
      </View>

      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>圖鑑</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {progress.map((p) => (
          <View
            key={p.id}
            style={{
              width: '47%',
              backgroundColor: palette.surface,
              padding: 12,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: p.collected ? RARITY_COLOR[p.rarity] : palette.card,
              opacity: p.collected ? 1 : 0.45,
            }}
          >
            <Text style={{ color: RARITY_COLOR[p.rarity], fontSize: 10, fontWeight: '700', marginBottom: 4 }}>
              {RARITY_LABEL[p.rarity]}
            </Text>
            <Text style={{ color: p.collected ? palette.text : palette.mute, fontSize: 14, fontWeight: '700' }}>
              {p.collected ? p.label : '???'}
            </Text>
            {p.collected && (
              <Text style={{ color: palette.mute, fontSize: 10, marginTop: 4 }}>×{p.count}</Text>
            )}
          </View>
        ))}
      </View>

      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>取得歷史</Text>
      {items.map((i) => (
        <View
          key={i.id}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: palette.surface, padding: 12,
            borderRadius: 12, marginBottom: 6,
            borderWidth: 1, borderColor: palette.card,
          }}
        >
          <View style={{ width: 8, height: 28, borderRadius: 2, backgroundColor: RARITY_COLOR[i.rarity], marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{i.itemLabel}</Text>
            <Text style={{ color: palette.mute, fontSize: 11 }}>
              {format(i.acquiredAt, 'M/d HH:mm')} · {i.source ?? '-'}
            </Text>
          </View>
        </View>
      ))}
      {items.length === 0 && (
        <Text style={{ color: palette.mute, textAlign: 'center', marginVertical: 32 }}>
          完成 Daily Trinity 開啟驚喜盒，收集獎品填滿圖鑑
        </Text>
      )}
    </ScrollView>
  );
}
