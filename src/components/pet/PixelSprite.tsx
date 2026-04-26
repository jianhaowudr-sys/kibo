import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PixelArt } from '@/components/common/PixelArt';
import { SPRITE_COLORS } from '@/lib/sprites/palette';

type Props = {
  /** 動畫 frame 陣列（每個 frame 為 2D pixel grid） */
  frames: any[][][];
  /** 切 frame 的間隔（毫秒），預設 400ms */
  frameMs?: number;
  /** 像素縮放（每個 pixel = scale dp） */
  scale?: number;
  /** 強制寬度（覆寫 scale） */
  width?: number;
  /** 暫停動畫，只顯示第 1 frame */
  paused?: boolean;
};

/**
 * 像素 sprite 動畫元件，frame-by-frame 切換。
 *
 * 之後若要替換成 itch.io 買的 PNG sprite sheet，只需新增另一個元件
 * 用 Animated.Image + crop window 切，並讓所有呼叫處透過同名 props 換掉即可。
 */
export function PixelSprite({ frames, frameMs = 400, scale = 4, width, paused }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (paused || frames.length <= 1) return;
    const t = setInterval(() => {
      setIdx((p) => (p + 1) % frames.length);
    }, frameMs);
    return () => clearInterval(t);
  }, [frames.length, frameMs, paused]);

  if (!frames[idx]) return null;
  return <PixelArt data={frames[idx]} colors={SPRITE_COLORS as any} scale={scale} width={width} />;
}

export default PixelSprite;
