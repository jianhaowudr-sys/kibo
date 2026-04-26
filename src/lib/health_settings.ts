/**
 * 健康設定（plan v2 §4.1）。存在 users.health_settings JSON 欄位。
 */

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
  };
  period: {
    enabled: boolean;
    avgCycleDays: number;
    avgPeriodDays: number;
    predictionEnabled: boolean;
    pmsReminderEnabled: boolean;
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
      type: 'interval',
      intervalMin: 120,
      activeWindow: { startHour: 8, endHour: 22 },
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
  },
  period: {
    enabled: false,
    avgCycleDays: 28,
    avgPeriodDays: 5,
    predictionEnabled: true,
    pmsReminderEnabled: false,
  },
};

export function parseHealthSettings(raw: string | null): HealthSettings {
  if (!raw) return DEFAULT_HEALTH_SETTINGS;
  try {
    const obj = JSON.parse(raw);
    return {
      ...DEFAULT_HEALTH_SETTINGS,
      ...obj,
      water: { ...DEFAULT_HEALTH_SETTINGS.water, ...(obj.water ?? {}) },
      bowel: { ...DEFAULT_HEALTH_SETTINGS.bowel, ...(obj.bowel ?? {}) },
      sleep: { ...DEFAULT_HEALTH_SETTINGS.sleep, ...(obj.sleep ?? {}) },
      period: { ...DEFAULT_HEALTH_SETTINGS.period, ...(obj.period ?? {}) },
    };
  } catch {
    return DEFAULT_HEALTH_SETTINGS;
  }
}

export function stringifyHealthSettings(s: HealthSettings): string {
  return JSON.stringify(s);
}
