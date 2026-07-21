// 通知排程純函數：零 import（node 可直接跑，見 scripts/verify_reminders.ts）。

export type Window = { startHour: number; endHour: number };

/**
 * 未來 7 天、每日 [startHour, endHour) 內每 intervalMin 分、且 > nowMs 的觸發時間（ms epoch）。
 * intervalMin 非有限或 <= 0 → 回 []（避免無窮迴圈）。
 */
export function buildIntervalTriggers(intervalMin: number, win: Window, nowMs: number): number[] {
  const out: number[] = [];
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) return out;
  const baseDate = new Date(nowMs).getDate();
  for (let d = 0; d < 7; d++) {
    const day = new Date(nowMs);
    day.setDate(baseDate + d);
    day.setHours(win.startHour, 0, 0, 0);
    while (day.getHours() < win.endHour) {
      if (day.getTime() > nowMs) out.push(day.getTime());
      day.setMinutes(day.getMinutes() + intervalMin);
    }
  }
  return out;
}

/** 解析 "H:MM" / "HH:MM"；hour 0–23、minute 0–59，否則 null。 */
export function parseHhmm(hhmm: string): { hour: number; minute: number } | null {
  if (typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export type Hm = { hour: number; minute: number };

/** 格式化 {hour,minute} → "H:MM"。 */
export function formatHhmm(t: Hm): string {
  return `${t.hour}:${String(t.minute).padStart(2, '0')}`;
}

/**
 * 每日固定提醒時間點（供 iOS DAILY repeating trigger）。取代喝水的 interval 列舉——
 * DAILY 重複永久有效、不怕使用者沒開 app、且只占少數 notification slot（遠 < 64 上限）。
 * - config.fixedTimes 有值 → 直接用（解析、去重、排序、上限）。
 * - 否則從 intervalMin + activeWindow 推導（舊 config 一次性遷移）。
 * - 超過上限時「均勻取樣」保留全天覆蓋，非只取前段。
 */
export function dailyReminderTimes(
  config: { fixedTimes?: string[]; intervalMin?: number; activeWindow?: Window },
  opts?: { maxCount?: number },
): Hm[] {
  const MAX = opts?.maxCount ?? 12;
  const key = (t: Hm) => t.hour * 60 + t.minute;
  const norm = (arr: Hm[]): Hm[] => {
    const seen = new Set<number>();
    const uniq = arr
      .filter((t) => { const k = key(t); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => key(a) - key(b));
    if (uniq.length <= MAX || MAX < 2) return uniq.slice(0, MAX);
    const out: Hm[] = [];
    for (let i = 0; i < MAX; i++) out.push(uniq[Math.round((i * (uniq.length - 1)) / (MAX - 1))]);
    const seen2 = new Set<number>();
    return out.filter((t) => { const k = key(t); if (seen2.has(k)) return false; seen2.add(k); return true; });
  };

  if (config.fixedTimes && config.fixedTimes.length > 0) {
    const parsed = config.fixedTimes
      .map(parseHhmm)
      .filter((x): x is Hm => x !== null);
    return norm(parsed);
  }
  if (config.intervalMin && Number.isFinite(config.intervalMin) && config.intervalMin > 0 && config.activeWindow) {
    const out: Hm[] = [];
    const startMin = config.activeWindow.startHour * 60;
    const endMin = config.activeWindow.endHour * 60;
    for (let m = startMin; m < endMin; m += config.intervalMin) out.push({ hour: Math.floor(m / 60), minute: m % 60 });
    return norm(out);
  }
  return [];
}
