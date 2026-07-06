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
