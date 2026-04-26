import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useThemePalette } from '@/lib/useThemePalette';
import { SWIPE_OVERSHOOT, SWIPE_RIGHT_THRESHOLD } from '@/lib/gestures';
import * as haptic from '@/lib/haptic';

type Props = {
  /** 左滑出現的「刪除」按鈕觸發 */
  onDelete: () => void | Promise<void>;
  /** 自訂刪除按鈕文字 */
  deleteLabel?: string;
  children?: React.ReactNode;
};

/**
 * 通用左滑刪除 row。延用首頁 workout list 的相同 pattern + 共用常數。
 * 與 UndoToast 搭配時，呼叫處應在 onDelete 內 push undo entry。
 */
export function SwipeableRow({ onDelete, deleteLabel = '🗑 刪除', children }: Props) {
  const palette = useThemePalette();
  return (
    <Swipeable
      overshootRight={SWIPE_OVERSHOOT}
      rightThreshold={SWIPE_RIGHT_THRESHOLD}
      renderRightActions={() => (
        <Pressable
          onPressIn={() => haptic.tapMedium()}
          onPress={async () => {
            haptic.warning();
            await onDelete();
          }}
          style={{
            backgroundColor: palette.danger,
            justifyContent: 'center',
            paddingHorizontal: 20,
            borderRadius: 12,
            marginBottom: 6,
            marginLeft: 8,
          }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700' }}>{deleteLabel}</Text>
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
  );
}

export default SwipeableRow;
