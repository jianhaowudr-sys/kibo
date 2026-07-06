# 訓練計時/佇列改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ① 進行中訓練佇列可長按選單上移/下移/移除；② 組間計時 4 個秒數可自定；③ 組間休息以時間戳為真相，背景回來正確扣時、到點跳本地通知。

**Architecture:** 純函數（`clampDuration`/`parseDurations`/`computeRemaining`/`swapAdjacent`）放零-runtime-import 的 `rest_timer_core.ts`（node 斷言）；AsyncStorage 存取 + expo-notifications 排程放 `rest_timer.ts`；`RestTimer` 改用 `endTime` 時間戳 + `AppState` 回前景重算 + 排/取消通知；佇列排序用 store action `reorderQueue`（`swapAdjacent`）+ `active.tsx` 長按選單。

**Tech Stack:** Expo 54 / RN 0.81 / TypeScript strict / Zustand / AsyncStorage / expo-notifications（已用於喝水提醒）/ NativeWind。無測試框架——純函數用 `npx -y tsx scripts/verify_rest_timer.ts`，其餘 `npx tsc --noEmit` ＋手動煙測。

## Global Constraints
- 提交訊息用繁中、`<type>: <描述>`；不加 Co-Authored-By footer（比對 repo 既有風格）。
- 每個 task 完成 `npx tsc --noEmit` 必須乾淨。
- `rest_timer_core.ts` 只能 `import type`（零 runtime import），否則 `npx tsx` 斷言會拉進 RN 模組。

**Spec:** `docs/superpowers/specs/2026-07-06-workout-timer-improvements-design.md`（已核可）

---

## 檔案結構總覽

| 動作 | 檔案 | 職責 |
|---|---|---|
| Create | `src/lib/rest_timer_core.ts` | 純：`DEFAULT_DURATIONS`、`clampDuration`、`parseDurations`、`computeRemaining`、`swapAdjacent` |
| Create | `scripts/verify_rest_timer.ts` | 純函數斷言腳本 |
| Create | `src/lib/rest_timer.ts` | IO：`getRestDurations`/`setRestDurations`；通知 `scheduleRestDoneNotification`/`cancelRestNotification` |
| Modify | `src/stores/useAppStore.ts` | `reorderQueue(exerciseId, dir)` action |
| Modify | `app/workout/active.tsx` | 佇列晶片長按 → 上移/下移/移除 選單；提示文字 |
| Modify | `src/components/RestTimer.tsx` | 自定秒數 + 就地 WheelPicker 編輯；endTime 化；AppState；通知 |

---

### Task 1: 純函數 core + 斷言腳本

**Files:** Create `src/lib/rest_timer_core.ts`, `scripts/verify_rest_timer.ts`

**Interfaces:**
- Produces: `DEFAULT_DURATIONS: number[]`；`clampDuration(n: number): number`；`parseDurations(raw: string | null): number[]`；`computeRemaining(endTime: number, now: number): number`；`swapAdjacent<T extends { id: number }>(list: T[], id: number, dir: 'up' | 'down'): T[]`。

- [ ] **Step 1: 先寫斷言腳本（必然失敗）**

建立 `scripts/verify_rest_timer.ts`：

```ts
// rest_timer_core 純函數斷言。執行：npx -y tsx scripts/verify_rest_timer.ts
import { clampDuration, parseDurations, computeRemaining, swapAdjacent, DEFAULT_DURATIONS } from '../src/lib/rest_timer_core';

let passed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok - ${name}`);
}
const eq = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// clampDuration
check('clamp 正常值', clampDuration(30) === 30);
check('clamp 低於下限 → 5', clampDuration(3) === 5);
check('clamp 高於上限 → 900', clampDuration(1000) === 900);
check('clamp NaN → 60', clampDuration(NaN) === 60);
check('clamp 負數 → 5', clampDuration(-5) === 5);
check('clamp 四捨五入', clampDuration(62.4) === 62);

// parseDurations
check('parse null → DEFAULT', eq(parseDurations(null), DEFAULT_DURATIONS));
check('parse 正常', eq(parseDurations('[10,20,30,40]'), [10, 20, 30, 40]));
check('parse 非 4 元素 → DEFAULT', eq(parseDurations('[10,20,30]'), DEFAULT_DURATIONS));
check('parse 壞 JSON → DEFAULT', eq(parseDurations('not json'), DEFAULT_DURATIONS));
check('parse 元素 clamp', eq(parseDurations('[1,2,3,4]'), [5, 5, 5, 5]));
check('parse 字串數字', eq(parseDurations('["10","20","30","40"]'), [10, 20, 30, 40]));

// computeRemaining
check('remaining 未到', computeRemaining(1000 + 3000, 1000) === 3);
check('remaining 剛好 → 0', computeRemaining(1000, 1000) === 0);
check('remaining 已過 → 0', computeRemaining(1000, 6000) === 0);
check('remaining 無條件進位', computeRemaining(1000 + 1500, 1000) === 2);

// swapAdjacent
const L = [{ id: 1 }, { id: 2 }, { id: 3 }];
check('swap 中間項上移', eq(swapAdjacent(L, 2, 'up').map((x) => x.id), [2, 1, 3]));
check('swap 中間項下移', eq(swapAdjacent(L, 2, 'down').map((x) => x.id), [1, 3, 2]));
check('swap 首項上移 → 不變', eq(swapAdjacent(L, 1, 'up').map((x) => x.id), [1, 2, 3]));
check('swap 末項下移 → 不變', eq(swapAdjacent(L, 3, 'down').map((x) => x.id), [1, 2, 3]));
check('swap 找不到 → 不變', eq(swapAdjacent(L, 99, 'up').map((x) => x.id), [1, 2, 3]));

console.log(`ALL PASS (${passed} checks)`);
```

- [ ] **Step 2: 跑腳本確認失敗**

Run: `npx -y tsx scripts/verify_rest_timer.ts`
Expected: FAIL `Cannot find module '../src/lib/rest_timer_core'`。

- [ ] **Step 3: 建立 `src/lib/rest_timer_core.ts`**

```ts
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
```

- [ ] **Step 4: 跑腳本確認全過**

Run: `npx -y tsx scripts/verify_rest_timer.ts`
Expected: 逐行 `ok - …`，最後 `ALL PASS (21 checks)`。

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。

- [ ] **Step 6: Commit**

```bash
git add src/lib/rest_timer_core.ts scripts/verify_rest_timer.ts docs/superpowers/specs/2026-07-06-workout-timer-improvements-design.md docs/superpowers/plans/2026-07-06-workout-timer-improvements.md
git commit -m "feat(timer): rest_timer_core 純函數 + 斷言腳本（併補 spec/plan）"
```

（註：spec 與 plan 因先前工具限制未 commit，隨本 task 一併補上。若已被 commit 則只 add 前兩個檔。）

---

### Task 2: rest_timer.ts（自定秒數存取 + 通知）

**Files:** Create `src/lib/rest_timer.ts`

**Interfaces:**
- Consumes: `parseDurations`/`clampDuration`/`DEFAULT_DURATIONS` from `@/lib/rest_timer_core`；`requestPermission` from `@/lib/reminders`。
- Produces: `getRestDurations(): Promise<number[]>`；`setRestDurations(ds: number[]): Promise<void>`；`scheduleRestDoneNotification(seconds: number): Promise<string | null>`；`cancelRestNotification(id: string | null): Promise<void>`。

- [ ] **Step 1: 建立 `src/lib/rest_timer.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { requestPermission } from '@/lib/reminders';
import { parseDurations, clampDuration, DEFAULT_DURATIONS } from '@/lib/rest_timer_core';

const KEY = '@kibo/rest_durations';

export async function getRestDurations(): Promise<number[]> {
  try {
    return parseDurations(await AsyncStorage.getItem(KEY));
  } catch {
    return [...DEFAULT_DURATIONS];
  }
}

export async function setRestDurations(ds: number[]): Promise<void> {
  const clamped = ds.map(clampDuration);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(clamped));
  } catch {}
}

/** 排「休息結束」通知，seconds 秒後觸發。未授權 → 回 null 不排。回 notification id。 */
export async function scheduleRestDoneNotification(seconds: number): Promise<string | null> {
  try {
    const ok = await requestPermission();
    if (!ok) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: '⏱ 休息結束', body: '開始下一組！', data: { type: 'rest' } },
      trigger: { seconds: Math.max(1, Math.round(seconds)) } as any,
    });
  } catch {
    return null;
  }
}

export async function cancelRestNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。（`requestPermission` 由 `src/lib/reminders.ts` export；`Notifications` = `expo-notifications`；`scheduleNotificationAsync` 回 `Promise<string>`。若 `trigger` 型別報錯，`as any` 已比照 `reminders.ts:63` 既有用法。）

- [ ] **Step 3: 斷言回歸（未動 core）**

Run: `npx -y tsx scripts/verify_rest_timer.ts`
Expected: `ALL PASS (21 checks)`。

- [ ] **Step 4: Commit**

```bash
git add src/lib/rest_timer.ts
git commit -m "feat(timer): 自定秒數存取 + 休息結束本地通知排程/取消"
```

---

### Task 3: store `reorderQueue`

**Files:** Modify `src/stores/useAppStore.ts`

**Interfaces:**
- Consumes: `swapAdjacent` from `@/lib/rest_timer_core`；既有 state `routineQueue: Exercise[]`。
- Produces: store action `reorderQueue: (exerciseId: number, dir: 'up' | 'down') => void`。

- [ ] **Step 1: import**

在 `useAppStore.ts` 既有 import 區加：

```ts
import { swapAdjacent } from '@/lib/rest_timer_core';
```

- [ ] **Step 2: Actions 介面簽章**

找 Actions 介面的 `removeFromQueue: (exerciseId: number) => void;`（約 line 237），其後加：

```ts
  reorderQueue: (exerciseId: number, dir: 'up' | 'down') => void;
```

- [ ] **Step 3: action 實作**

找 `removeFromQueue` 的實作（約 line 1427-1430）：

```ts
  removeFromQueue: (exerciseId) => {
    const { routineQueue } = get();
    set({ routineQueue: routineQueue.filter((e) => e.id !== exerciseId) });
  },
```

其後加：

```ts
  reorderQueue: (exerciseId, dir) => {
    const { routineQueue } = get();
    set({ routineQueue: swapAdjacent(routineQueue, exerciseId, dir) });
  },
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。（`swapAdjacent<T extends {id:number}>` 對 `Exercise[]`（Exercise 有 `id: number`）成立。）

- [ ] **Step 5: Commit**

```bash
git add src/stores/useAppStore.ts
git commit -m "feat(timer): store reorderQueue（進行中佇列上/下移）"
```

---

### Task 4: `active.tsx` 佇列長按選單

**Files:** Modify `app/workout/active.tsx`

**Interfaces:**
- Consumes: store `reorderQueue`、`removeFromQueue`（既有）、`routineQueue`（既有）。

- [ ] **Step 1: 取用 reorderQueue**

在 `active.tsx` 既有 `const removeFromQueue = useAppStore((s) => s.removeFromQueue);`（或同批 selector）附近加：

```tsx
  const reorderQueue = useAppStore((s) => s.reorderQueue);
```

- [ ] **Step 2: 提示文字**

把（約 line 284）：

```tsx
              {routineQueue.length > 0 && <Text className="text-kibo-mute font-normal"> · 長按移除</Text>}
```

改為：

```tsx
              {routineQueue.length > 0 && <Text className="text-kibo-mute font-normal"> · 長按可調整順序/移除</Text>}
```

- [ ] **Step 3: 長按改為選單**

把晶片的 `onLongPress`（約 line 310-327 的「從清單移除？」Alert）整段替換為：

```tsx
                    onLongPress={() => {
                      haptic.tapMedium();
                      const idx = routineQueue.findIndex((e) => e.id === ex.id);
                      const buttons: any[] = [];
                      if (idx > 0) buttons.push({ text: '⬆ 上移', onPress: () => reorderQueue(ex.id, 'up') });
                      if (idx < routineQueue.length - 1) buttons.push({ text: '⬇ 下移', onPress: () => reorderQueue(ex.id, 'down') });
                      buttons.push({
                        text: '移除',
                        style: 'destructive',
                        onPress: () => {
                          removeFromQueue(ex.id);
                          if (selectedId === ex.id) setSelectedExerciseId(null);
                        },
                      });
                      buttons.push({ text: '取消', style: 'cancel' });
                      Alert.alert(ex.name, '調整順序或移除', buttons);
                    }}
```

（`selectedId`、`setSelectedExerciseId`、`Alert`、`haptic` 都已在檔案作用域。）

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。

- [ ] **Step 5: Commit**

```bash
git add app/workout/active.tsx
git commit -m "feat(timer): 進行中佇列長按選單（上移/下移/移除）"
```

---

### Task 5: RestTimer — 自定秒數 + endTime 背景化 + 通知

**Files:** Modify `src/components/RestTimer.tsx`（整檔替換）

**Interfaces:**
- Consumes: `computeRemaining`/`DEFAULT_DURATIONS` from `@/lib/rest_timer_core`；`getRestDurations`/`setRestDurations`/`scheduleRestDoneNotification`/`cancelRestNotification` from `@/lib/rest_timer`；`WheelPicker` from `@/components/common/WheelPicker`。
- 對外 props 不變：`RestTimer({ autoStartKey?: number })`。

- [ ] **Step 1: 整檔替換 `src/components/RestTimer.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, AppState, Modal } from 'react-native';
import * as haptic from '@/lib/haptic';
import { computeRemaining, DEFAULT_DURATIONS } from '@/lib/rest_timer_core';
import { getRestDurations, setRestDurations, scheduleRestDoneNotification, cancelRestNotification } from '@/lib/rest_timer';
import { WheelPicker } from '@/components/common/WheelPicker';

const WHEEL_VALUES = Array.from({ length: 120 }, (_, i) => (i + 1) * 5); // 5..600

/**
 * 組間計時（endTime 時間戳為真相，背景回前景重算 + 到點本地通知）。
 * - idle：薄 header；展開顯示 4 個可自定秒數格（長按格改秒數）+ 開始
 * - 計時中：只顯示倒數大字
 */
export function RestTimer({ autoStartKey }: { autoStartKey?: number }) {
  const [durations, setDurations] = useState<number[]>(DEFAULT_DURATIONS);
  const [preset, setPreset] = useState(60);
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [expanded, setExpanded] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState(60);

  const endTimeRef = useRef(0);
  const notifIdRef = useRef<string | null>(null);
  const doneFiredRef = useRef(false);
  const cue4FiredRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  useEffect(() => { activeRef.current = active; }, [active]);

  // 載入自定秒數
  useEffect(() => {
    getRestDurations().then(setDurations);
  }, []);

  const finish = () => {
    if (doneFiredRef.current) return;
    doneFiredRef.current = true;
    haptic.success();
    cancelRestNotification(notifIdRef.current);
    notifIdRef.current = null;
    setActive(false);
  };

  const beginRest = async (seconds: number) => {
    // 先同步切到計時中（畫面立即反應），再處理通知排程/取消
    const prevNotif = notifIdRef.current;
    doneFiredRef.current = false;
    cue4FiredRef.current = false;
    endTimeRef.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    setActive(true);
    setExpanded(false);
    notifIdRef.current = await scheduleRestDoneNotification(seconds);
    await cancelRestNotification(prevNotif); // 取消前一次殘留（若有）
  };

  // autoStartKey 觸發
  useEffect(() => {
    if (autoStartKey == null || autoStartKey === 0) return;
    beginRest(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartKey]);

  // 顯示 tick（500ms 重算；背景凍結不影響 endTime 真相）
  useEffect(() => {
    if (!active) return;
    tickRef.current = setInterval(() => {
      const r = computeRemaining(endTimeRef.current, Date.now());
      if (r <= 0) { finish(); return; }
      if (r === 4 && !cue4FiredRef.current) { cue4FiredRef.current = true; haptic.tapLight(); }
      setRemaining(r);
    }, 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // AppState 回前景重算（用 ref 避免重綁）
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && activeRef.current) {
        const r = computeRemaining(endTimeRef.current, Date.now());
        if (r <= 0) finish();
        else setRemaining(r);
      }
    });
    return () => sub.remove();
  }, []);

  // 卸載清理
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      cancelRestNotification(notifIdRef.current);
    };
  }, []);

  const start = () => { haptic.tapLight(); beginRest(preset); };

  const openEdit = (i: number) => {
    haptic.tapMedium();
    setEditIdx(i);
    setEditValue(durations[i]);
  };

  const saveEdit = () => {
    if (editIdx == null) return;
    const wasSelected = durations[editIdx] === preset;
    const next = durations.slice();
    next[editIdx] = editValue;
    setDurations(next);
    setRestDurations(next);
    if (wasSelected) { setPreset(editValue); setRemaining(editValue); }
    setEditIdx(null);
  };

  const mmss = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;

  if (active) {
    return (
      <View className="bg-kibo-surface rounded-2xl border border-kibo-primary px-4 py-4 items-center">
        <Text className="text-kibo-mute text-[11px] mb-1">⏱ 組間休息</Text>
        <Text className="text-kibo-primary text-5xl font-bold">{mmss}</Text>
      </View>
    );
  }

  return (
    <View className="bg-kibo-surface rounded-2xl border border-kibo-card overflow-hidden">
      <Pressable
        onPress={() => { haptic.tapLight(); setExpanded((v) => !v); }}
        className="flex-row items-center justify-between px-4 py-2.5 active:opacity-70"
      >
        <Text className="text-kibo-mute text-xs">⏱ 組間計時</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-kibo-mute text-xs font-bold">{preset}s</Text>
          <Text className="text-kibo-mute text-xs">{expanded ? '▴' : '▾'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 pt-1 border-t border-kibo-card">
          <View className="flex-row gap-2 mb-2">
            {durations.map((p, i) => (
              <Pressable
                key={i}
                onPress={() => { haptic.tapLight(); setPreset(p); setRemaining(p); }}
                onLongPress={() => openEdit(i)}
                className={`flex-1 py-2 rounded-xl ${preset === p ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
              >
                <Text className={`text-center font-semibold ${preset === p ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                  {p}s
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-kibo-mute text-[10px] mb-3">長按秒數格可修改</Text>
          <Pressable onPress={start} className="bg-kibo-success rounded-xl py-3">
            <Text className="text-kibo-bg text-center font-bold">開始休息</Text>
          </Pressable>
        </View>
      )}

      <Modal transparent animationType="slide" visible={editIdx != null} onRequestClose={() => setEditIdx(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View className="bg-kibo-bg rounded-t-3xl p-4">
            <View className="flex-row items-center mb-3">
              <Text className="text-kibo-text text-base font-bold flex-1">設定秒數</Text>
              <Pressable onPress={() => setEditIdx(null)} hitSlop={8}>
                <Text className="text-kibo-mute text-2xl">✕</Text>
              </Pressable>
            </View>
            <View className="items-center my-2">
              <WheelPicker
                values={WHEEL_VALUES}
                value={editValue}
                onChange={(v) => setEditValue(v as number)}
                formatLabel={(v) => `${v}s`}
                width={120}
              />
            </View>
            <Pressable onPress={saveEdit} className="bg-kibo-primary rounded-2xl py-4 mt-2">
              <Text className="text-kibo-bg text-center font-bold">確認</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。（`AppState.addEventListener('change', ...)` 回 subscription 有 `.remove()`；`WheelPicker<number>` 的 `onChange` 收 `number`，`value` 為 `editValue`。）

- [ ] **Step 3: 斷言回歸**

Run: `npx -y tsx scripts/verify_rest_timer.ts`
Expected: `ALL PASS (21 checks)`。

- [ ] **Step 4: Commit**

```bash
git add src/components/RestTimer.tsx
git commit -m "feat(timer): RestTimer 自定秒數就地編輯 + endTime 背景化 + 到點通知"
```

---

### Task 6: 驗收

**Files:** Modify `docs/superpowers/specs/2026-07-06-workout-timer-improvements-design.md`

- [ ] **Step 1: 全量自動檢查**

Run: `npx tsc --noEmit && npx -y tsx scripts/verify_rest_timer.ts`
Expected: tsc 無輸出；腳本 `ALL PASS (21 checks)`。

- [ ] **Step 2: 裝置回歸清單（需使用者）**

| # | 項目 | 怎麼驗 |
|---|---|---|
| 1 | 佇列排序 | 進行中訓練長按動作晶片 → 上移/下移/移除；首項無上移、末項無下移 |
| 2 | 自定秒數 | 展開組間計時 → 長按某格 → 滾輪改秒數 → 確認；重開 App 仍保留 |
| 3 | 背景扣時 | 開始休息 → 縮到背景數秒 → 回來，剩餘時間已正確扣掉（非停在原地） |
| 4 | 背景通知 | 休息中縮到背景 → 到點跳「⏱ 休息結束」通知 |
| 5 | 前景歸零 | 休息在前景自然歸零 → 震動一次、不重複、無殘留通知 |
| 6 | 取消殘留 | 休息中離開進行中訓練頁 → 不會再跳通知 |
| 7 | 未授權 | 拒絕通知權限 → App 內倒數（含背景回來重算）照常，只是不推播 |

- [ ] **Step 3: 補 spec 驗收狀態**

在 spec 末尾加「## 驗收狀態（2026-07-06 實作完成）」：自動檢查（tsc + 斷言 21/21）已過；上表裝置回歸待使用者實機驗收。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-06-workout-timer-improvements-design.md
git commit -m "docs(timer): 驗收狀態（自動檢查全綠；實機待使用者）"
```

---

## 附錄：Spec 覆蓋對照

| Spec 要求 | 對應 Task |
|---|---|
| ① reorderQueue + swapAdjacent 純函數 | Task 1, 3 |
| ① active.tsx 長按選單上/下移/移除 | Task 4 |
| ② clampDuration/parseDurations + get/set 存取 | Task 1, 2 |
| ② RestTimer 讀取 + 就地 WheelPicker 編輯 | Task 5 |
| ③ computeRemaining + endTime + AppState 重算 | Task 1, 5 |
| ③ 通知排程/取消 + 一次性守衛 | Task 2, 5 |
| 純函數斷言 + tsc + 裝置回歸 | Task 1, 6 |
