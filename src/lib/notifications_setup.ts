import * as Notifications from 'expo-notifications';

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
