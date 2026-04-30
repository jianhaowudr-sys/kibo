/**
 * 首頁儀表板 layout（plan v2 §3.3）。
 * 存在 users.dashboard_layout JSON 欄位。
 */

export type DashboardCardId =
  | 'pet-hero'
  | 'pet'
  | 'streak-trinity'
  | 'calendar'
  | 'health-water'
  | 'health-bowel'
  | 'health-sleep'
  | 'health-period'
  | 'today-workouts'
  | 'start-workout-button'
  | 'today-meals'
  | 'pet-message'
  | 'body-summary'
  | 'nutrition-summary';

export type DashboardCard = {
  id: DashboardCardId;
  visible: boolean;
  order: number;
  size?: 'compact' | 'full';
};

export type DashboardLayout = {
  cards: DashboardCard[];
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  cards: [
    // 預設精簡（v5 後）：寵物 + 月曆 + 健康三卡 + 訓練。其他可在自訂頁開
    { id: 'pet-hero', visible: true, order: 0, size: 'full' },
    { id: 'streak-trinity', visible: false, order: 1, size: 'compact' },
    { id: 'calendar', visible: true, order: 2, size: 'full' },
    { id: 'health-water', visible: true, order: 3, size: 'compact' },
    { id: 'health-bowel', visible: true, order: 4, size: 'compact' },
    { id: 'health-sleep', visible: true, order: 5, size: 'compact' },
    { id: 'health-period', visible: false, order: 6, size: 'compact' },
    { id: 'pet-message', visible: false, order: 7, size: 'full' },  // 預設關，第 1~7 天通常無訊息
    { id: 'today-workouts', visible: true, order: 8, size: 'full' },
    { id: 'start-workout-button', visible: true, order: 9, size: 'full' },
    { id: 'today-meals', visible: false, order: 10, size: 'full' },
    { id: 'body-summary', visible: false, order: 11, size: 'compact' },
    { id: 'nutrition-summary', visible: false, order: 12, size: 'compact' },
    { id: 'pet', visible: false, order: 13, size: 'full' },
  ],
};

export const CARD_LABELS: Record<DashboardCardId, string> = {
  'pet-hero': '🐣 寵物常駐列（頂端）',
  'pet': '🥚 蛋進度（小卡）',
  'streak-trinity': '🔥 連續日 + 今日三件事',
  'calendar': '📅 月曆',
  'health-water': '💧 喝水',
  'health-bowel': '💩 排便',
  'health-sleep': '😴 睡眠',
  'health-period': '🌸 經期',
  'pet-message': '💬 寵物訊息',
  'today-workouts': '💪 今日訓練',
  'start-workout-button': '▶️ 開始訓練按鈕',
  'today-meals': '🍱 今日飲食',
  'body-summary': '🏋️ 體態快覽',
  'nutrition-summary': '🥗 飲食快覽',
};

export function parseLayout(raw: string | null): DashboardLayout {
  if (!raw) return DEFAULT_DASHBOARD_LAYOUT;
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj.cards)) {
      // 合併 default 補新增 card
      const map = new Map<string, DashboardCard>(obj.cards.map((c: any) => [c.id as string, c as DashboardCard]));
      const merged: DashboardCard[] = DEFAULT_DASHBOARD_LAYOUT.cards.map((d) => map.get(d.id) ?? d);
      return { cards: merged.sort((a, b) => a.order - b.order) };
    }
  } catch {}
  return DEFAULT_DASHBOARD_LAYOUT;
}

export function stringifyLayout(layout: DashboardLayout): string {
  return JSON.stringify(layout);
}
