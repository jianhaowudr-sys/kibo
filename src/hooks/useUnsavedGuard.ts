import { useCallback } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

/**
 * Android 硬體返回鍵守門。
 * 這些表單頁多為 modal presentation，Android 按硬體返回會**直接 dismiss、無確認** →
 * 打到一半的內容靜默消失（iOS 是 pageSheet，需刻意下滑才關，風險低，故只在 Android 生效）。
 *
 * 用 useFocusEffect 確保只有「當前聚焦」的頁面攔截返回（多頁堆疊時不會互相搶）。
 *
 * @param hasUnsavedChanges 目前是否有未儲存內容；false 時放行預設返回（空表單直接返回不打擾）
 * @param opts.message 自訂確認訊息
 */
export function useUnsavedGuard(
  hasUnsavedChanges: boolean,
  opts?: { title?: string; message?: string },
) {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const onBack = () => {
        if (!hasUnsavedChanges) return false; // 放行系統預設返回
        Alert.alert(
          opts?.title ?? '捨棄未儲存的內容？',
          opts?.message ?? '你在這頁的變更尚未儲存，返回將不會保留。',
          [
            { text: '繼續編輯', style: 'cancel' },
            { text: '捨棄', style: 'destructive', onPress: () => router.back() },
          ],
        );
        return true; // 攔截：不讓系統直接關頁
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [hasUnsavedChanges, router, opts?.title, opts?.message]),
  );
}
