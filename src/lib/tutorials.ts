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
  'water-card-hold': {
    id: 'water-card-hold',
    title: '按住可累積',
    body: '長按 +100 按鈕會像加油槍一樣連續累積，放開即記錄總量。',
    scope: 'home',
    icon: '💧',
  },
  'water-card-merge': {
    id: 'water-card-merge',
    title: '連點會合併',
    body: '2 秒內連點 +100 會合併成單筆紀錄，撤銷時整批一起消失。',
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
    body: '滑桿預設是你過去 14 天的中位數，符合直接點記錄即可。',
    scope: 'sleep',
    icon: '😴',
  },
};

/** 取某 scope 下的全部 tip（給 ❓ icon 重看用） */
export function tutorialsForScope(scope: string): Tutorial[] {
  return Object.values(TUTORIALS).filter((t) => t.scope === scope);
}
