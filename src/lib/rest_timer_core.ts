// 組間計時純函數：零 runtime import（node 可跑，見 scripts/verify_rest_timer.ts）。

export const DEFAULT_DURATIONS = [30, 60, 90, 120];

/** clamp 到 5–900 秒；非有限數 → 60；四捨五入取整。 */
export function clampDuration(n: number): number {
  if (!Number.isFinite(n)) return 60;
  return Math.min(900, Math.max(5, Math.round(n)));
}

/** parse AsyncStorage JSON；非「4 元素數字陣列」→ DEFAULT_DURATIONS；每元素過 clampDuration。 */
export function parseDurations(raw: string | null): number[] {
  if (!raw) return [...DEFAULT_DURATIONS];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== 4) return [...DEFAULT_DURATIONS];
    return arr.map((x) => clampDuration(typeof x === 'number' ? x : Number(x)));
  } catch {
    return [...DEFAULT_DURATIONS];
  }
}

/** 剩餘秒數（無條件進位；已過歸 0）。背景倒數的真相來源。 */
export function computeRemaining(endTime: number, now: number): number {
  return Math.max(0, Math.ceil((endTime - now) / 1000));
}

/** 與相鄰項交換位置；邊界（首項 up、末項 down、找不到）回原陣列參照。 */
export function swapAdjacent<T extends { id: number }>(list: T[], id: number, dir: 'up' | 'down'): T[] {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return list;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
