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
