import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { parseLayout } from '@/lib/dashboard';
import { WaterCard } from './WaterCard';
import { BowelCard } from './BowelCard';
import { SleepCard } from './SleepCard';
import { PeriodCard } from './PeriodCard';

/**
 * 首頁健康列。讀 dashboardLayout 決定每張健康卡是否顯示 + 順序。
 *
 * Layout 統一規則（v4 修補）：
 *  - 1 卡：佔滿全寬
 *  - 2 卡：1 row 各 50%
 *  - 3 卡：1 row 各 33%
 *  - 4 卡：2x2 grid 各 50%（避免橫向 scroll cliff）
 */
export function HealthRow() {
  const layoutJson = useAppStore((s) => s.dashboardLayoutJson);
  const periodEnabled = useAppStore((s) => s.healthSettings.period.enabled);

  const cards = useMemo(() => {
    const layout = parseLayout(layoutJson);
    const filtered = layout.cards
      .filter((c) => c.id.startsWith('health-') && c.visible)
      .filter((c) => c.id !== 'health-period' || periodEnabled)
      .sort((a, b) => a.order - b.order);
    return filtered.map((c) => {
      const m = (c.size === 'compact' ? 'compact' : 'full') as 'compact' | 'full';
      switch (c.id) {
        case 'health-water': return { id: c.id, node: <WaterCard mode={m} /> };
        case 'health-bowel': return { id: c.id, node: <BowelCard mode={m} /> };
        case 'health-sleep': return { id: c.id, node: <SleepCard mode={m} /> };
        case 'health-period': return { id: c.id, node: <PeriodCard mode={m} /> };
        default: return null;
      }
    }).filter(Boolean) as { id: string; node: React.ReactNode }[];
  }, [layoutJson, periodEnabled]);

  if (cards.length === 0) return null;

  // 1~3 卡：單列等寬；4 卡：2x2 grid
  if (cards.length <= 3) {
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {cards.map((c) => (
          <View key={c.id} style={{ flex: 1 }}>{c.node}</View>
        ))}
      </View>
    );
  }

  // 4 卡：2x2
  const rows = [cards.slice(0, 2), cards.slice(2, 4)];
  return (
    <View style={{ marginBottom: 12, gap: 8 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((c) => (
            <View key={c.id} style={{ flex: 1 }}>{c.node}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default HealthRow;
