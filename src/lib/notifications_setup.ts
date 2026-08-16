import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** 健康提醒（喝水/排便/睡眠）共用的 Android channel id。 */
export const REMINDER_CHANNEL_ID = 'reminders';

// 全域前景通知行為（SDK54：shouldShowBanner/shouldShowList 取代 shouldShowAlert）。
// 模組載入即設定一次，確保任何通知抵達前就緒。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 8+ 必須有 notification channel，否則落到系統預設 channel → 提醒不彈 heads-up、
// 甚至形同半靜音（iOS 沒有 channel 概念，不受影響）。
// 必須一開始就建 HIGH：channel importance 建立後 **app 端無法再調高**（只有使用者能在系統設定改）。
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: '健康提醒',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  }).catch(() => {});
}
