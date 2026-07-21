/**
 * 通知排程（plan v2 §4.1）。每次 updateHealthSettings 後重排所有提醒。
 *
 * iOS notification action button：「+一杯」可從鎖屏直接記錄不開 App。
 */

import * as Notifications from 'expo-notifications';
import type { HealthSettings, ReminderConfig } from './health_settings';
import { dailyReminderTimes, parseHhmm } from './reminders_core';

const CATEGORY_WATER = 'water-quick';

let _initialized = false;
async function ensureCategories() {
  if (_initialized) return;
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_WATER, [
      { identifier: 'add-cup', buttonTitle: '+ 一杯', options: { opensAppToForeground: false } },
    ]);
  } catch {}
  _initialized = true;
}

export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 開啟提醒前的權限 gate。granted 才排程；blocked（iOS 已拒絕且不能再問）→ 呼叫端引導去設定。
 */
export async function ensurePermission(): Promise<'granted' | 'denied' | 'blocked'> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return 'granted';
  if (current.status === 'denied' && current.canAskAgain === false) return 'blocked';
  const req = await Notifications.requestPermissionsAsync();
  if (req.status === 'granted') return 'granted';
  if (req.canAskAgain === false) return 'blocked';
  return 'denied';
}

async function scheduleWater(config: ReminderConfig) {
  if (!config.enabled) return;
  // 喝水改為固定每日重複時間（DAILY repeating）：永久有效、不怕沒開 app、只占少數 slot。
  for (const { hour, minute } of dailyReminderTimes(config)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 該喝水了',
        body: `小提醒：別忘了補水`,
        categoryIdentifier: CATEGORY_WATER,
        data: { type: 'water' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  }
}

async function scheduleFixedReminder(content: { title: string; body: string }, fixedTimes: string[] | undefined) {
  if (!fixedTimes || fixedTimes.length === 0) return;
  for (const t of fixedTimes) {
    const hm = parseHhmm(t);
    if (!hm) continue;
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hm.hour, minute: hm.minute },
    });
  }
}

export async function rescheduleAll(settings: HealthSettings) {
  try {
    await ensureCategories();
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('rescheduleAll: cancel failed', e);
    return; // 沒取消成功就排程會產生重複，直接放棄本輪
  }
  // per-step try：任一種提醒排程失敗，不得讓其餘兩種也一起沒有
  // （全部已先 cancel，一個 throw 會讓使用者變成零提醒且只有一行 console.warn）
  if (settings.water.reminder.enabled) {
    try { await scheduleWater(settings.water.reminder); }
    catch (e) { console.warn('rescheduleAll: water failed', e); }
  }
  if (settings.bowel.reminder.enabled) {
    try {
      await scheduleFixedReminder(
        { title: '💩 排便提醒', body: '今天有上嗎？' },
        settings.bowel.reminder.fixedTimes,
      );
    } catch (e) { console.warn('rescheduleAll: bowel failed', e); }
  }
  if (settings.sleep.reminder.enabled) {
    try {
      await scheduleFixedReminder(
        { title: '😴 該睡覺了', body: '準備休息，明天才有精神' },
        settings.sleep.reminder.fixedTimes,
      );
    } catch (e) { console.warn('rescheduleAll: sleep failed', e); }
  }
}

/** 處理通知 action（從鎖屏點 + 一杯 按鈕） */
export function setupNotificationActionHandler(onAction: (action: string, data: any) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const action = response.actionIdentifier;
    const data = response.notification.request.content.data ?? {};
    onAction(action, data);
  });
}
