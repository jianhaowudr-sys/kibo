import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { UNDO_TOAST_SECONDS } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';

/**
 * 全 App 唯一一個 UndoToast，掛在 _layout.tsx 根層。
 * 任何 quick-add 路徑 push undo 後 5 秒內可從這裡撤銷。
 */
export function UndoToast() {
  const palette = useThemePalette();
  const stack = useAppStore((s) => s.undoStack);
  const triggerUndo = useAppStore((s) => s.triggerUndo);
  const popUndo = useAppStore((s) => s.popUndo);
  const top = stack[0];
  const [remaining, setRemaining] = useState<number>(UNDO_TOAST_SECONDS);

  useEffect(() => {
    if (!top) return;
    setRemaining(UNDO_TOAST_SECONDS);
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((top.expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(tick);
        popUndo();
      }
    }, 250);
    return () => clearInterval(tick);
  }, [top?.id, top?.expiresAt]);

  if (!top) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 90,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 999,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.surface,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: palette.card,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text style={{ color: palette.success, marginRight: 8 }}>✓</Text>
        <Text style={{ color: palette.text, marginRight: 12 }}>{top.message}</Text>
        <Pressable
          onPress={() => {
            haptic.warning();
            triggerUndo();
          }}
          hitSlop={8}
          style={{
            backgroundColor: palette.card,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: palette.text, fontWeight: '600' }}>⌫ 撤銷 ({remaining})</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default UndoToast;
