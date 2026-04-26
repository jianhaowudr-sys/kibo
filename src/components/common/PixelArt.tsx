import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { View } from 'react-native';

/**
 * 像素點陣繪圖元件（plan v2 §3.1）。
 *
 * data 是 2D 陣列，每個 cell 是色票 key（對應 colors map）。
 * 0 / null / '' 視為透明。
 *
 * 用法：
 *   <PixelArt
 *     data={[
 *       [0, 1, 1, 0],
 *       [1, 2, 2, 1],
 *       [1, 1, 1, 1],
 *       [0, 1, 1, 0],
 *     ]}
 *     colors={{ 1: '#fff', 2: '#000' }}
 *     scale={6}
 *   />
 */
type Props = {
  data: (number | string)[][];
  colors: Record<string | number, string>;
  /** 每個像素 = scale 個實際 dp，預設 4 */
  scale?: number;
  /** 容器外寬度（覆寫 scale 自動計算） */
  width?: number;
  /** 是否上下翻轉（用於 mood 變化） */
  flipY?: boolean;
};

export function PixelArt({ data, colors, scale = 4, width, flipY }: Props) {
  if (!data || data.length === 0) return null;
  const rows = data.length;
  const cols = data[0].length;
  const finalScale = width ? Math.floor(width / cols) : scale;
  const w = cols * finalScale;
  const h = rows * finalScale;

  const rects: React.ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = data[y][x];
      if (!c || c === 0) continue;
      const fill = colors[c];
      if (!fill) continue;
      const py = flipY ? rows - 1 - y : y;
      rects.push(
        <Rect
          key={`${x}-${y}`}
          x={x * finalScale}
          y={py * finalScale}
          width={finalScale}
          height={finalScale}
          fill={fill}
        />
      );
    }
  }

  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h}>
        {rects}
      </Svg>
    </View>
  );
}

export default PixelArt;
