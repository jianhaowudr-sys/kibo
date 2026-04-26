import React from 'react';
import DraggableFlatList, {
  DragEndParams,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LONG_PRESS_MS } from '@/lib/gestures';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';

type Props<T> = {
  data: T[];
  /** 取得 row 的唯一 key */
  keyExtractor: (item: T, index: number) => string;
  /** render 一個 row 的內容（不需自己管 long-press / drag UI） */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 拖曳結束 → 新順序 */
  onReorder: (newData: T[]) => void;
  /** ScrollView contentContainerStyle */
  contentContainerStyle?: any;
  /** 是否顯示左側 ≡ handle（預設顯示）。設 false 則整 row 都是長按拖曳區。 */
  showHandle?: boolean;
  /** 自訂 row 容器樣式（pixel 風時可用 chunky border） */
  rowStyle?: any;
};

/**
 * 全 App 共用拖曳排序清單（plan v2 §3.2 / A3）。
 *
 * 互動：
 *  - 長按 row（500ms）→ 觸覺 + row 浮起 → 進入拖曳
 *  - 放下 → success 觸覺 + onReorder 回傳新順序
 *
 * 用法：
 *   <DraggableList
 *     data={rexs}
 *     keyExtractor={(it) => String(it.id)}
 *     renderItem={(it) => <ExerciseRow ex={it} />}
 *     onReorder={(arr) => persist(arr)}
 *   />
 */
export function DraggableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  contentContainerStyle,
  showHandle = true,
  rowStyle,
}: Props<T>) {
  const palette = useThemePalette();

  const handleDragEnd = ({ data: newData, from, to }: DragEndParams<T>) => {
    if (from === to) return;
    haptic.success();
    onReorder(newData);
  };

  const renderRow = ({ item, drag, isActive, getIndex }: RenderItemParams<T>) => {
    const idx = getIndex() ?? 0;
    return (
      <Pressable
        onLongPress={() => {
          haptic.tapMedium();
          drag();
        }}
        delayLongPress={LONG_PRESS_MS}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            opacity: isActive ? 0.92 : 1,
            transform: [{ scale: isActive ? 1.02 : 1 }],
            shadowColor: palette.text,
            shadowOpacity: isActive ? 0.25 : 0,
            shadowRadius: isActive ? 8 : 0,
            shadowOffset: { width: 0, height: isActive ? 4 : 0 },
            elevation: isActive ? 6 : 0,
          },
          rowStyle,
        ]}
      >
        {showHandle && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: palette.mute, fontSize: 18 }}>≡</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>{renderItem(item, idx)}</View>
      </Pressable>
    );
  };

  return (
    <DraggableFlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderRow}
      onDragEnd={handleDragEnd}
      contentContainerStyle={contentContainerStyle}
      activationDistance={5}
    />
  );
}

export default DraggableList;
