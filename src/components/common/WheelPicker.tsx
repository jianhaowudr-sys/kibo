import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useThemePalette } from '@/lib/useThemePalette';
import { useLowPower } from '@/hooks/useLowPower';
import * as haptic from '@/lib/haptic';

type Props<T extends number | string> = {
  values: T[];
  value: T;
  onChange: (v: T) => void;
  /** 每格高度（dp）— 預設 44 */
  itemHeight?: number;
  /** 顯示總列數（含中央，必須奇數）— 預設 5 */
  visibleCount?: number;
  /** 顯示文字格式化（例如數字加 "ml"） */
  formatLabel?: (v: T) => string;
  /** 元件寬度 */
  width?: number;
  /** 像素風 */
  pixelFont?: boolean;
};

/**
 * iOS-style 滾輪選擇器。低負擔模式下退化成 [−] / 數字 / [+] 三段按鈕。
 */
export function WheelPicker<T extends number | string>({
  values,
  value,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  formatLabel,
  width = 100,
  pixelFont = false,
}: Props<T>) {
  const palette = useThemePalette();
  const lowPower = useLowPower();
  const listRef = useRef<FlatList<T>>(null);
  const [currentIdx, setCurrentIdx] = useState(() => Math.max(0, values.indexOf(value)));
  const lastIdxRef = useRef(currentIdx);

  // 外部 value 變更時同步捲動
  useEffect(() => {
    const idx = values.indexOf(value);
    if (idx >= 0 && idx !== currentIdx) {
      setCurrentIdx(idx);
      listRef.current?.scrollToOffset({ offset: idx * itemHeight, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // 低負擔模式：簡單三段按鈕
  if (lowPower) {
    const idx = values.indexOf(value);
    const canDec = idx > 0;
    const canInc = idx >= 0 && idx < values.length - 1;
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        width, height: itemHeight * 3, gap: 8,
      }}>
        <Pressable
          onPress={() => {
            if (!canDec) return;
            haptic.tapLight();
            onChange(values[idx - 1]);
          }}
          style={{
            width: 40, height: 40, borderRadius: 8,
            backgroundColor: canDec ? palette.card : palette.surface,
            alignItems: 'center', justifyContent: 'center',
            opacity: canDec ? 1 : 0.4,
          }}
        >
          <Text style={{ color: palette.text, fontSize: 22, fontWeight: '700' }}>−</Text>
        </Pressable>
        <View style={{
          paddingVertical: 8, paddingHorizontal: 16,
          borderWidth: 2, borderColor: palette.primary, borderRadius: 8,
          minWidth: width * 0.5, alignItems: 'center',
        }}>
          <Text style={{ color: palette.text, fontSize: 22, fontWeight: '700', fontFamily: pixelFont ? 'Cubic11' : undefined }}>
            {formatLabel ? formatLabel(value) : String(value)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (!canInc) return;
            haptic.tapLight();
            onChange(values[idx + 1]);
          }}
          style={{
            width: 40, height: 40, borderRadius: 8,
            backgroundColor: canInc ? palette.card : palette.surface,
            alignItems: 'center', justifyContent: 'center',
            opacity: canInc ? 1 : 0.4,
          }}
        >
          <Text style={{ color: palette.text, fontSize: 22, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>
    );
  }

  // 完整滾輪
  const padCount = Math.floor(visibleCount / 2);
  const containerHeight = visibleCount * itemHeight;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    const idx = Math.round(offset / itemHeight);
    if (idx !== lastIdxRef.current && idx >= 0 && idx < values.length) {
      lastIdxRef.current = idx;
      haptic.tapLight();
    }
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    const idx = Math.round(offset / itemHeight);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    setCurrentIdx(clamped);
    if (values[clamped] !== value) {
      onChange(values[clamped]);
    }
  };

  return (
    <View style={{ width, height: containerHeight, overflow: 'hidden', position: 'relative' }}>
      {/* 中央 highlight 區（描邊條） */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: padCount * itemHeight,
          left: 0, right: 0,
          height: itemHeight,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: palette.primary,
          zIndex: 1,
        }}
      />

      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingTop: padCount * itemHeight,
          paddingBottom: padCount * itemHeight,
        }}
        getItemLayout={(_, i) => ({ length: itemHeight, offset: i * itemHeight, index: i })}
        initialScrollIndex={Math.max(0, values.indexOf(value))}
        renderItem={({ item, index }) => {
          const distance = Math.abs(index - currentIdx);
          const isActive = distance === 0;
          const opacity = isActive ? 1 : 0.45 - Math.min(distance, padCount) * 0.08;
          return (
            <View style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  color: isActive ? palette.text : palette.mute,
                  fontSize: isActive ? 22 : 18,
                  fontWeight: isActive ? '700' : '400',
                  opacity: Math.max(0.2, opacity),
                  fontFamily: pixelFont ? 'Cubic11' : undefined,
                }}
              >
                {formatLabel ? formatLabel(item) : String(item)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

export default WheelPicker;
