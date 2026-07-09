import { Platform } from 'react-native';
import { buildWidgetPayload, type WidgetInput } from './widget_core';

const APP_GROUP = 'group.app.kibo.fitness';
const APPLE_TARGETS_MODULE = '@bacons/apple-targets';

// 本地最小介面（避免 static import 未裝相依；裝置 build 對照實際 API）。
type ExtensionStorageInstance = { set: (k: string, v: string) => void };
type ExtensionStorageStatic = {
  new (group: string): ExtensionStorageInstance;
  reloadWidget: (name?: string) => void;
};

let ExtensionStorage: ExtensionStorageStatic | null = null;
try { ExtensionStorage = require(APPLE_TARGETS_MODULE).ExtensionStorage as ExtensionStorageStatic; }
catch { ExtensionStorage = null; }

/** 把今日摘要寫進 App Group 並 reload widget timeline；iOS-only、graceful。 */
export function updateWidget(input: WidgetInput): void {
  if (Platform.OS !== 'ios' || !ExtensionStorage) return;
  try {
    const payload = buildWidgetPayload(input);
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set('today', JSON.stringify(payload));
    ExtensionStorage.reloadWidget();
  } catch (e) { console.warn('[widget] update failed', e); }
}
