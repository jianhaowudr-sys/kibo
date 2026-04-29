/**
 * 「我 → 數據」頁面的客製化顯示順序與可見性。
 * 與首頁 dashboardLayout 平行（都用 AsyncStorage 持久化）。
 */

export type StatsItemId =
  | 'range-pills'
  | 'overview-cards'
  | 'level-progress'
  | 'weekly-goal'
  | 'weekly-chart'
  | 'workout-panel'
  | 'meal-panel'
  | 'water-panel'
  | 'bowel-panel'
  | 'sleep-panel'
  | 'body-panel'
  | 'overall-panel';

export type StatsItem = {
  id: StatsItemId;
  visible: boolean;
  order: number;
};

export type StatsLayout = { items: StatsItem[] };

export const DEFAULT_STATS_LAYOUT: StatsLayout = {
  items: [
    { id: 'range-pills', visible: true, order: 0 },
    { id: 'overview-cards', visible: true, order: 1 },
    { id: 'level-progress', visible: true, order: 2 },
    { id: 'weekly-goal', visible: true, order: 3 },
    { id: 'weekly-chart', visible: true, order: 4 },
    { id: 'workout-panel', visible: true, order: 5 },
    { id: 'meal-panel', visible: true, order: 6 },
    { id: 'water-panel', visible: true, order: 7 },
    { id: 'bowel-panel', visible: true, order: 8 },
    { id: 'sleep-panel', visible: true, order: 9 },
    { id: 'body-panel', visible: true, order: 10 },
    { id: 'overall-panel', visible: true, order: 11 },
  ],
};

export const STATS_LABELS: Record<StatsItemId, string> = {
  'range-pills': '⏱ 時間範圍切換',
  'overview-cards': '🏆 等級 + 連續天數總覽',
  'level-progress': '⚡ 升等進度條',
  'weekly-goal': '🎯 本週目標',
  'weekly-chart': '📊 近 7 日圖',
  'workout-panel': '💪 訓練數據（折疊）',
  'meal-panel': '🍱 飲食數據（折疊）',
  'water-panel': '💧 喝水數據（折疊）',
  'bowel-panel': '💩 排便數據（折疊）',
  'sleep-panel': '😴 睡眠數據（折疊）',
  'body-panel': '📸 體態變化（折疊）',
  'overall-panel': '🎯 綜合活動（折疊）',
};

export function parseStatsLayout(raw: string | null): StatsLayout {
  if (!raw) return DEFAULT_STATS_LAYOUT;
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj.items)) {
      const map = new Map<string, StatsItem>(obj.items.map((c: any) => [c.id, c]));
      const merged: StatsItem[] = DEFAULT_STATS_LAYOUT.items.map((d) => map.get(d.id) ?? d);
      return { items: merged.sort((a, b) => a.order - b.order) };
    }
  } catch {}
  return DEFAULT_STATS_LAYOUT;
}

export function stringifyStatsLayout(layout: StatsLayout): string {
  return JSON.stringify(layout);
}
