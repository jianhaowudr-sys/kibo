/**
 * 全 App 教學文案集中地（plan v2 §3.4 / A4）。
 * 每個含特殊操作的畫面都該對應一個或多個 tip。
 *
 * 用法：
 *   <TutorialTip id="water-card-hold" />  // 自動讀取此處的 title/body
 *
 * 每個畫面右上的 ❓ icon 會列出該畫面所有 tip 給使用者重看。
 */

export type Tutorial = {
  id: string;
  /** 短標題（10 字內） */
  title: string;
  /** 詳細說明（< 40 字） */
  body: string;
  /** 此 tip 屬於哪個畫面（用於 ❓ icon 重看） */
  scope: string;
  /** emoji icon */
  icon?: string;
};

export const TUTORIALS: Record<string, Tutorial> = {
  'water-wheel-pick': {
    id: 'water-wheel-pick',
    title: '滾輪選量',
    body: '上下滑動數字選擇喝水量（50ml 步進），左右兩顆按鈕一鍵跳到杯/瓶量，按「記錄」送出。',
    scope: 'home',
    icon: '💧',
  },
  'card-longpress-history': {
    id: 'card-longpress-history',
    title: '長按看歷史',
    body: '長按任一健康卡片可進入該項目的歷史紀錄與圖表。',
    scope: 'home',
    icon: '📊',
  },
  'card-compact-mode': {
    id: 'card-compact-mode',
    title: '精簡模式',
    body: '在「自訂首頁」可把卡片切到精簡模式，只剩一顆快速記錄按鈕，省空間。',
    scope: 'home',
    icon: '⚡',
  },
  'diet-multi-photo': {
    id: 'diet-multi-photo',
    title: '多張照片合併',
    body: '可選最多 5 張照片，AI 各自分析後合併計算營養素，儲存前可手動修正各欄位。',
    scope: 'diet',
    icon: '🍱',
  },
  'calendar-view-mode': {
    id: 'calendar-view-mode',
    title: '月曆切檢視',
    body: '月曆上方可切換「月 / 週 / 近 7 天」三種檢視，選你最常看的。',
    scope: 'home',
    icon: '📅',
  },
  'low-power-mode': {
    id: 'low-power-mode',
    title: '低負擔模式',
    body: '卡頓時可在「我 → 外觀」打開低負擔模式，動畫與滾輪會簡化，但記錄功能不變。',
    scope: 'me',
    icon: '⚡',
  },
  'stats-customize': {
    id: 'stats-customize',
    title: '自訂數據顯示',
    body: '「我 → 數據」右上 ⚙️ 可選擇顯示哪些區塊（範圍、總覽、進度、各種 panel）並拖曳排序。',
    scope: 'me',
    icon: '📊',
  },
  'bowel-longpress-detail': {
    id: 'bowel-longpress-detail',
    title: '長按詳填',
    body: '單擊一鍵記錄，長按可填 Bristol 分級與症狀。',
    scope: 'home',
    icon: '💩',
  },
  'period-cycle-start': {
    id: 'period-cycle-start',
    title: '經期開始',
    body: '點【經期開始】會把今天標為週期第一天，之後每天可單擊記錄流量。',
    scope: 'home',
    icon: '🌸',
  },
  'dashboard-customize': {
    id: 'dashboard-customize',
    title: '自訂首頁',
    body: '右上 ⚙️ 可選要顯示哪些卡片，並拖曳排序。',
    scope: 'home',
    icon: '⚙️',
  },
  'list-longpress-drag': {
    id: 'list-longpress-drag',
    title: '長按拖曳',
    body: '長按清單中的項目 0.5 秒可拖曳調整順序。',
    scope: 'list',
    icon: '≡',
  },
  'swipe-delete': {
    id: 'swipe-delete',
    title: '左滑刪除',
    body: '左滑列表項目可刪除，5 秒內可從底部 toast 撤銷。',
    scope: 'list',
    icon: '🗑',
  },
  'wake-prompt': {
    id: 'wake-prompt',
    title: '起床記錄',
    body: '上床/起床時間用兩個滾輪（小時 + 分鐘）滑動選擇，預設是你的歷史中位數。',
    scope: 'sleep',
    icon: '😴',
  },
};

/** 取某 scope 下的全部 tip（給 ❓ icon 重看用） */
export function tutorialsForScope(scope: string): Tutorial[] {
  return Object.values(TUTORIALS).filter((t) => t.scope === scope);
}
