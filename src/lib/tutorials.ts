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
  'master-welcome': {
    id: 'master-welcome',
    title: '歡迎來到 Kibo',
    body: '右上 ⚙️ 自訂顯示，❓ 看小技巧；長按卡片進歷史；右上 ⋯ 進詳細編輯。',
    scope: 'home',
    icon: '👋',
  },
  'pet-hero-bar': {
    id: 'pet-hero-bar',
    title: '寵物常駐',
    body: '頁面頂端的寵物列即時反映 7 天活動心情，點一下進場景頁互動。',
    scope: 'home',
    icon: '🐣',
  },
  'pr-badge': {
    id: 'pr-badge',
    title: '個人紀錄',
    body: '訓練中打破歷史最佳會出現 🏆 PR 徽章 + 寵物慶祝訊息。',
    scope: 'workout',
    icon: '🏆',
  },
  'water-wheel-pick': {
    id: 'water-wheel-pick',
    title: '記錄喝水',
    body: '首頁喝水卡顯示達成百分比；點「📝 記錄」開記錄頁，滑動數字選量（50ml 步進）或按「設為杯/瓶」捷徑，再按下記錄完成。',
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
    title: '多張照片要怎麼算',
    body: '上傳多張時可選：📷「同一餐多角度」AI 取平均算一份（避免重複）；🍱「不同餐分別記」會存成多筆紀錄。',
    scope: 'diet',
    icon: '🍱',
  },
  'food-library-pick': {
    id: 'food-library-pick',
    title: '食物庫快速選',
    body: '飲食記錄頁右側「🍽 食物庫」可挑選自己存過的常吃食物，選份數一鍵加入，省下拍照等 AI 的時間。',
    scope: 'diet',
    icon: '🍽',
  },
  'palm-reference': {
    id: 'palm-reference',
    title: '手掌參照更準',
    body: '拍照時把手掌張開五指、平放食物旁同高度，勾選「✋ 拍照時手掌入鏡」AI 會用你的手掌大小 calibrate 份量，解決常見高估。先到「我 → 健康偏好」填手掌尺寸更精準。',
    scope: 'diet',
    icon: '✋',
  },
  'food-library-add': {
    id: 'food-library-add',
    title: '建立常吃食物',
    body: '我 → 🍽 我的食物庫 → 新增：拍照讓 AI 算或手動填營養素。下次同食物直接點選不必再拍。',
    scope: 'me',
    icon: '🍽',
  },
  'food-library-star': {
    id: 'food-library-star',
    title: '☆ 一鍵存食物庫',
    body: '拍照 AI 辨識出的食物明細旁的 ☆ 點一下即存入食物庫，已存的會變實心 ★。下次同食物直接挑不必再拍。',
    scope: 'diet',
    icon: '⭐',
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
  'stats-health-range': {
    id: 'stats-health-range',
    title: '健康數據看區間變化',
    body: '「我 → 數據」切換時間範圍（今日/週/月），訓練、飲食、喝水、排便、睡眠、體態都會帶區間統計。',
    scope: 'me',
    icon: '📈',
  },
  'diet-history': {
    id: 'diet-history',
    title: '回看過去飲食',
    body: '飲食頁上方 ‹ › 切換日期、點中間日期回今天；歷史日期可看當天明細與營養總計，但只能在今天新增。',
    scope: 'diet',
    icon: '📅',
  },
  'bowel-detail': {
    id: 'bowel-detail',
    title: '排便詳填',
    body: '單擊 +1 一鍵記錄；右上 ⋯ 進 Bristol 分級與症狀詳填。',
    scope: 'home',
    icon: '💩',
  },
  'period-detail': {
    id: 'period-detail',
    title: '經期記錄',
    body: '單擊一鍵記錄今天；右上 ⋯ 詳填流量、症狀、是否為週期第一天。',
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
  'routine-list-drag': {
    id: 'routine-list-drag',
    title: '課表可排序',
    body: '長按任何一張課表卡 0.5 秒可拖曳調整順序，常用的拉到最上面。',
    scope: 'routines',
    icon: '≡',
  },
  'sleep-main-vs-nap': {
    id: 'sleep-main-vs-nap',
    title: '主睡 vs 小睡',
    body: '上方切「😴 主睡」紀錄昨晚那覺（夜班/早睡晚起都自動歸對日期）；切「🛌 小睡」記午休/補眠不影響主睡。',
    scope: 'sleep',
    icon: '😴',
  },
  'liberation-pct': {
    id: 'liberation-pct',
    title: '解放健力百分比',
    body: '所有紀錄都會解放你的健力 0-100%。一週完整紀錄就能孵蛋，運動是 bonus 加速。',
    scope: 'pet',
    icon: '⚡',
  },
  'egg-skin': {
    id: 'egg-skin',
    title: '蛋皮膚抽抽樂',
    body: '達 100% 解放後孵化會抽稀有度（普通/罕見/稀有/傳說），再抽蛋皮膚（茶葉蛋/水煮蛋/恐龍蛋等）。連續 30 天簽到下顆保底罕見以上。',
    scope: 'pet',
    icon: '🥚',
  },
};

/** 取某 scope 下的全部 tip（給 ❓ icon 重看用） */
export function tutorialsForScope(scope: string): Tutorial[] {
  return Object.values(TUTORIALS).filter((t) => t.scope === scope);
}
