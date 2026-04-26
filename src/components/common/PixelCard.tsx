import React from 'react';
import { View, ViewProps } from 'react-native';
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
  return (
    <PixelBorder
      borderColor={palette.text}
      bgColor={bgMap[variant]}
      borderWidth={3}
      shadowOffset={4}
      radius={0}
      style={style}
      {...rest}
    >
      <View style={{ padding }}>{children}</View>
    </PixelBorder>
  );
}

export default PixelCard;
