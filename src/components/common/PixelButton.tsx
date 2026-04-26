import React, { useState } from 'react';
import { Pressable, Text, View, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { PixelBorder } from './PixelBorder';
import { useThemeStyle } from '@/hooks/useThemeStyle';
import * as haptic from '@/lib/haptic';

type Variant = 'primary' | 'accent' | 'danger' | 'ghost';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  /** 預設用「中文像素 + 英文像素」混合 family；false = 系統字 */
  pixelFont?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

/**
 * 像素風按鈕：chunky border + hard shadow，按下 translate 呈現「咚」下沉感。
 * modern 模式下退化成既有圓角樣式。
 */
export function PixelButton({
  label,
  variant = 'primary',
  pixelFont = true,
  fullWidth = false,
  size = 'md',
  onPressIn,
  onPressOut,
  style,
  ...rest
}: Props) {
  const { isPixel, palette } = useThemeStyle();
  const [pressed, setPressed] = useState(false);

  const handlePressIn = (e: any) => {
    setPressed(true);
    haptic.tapLight();
    onPressIn?.(e);
  };
  const handlePressOut = (e: any) => {
    setPressed(false);
    onPressOut?.(e);
  };

  const padY = size === 'sm' ? 6 : size === 'lg' ? 14 : 10;
  const padX = size === 'sm' ? 12 : size === 'lg' ? 24 : 16;

  if (!isPixel) {
    const bgClass =
      variant === 'primary' ? 'bg-kibo-primary'
      : variant === 'accent' ? 'bg-kibo-accent'
      : variant === 'danger' ? 'bg-kibo-danger'
      : 'bg-kibo-card';
    const textClass = variant === 'ghost' ? 'text-kibo-text' : 'text-kibo-bg';
    return (
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={`${bgClass} ${fullWidth ? 'w-full' : ''} items-center justify-center rounded-xl`}
        style={[{ paddingVertical: padY, paddingHorizontal: padX }, style]}
        {...rest}
      >
        <Text className={`${textClass} font-semibold`}>{label}</Text>
      </Pressable>
    );
  }

  const bgColor =
    variant === 'primary' ? palette.primary
    : variant === 'accent' ? palette.accent
    : variant === 'danger' ? palette.danger
    : palette.card;
  const textColor = variant === 'ghost' ? palette.text : palette.bg;
  const fontFamily = pixelFont ? 'Cubic11' : undefined;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[fullWidth ? { width: '100%' } : null, style]}
      {...rest}
    >
      <PixelBorder
        borderColor={palette.text}
        bgColor={bgColor}
        borderWidth={3}
        shadowOffset={4}
        radius={0}
        pressed={pressed}
      >
        <View
          style={{
            paddingVertical: padY,
            paddingHorizontal: padX,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: textColor,
              fontFamily,
              fontSize: size === 'sm' ? 12 : size === 'lg' ? 18 : 14,
              fontWeight: pixelFont ? '400' : '600',
              letterSpacing: pixelFont ? 0 : 0.3,
            }}
          >
            {label}
          </Text>
        </View>
      </PixelBorder>
    </Pressable>
  );
}

export default PixelButton;
