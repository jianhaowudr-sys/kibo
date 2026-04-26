import React, { useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { parseLayout } from '@/lib/dashboard';
import { WaterCard } from './WaterCard';
import { BowelCard } from './BowelCard';
import { SleepCard } from './SleepCard';
import { PeriodCard } from './PeriodCard';

/**
 * 首頁 Today 健康列。讀取 dashboardLayout 決定每張健康卡是否顯示 + 順序。
 *
 * 4 張時用橫向 ScrollView 避免擠爛 iPhone SE。
 */
export function HealthRow() {
  const layoutJson = useAppStore((s) => s.dashboardLayoutJson);
  const periodEnabled = useAppStore((s) => s.healthSettings.period.enabled);

  const cards = useMemo(() => {
    const layout = parseLayout(layoutJson);
    const cardsWithMode = layout.cards
      .filter((c) => c.id.startsWith('health-') && c.visible)
      .filter((c) => c.id !== 'health-period' || periodEnabled)
      .sort((a, b) => a.order - b.order);
    return cardsWithMode.map((c) => {
      const m = (c.size === 'compact' ? 'compact' : 'full') as 'compact' | 'full';
      switch (c.id) {
        case 'health-water': return <WaterCard key="water" mode={m} />;
        case 'health-bowel': return <BowelCard key="bowel" mode={m} />;
        case 'health-sleep': return <SleepCard key="sleep" mode={m} />;
        case 'health-period': return <PeriodCard key="period" mode={m} />;
        default: return null;
      }
    }).filter(Boolean);
  }, [layoutJson, periodEnabled]);

  if (cards.length === 0) return null;

  if (cards.length <= 3) {
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {cards.map((c, i) => (
          <View key={i} style={{ flex: 1 }}>{c}</View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 8, paddingBottom: 12 }}
    >
      {cards.map((c, i) => (
        <View key={i} style={{ width: 160 }}>{c}</View>
      ))}
    </ScrollView>
  );
}

export default HealthRow;
