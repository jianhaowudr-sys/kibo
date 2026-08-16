import React from 'react';
import { type ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/**
 * 統一的鍵盤避讓包裹。整頁（含底部固定 bar）包在裡面，鍵盤彈出時把整組推上去。
 *
 * 用 react-native-keyboard-controller 的 KeyboardAvoidingView，而非 RN 內建版：
 * RN 版在 Android 靠 window resize，但本專案 app.json 開了 edgeToEdgeEnabled → 系統不再把
 * IME inset 塞給 window、adjustResize 失效，`behavior=undefined` 的 Android 分支等於什麼都沒做，
 * 底部輸入框/儲存鈕會被鍵盤蓋住。keyboard-controller 讀的是 IME 事件，兩平台 + edge-to-edge 都正確。
 * behavior 兩平台都用 'padding'（該套件在 Android 也正確處理）。
 */
export function KeyboardScreen({
  children,
  offset = 0,
  style,
}: {
  children: React.ReactNode;
  offset?: number;
  style?: ViewStyle;
}) {
  return (
    <KeyboardAvoidingView
      className="bg-kibo-bg"
      style={[{ flex: 1 }, style]}
      behavior="padding"
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
