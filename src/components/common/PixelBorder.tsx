import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

type Props = ViewProps & {
  /** 邊框寬度 (px)，預設 3 */
  borderWidth?: number;
  /** 邊框 / shadow 顏色，預設用 currentColor (text-kibo-text) */
  borderColor?: string;
  /** hard shadow 偏移量 (px)，預設 4。設為 0 則無陰影 */
  shadowOffset?: number;
  /** 內部背景色（會塗到內容區），預設透明 */
  bgColor?: string;
  /** 圓角 px，像素風建議 0 (完全方角)，但允許微圓 */
  radius?: number;
  /** 按下狀態：true 時 shadow 縮為 0 + 內容下移 */
  pressed?: boolean;
  children?: React.ReactNode;
};

/**
 * 像素風 chunky border + hard shadow 容器。
 *
 * 結構：
 *  外層 View — 預留 shadowOffset 空間給陰影
 *    └ 陰影 View — absolute，offset 到右下，純色塊（非 blur）
 *    └ 主體 View — border + bgColor，按下時 translate-y/x = shadowOffset
 */
export function PixelBorder({
  borderWidth = 3,
  borderColor = '#1d2b53',
  shadowOffset = 4,
  bgColor,
  radius = 0,
  pressed = false,
  style,
  children,
  ...rest
}: Props) {
  const offset = pressed ? 0 : shadowOffset;
  return (
    <View
      style={[
        { paddingRight: shadowOffset, paddingBottom: shadowOffset },
        style,
      ]}
      {...rest}
    >
      {shadowOffset > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: shadowOffset,
            left: shadowOffset,
            right: 0,
            bottom: 0,
            backgroundColor: borderColor,
            borderRadius: radius,
          }}
        />
      )}
      <View
        style={{
          borderWidth,
          borderColor,
          backgroundColor: bgColor,
          borderRadius: radius,
          transform: [{ translateX: offset === 0 ? shadowOffset : 0 }, { translateY: offset === 0 ? shadowOffset : 0 }],
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default PixelBorder;
