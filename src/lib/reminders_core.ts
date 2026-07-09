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
