/**
 * 健康設定（plan v2 §4.1）。存在 users.health_settings JSON 欄位。
 */

import { dailyReminderTimes, formatHhmm } from './reminders_core';

export type ReminderConfig = {
  enabled: boolean;
  type: 'interval' | 'fixed';
  intervalMin?: number;
  fixedTimes?: string[];     // 'HH:MM'
  activeWindow?: { startHour: number; endHour: number };
};

export type HealthSettings = {
  water: {
    dailyGoalMl: number;
    favoriteCupMl: number;
    bottleMl: number;
    minStepMl: number;
    reminder: ReminderConfig;
  };
  bowel: {
    reminder: ReminderConfig;
  };
  sleep: {
    targetDurationMin: number;
    targetBedtime: string;     // 'HH:MM'
    targetWakeTime: string;
    wakePrompt: { enabled: boolean; afterHour: number };
    reminder: ReminderConfig;
    /** 跨夜歸日 cutoff：上床 hour < 此值 → 算前一天的睡眠延伸（熬夜）。預設 4。 */
    crossNightCutoffHour: number;
  };
  period: {
    enabled: boolean;
    avgCycleDays: number;
    avgPeriodDays: number;
    predictionEnabled: boolean;
    pmsReminderEnabled: boolean;
  };
  body: {
    /** 手掌張開總長：中指尖到手腕，cm */
    palmLengthCm: number;
    /** 手掌張開時四指根的橫寬（不含拇指），cm */
    palmWidthCm: number;
  };
};

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  water: {
    dailyGoalMl: 2000,
    favoriteCupMl: 250,
    bottleMl: 600,
    minStepMl: 100,
    reminder: {
      enabled: false,
      type: 'fixed',
      fixedTimes: ['8:00', '12:00', '16:00', '20:00'],
    },
  },
  bowel: {
    reminder: {
      enabled: false,
      type: 'fixed',
      fixedTimes: ['20:00'],
    },
  },
  sleep: {
    targetDurationMin: 480,
    targetBedtime: '23:00',
    targetWakeTime: '07:00',
    wakePrompt: { enabled: true, afterHour: 5 },
    reminder: {
      enabled: false,
      type: 'fixed',
      fixedTimes: ['22:30'],
    },
    crossNightCutoffHour: 4,
  },
  period: {
    enabled: false,
    avgCycleDays: 28,
    avgPeriodDays: 5,
    predictionEnabled: true,
    pmsReminderEnabled: false,
  },
  body: {
    palmLengthCm: 18,  // 成人平均偏中等
    palmWidthCm: 9,
  },
};

export function parseHealthSettings(raw: string | null): HealthSettings {
  if (!raw) return DEFAULT_HEALTH_SETTINGS;
  try {
    const obj = JSON.parse(raw);
    const merged: HealthSettings = {
      ...DEFAULT_HEALTH_SETTINGS,
      ...obj,
      water: { ...DEFAULT_HEALTH_SETTINGS.water, ...(obj.water ?? {}) },
      bowel: { ...DEFAULT_HEALTH_SETTINGS.bowel, ...(obj.bowel ?? {}) },
      sleep: { ...DEFAULT_HEALTH_SETTINGS.sleep, ...(obj.sleep ?? {}) },
      period: { ...DEFAULT_HEALTH_SETTINGS.period, ...(obj.period ?? {}) },
      body: { ...DEFAULT_HEALTH_SETTINGS.body, ...(obj.body ?? {}) },
    };
    // 遷移：舊喝水提醒為 interval 模型（無 fixedTimes）→ 轉成固定每日時間
    const wr = merged.water.reminder;
    if (wr && (!wr.fixedTimes || wr.fixedTimes.length === 0)) {
      const derived = dailyReminderTimes(wr).map(formatHhmm);
      merged.water.reminder = {
        ...wr,
        type: 'fixed',
        fixedTimes: derived.length > 0 ? derived : DEFAULT_HEALTH_SETTINGS.water.reminder.fixedTimes,
      };
    }
    return merged;
  } catch {
    return DEFAULT_HEALTH_SETTINGS;
  }
}

export function stringifyHealthSettings(s: HealthSettings): string {
  return JSON.stringify(s);
}
