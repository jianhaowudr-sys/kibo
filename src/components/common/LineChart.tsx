/**
 * 輕量折線圖（react-native-svg），不裝大套件。
 *
 * 輸入 { date, value }[]，自動 fit 到 height/width。
 * 提供平均線、目標線、空值處理。
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

export type LinePoint = {
  /** yyyy-mm-dd 或 任意 label */
  label: string;
  value: number | null;  // null = 沒紀錄，繪製時跳過
};

type Props = {
  data: LinePoint[];
  height?: number;
  width?: number;
  color?: string;
  fillOpacity?: number;
  /** 顯示平均線 */
  showAvg?: boolean;
  /** 目標線（如水量目標 2000ml） */
  goal?: number | null;
  /** 顯示資料點（適合資料密度低） */
  showDots?: boolean;
  /** Y 軸格式化（如 ml → "2.0L"） */
  formatValue?: (v: number) => string;
  /** 預留下方標籤空間（顯示日期） */
  showXLabels?: boolean;
};

export function LineChart({
  data,
  height = 120,
  width,
  color = '#22D3EE',
  fillOpacity = 0.15,
  showAvg = true,
  goal = null,
  showDots = false,
  formatValue,
  showXLabels = true,
}: Props) {
  const padTop = 12;
  const padBottom = showXLabels ? 20 : 8;
  const padX = 6;

  const dims = useMemo(() => {
    const valid = data.map((d) => d.value).filter((v): v is number => v != null);
    if (valid.length === 0) {
      return { vMin: 0, vMax: 1, vAvg: 0 };
    }
    const vMin = Math.min(...valid, goal ?? Infinity);
    const vMax = Math.max(...valid, goal ?? -Infinity);
    const vAvg = valid.reduce((s, v) => s + v, 0) / valid.length;
    return {
      vMin: Math.min(vMin, vAvg) * 0.95,
      vMax: vMax * 1.05 + (vMax === vMin ? 1 : 0),
      vAvg,
    };
  }, [data, goal]);

  return (
    <View style={{ height, width: width ?? '100%' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width ?? 300} ${height}`} preserveAspectRatio="none">
        <ChartContent
          data={data}
          width={width ?? 300}
          height={height}
          padTop={padTop}
          padBottom={padBottom}
          padX={padX}
          vMin={dims.vMin}
          vMax={dims.vMax}
          vAvg={dims.vAvg}
          color={color}
          fillOpacity={fillOpacity}
          showAvg={showAvg}
          goal={goal}
          showDots={showDots}
          formatValue={formatValue}
          showXLabels={showXLabels}
        />
      </Svg>
    </View>
  );
}

function ChartContent({
  data, width, height, padTop, padBottom, padX,
  vMin, vMax, vAvg, color, fillOpacity, showAvg, goal, showDots, formatValue, showXLabels,
}: {
  data: LinePoint[];
  width: number; height: number;
  padTop: number; padBottom: number; padX: number;
  vMin: number; vMax: number; vAvg: number;
  color: string; fillOpacity: number;
  showAvg: boolean; goal: number | null;
  showDots: boolean;
  formatValue?: (v: number) => string;
  showXLabels: boolean;
}) {
  const innerH = height - padTop - padBottom;
  const innerW = width - padX * 2;
  const range = Math.max(0.0001, vMax - vMin);

  if (data.length === 0) {
    return (
      <SvgText x={width / 2} y={height / 2} fill="#888" fontSize={12} textAnchor="middle">
        — 沒有資料 —
      </SvgText>
    );
  }

  const xFor = (i: number) => padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yFor = (v: number) => padTop + innerH - ((v - vMin) / range) * innerH;

  // 用斷點處理 null：折線在 null 處斷開，恢復後重啟新 segment
  const segments: { points: { x: number; y: number; v: number; idx: number }[] }[] = [];
  let curr: { x: number; y: number; v: number; idx: number }[] = [];
  data.forEach((d, i) => {
    if (d.value == null) {
      if (curr.length > 0) {
        segments.push({ points: curr });
        curr = [];
      }
    } else {
      curr.push({ x: xFor(i), y: yFor(d.value), v: d.value, idx: i });
    }
  });
  if (curr.length > 0) segments.push({ points: curr });

  const goalY = goal != null ? yFor(goal) : null;
  const avgY = yFor(vAvg);

  const fillPath = segments
    .map((seg) => {
      if (seg.points.length === 0) return '';
      const first = seg.points[0];
      const last = seg.points[seg.points.length - 1];
      const top = seg.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      return `${top} L${last.x},${padTop + innerH} L${first.x},${padTop + innerH} Z`;
    })
    .join(' ');

  return (
    <>
      {/* 填色 */}
      {fillOpacity > 0 && <Path d={fillPath} fill={color} opacity={fillOpacity} />}

      {/* 折線 */}
      {segments.map((seg, si) => (
        <Path
          key={`seg-${si}`}
          d={seg.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* 資料點 */}
      {showDots && segments.flatMap((seg) => seg.points).map((p, i) => (
        <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={2.5} fill={color} />
      ))}

      {/* 平均線 */}
      {showAvg && data.some((d) => d.value != null) && (
        <Line
          x1={padX}
          y1={avgY}
          x2={width - padX}
          y2={avgY}
          stroke="#888"
          strokeWidth={1}
          strokeDasharray="3,3"
          opacity={0.6}
        />
      )}

      {/* 目標線 */}
      {goalY != null && (
        <Line
          x1={padX}
          y1={goalY}
          x2={width - padX}
          y2={goalY}
          stroke="#FFB347"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      )}

      {/* X 軸標籤（首/中/尾） */}
      {showXLabels && data.length > 0 && (
        <>
          <SvgText x={padX} y={height - 4} fill="#888" fontSize={9} textAnchor="start">
            {data[0].label}
          </SvgText>
          {data.length > 2 && (
            <SvgText x={width / 2} y={height - 4} fill="#888" fontSize={9} textAnchor="middle">
              {data[Math.floor(data.length / 2)].label}
            </SvgText>
          )}
          {data.length > 1 && (
            <SvgText x={width - padX} y={height - 4} fill="#888" fontSize={9} textAnchor="end">
              {data[data.length - 1].label}
            </SvgText>
          )}
        </>
      )}
    </>
  );
}

export default LineChart;
