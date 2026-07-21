import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { PixelBorder } from './PixelBorder';
import { useThemeStyle } from '@/hooks/useThemeStyle';

type Props = ViewProps & {
  variant?: 'default' | 'primary' | 'accent' | 'card';
  padding?: number;
  children?: React.ReactNode;
};

/**
 * 像素風卡片：chunky border + hard shadow + 方角。
 * 在 themeStyle === 'modern' 時退化成既有 rounded card 樣式（向下兼容）。
 */
export function PixelCard({
  variant = 'default',
  padding = 12,
  style,
  children,
  ...rest
}: Props) {
  const { isPixel, palette } = useThemeStyle();

  if (!isPixel) {
    // modern 模式：退化成現有圓角樣式
    return (
      <View
        className="bg-kibo-surface rounded-2xl border border-kibo-card"
        style={[{ padding }, style]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  const bgMap = {
    default: palette.surface,
    primary: palette.primary,
    accent: palette.accent,
    card: palette.card,
  };
  // style 必須拆兩半：外框(margin/alignSelf 等版面屬性)給 PixelBorder，
  // 內容對齊(alignItems/justifyContent/gap)給內層 padding View。
  // 全部丟給 PixelBorder 的話，alignItems 會作用在「陰影 + 邊框本體」的外層容器上 →
  // 邊框本體縮成內容寬，但絕對定位的陰影仍是滿版，視覺上錯位。
  const flat = StyleSheet.flatten(style) ?? {};
  const { alignItems, justifyContent, gap, rowGap, columnGap, ...outerStyle } = flat as any;
  const innerStyle = { alignItems, justifyContent, gap, rowGap, columnGap };
  return (
    <PixelBorder
      borderColor={palette.text}
      bgColor={bgMap[variant]}
      borderWidth={3}
      shadowOffset={4}
      radius={0}
      style={outerStyle}
      {...rest}
    >
      <View style={[{ padding }, innerStyle]}>{children}</View>
    </PixelBorder>
  );
}

export default PixelCard;
