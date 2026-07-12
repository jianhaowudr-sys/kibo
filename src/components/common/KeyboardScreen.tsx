import React from 'react';
import { KeyboardAvoidingView, Platform, type ViewStyle } from 'react-native';

/**
 * 統一的鍵盤避讓包裹。整頁（含底部固定 bar）包在裡面，鍵盤彈出時把整組推上去。
 * 參數對齊 workout/active.tsx 已在生產驗證的那套：iOS 用 padding、Android 靠 window resize（app.json 預設）。
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
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
