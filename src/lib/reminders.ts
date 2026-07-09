/**
 * 通知排程（plan v2 §4.1）。每次 updateHealthSettings 後重排所有提醒。
 *
 * iOS notification action button：「+一杯」可從鎖屏直接記錄不開 App。
 */

import * as Notifications from 'expo-notifications';
import type { HealthSettings, ReminderConfig } from './health_settings';
import { buildIntervalTriggers, parseHhmm } from './reminders_core';

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

async function scheduleWater(config: ReminderConfig) {
  if (!config.enabled || config.type !== 'interval' || !config.intervalMin || !config.activeWindow) return;
  const triggers = buildIntervalTriggers(config.intervalMin, config.activeWindow, Date.now());
  for (const ms of triggers) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 該喝水了',
        body: `小提醒：別忘了補水`,
        categoryIdentifier: CATEGORY_WATER,
        data: { type: 'water' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(ms) },
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

    if (settings.water.reminder.enabled) {
      await scheduleWater(settings.water.reminder);
    }
    if (settings.bowel.reminder.enabled) {
      await scheduleFixedReminder(
        { title: '💩 排便提醒', body: '今天有上嗎？' },
        settings.bowel.reminder.fixedTimes,
      );
    }
    if (settings.sleep.reminder.enabled) {
      await scheduleFixedReminder(
        { title: '😴 該睡覺了', body: '準備休息，明天才有精神' },
        settings.sleep.reminder.fixedTimes,
      );
    }
  } catch (e) {
    console.warn('rescheduleAll failed', e);
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
