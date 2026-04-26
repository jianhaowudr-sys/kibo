import { View, Text, Pressable } from 'react-native';
import { useMemo, useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  getDay, startOfDay, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks, subDays,
} from 'date-fns';
import * as haptic from '@/lib/haptic';
import { useThemePalette } from '@/lib/useThemePalette';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export type CalendarViewMode = 'month' | 'week' | 'last7days';

type Props = {
  month: Date;
  onChangeMonth: (d: Date) => void;
  workoutDates: Set<string>;
  selectedDate: Date;
  onSelect: (d: Date) => void;
  viewMode?: CalendarViewMode;
  onChangeViewMode?: (m: CalendarViewMode) => void;
};

export function MonthCalendar(props: Props) {
  const { month, onChangeMonth, workoutDates, selectedDate, onSelect } = props;
  const palette = useThemePalette();
  const today = startOfDay(new Date());
  const [internalView, setInternalView] = useState<CalendarViewMode>('month');
  const viewMode = props.viewMode ?? internalView;
  const setView = props.onChangeViewMode ?? setInternalView;

  // === 共用：每格渲染 ===
  const renderDayCell = (d: Date, idx: number, totalCols: number) => {
    const key = format(d, 'yyyy-MM-dd');
    const hasWorkout = workoutDates.has(key);
    const isToday = isSameDay(d, today);
    const isSelected = isSameDay(d, selectedDate);
    return (
      <Pressable
        key={key}
        onPress={() => { haptic.tapLight(); onSelect(d); }}
        style={{ width: `${100 / totalCols}%` }}
        className="aspect-square p-1"
      >
        <View
          className={`flex-1 items-center justify-center rounded-lg ${
            isSelected
              ? 'bg-kibo-primary'
              : hasWorkout
                ? 'bg-kibo-success/20 border border-kibo-success'
                : isToday
                  ? 'border border-kibo-mute'
                  : ''
          }`}
        >
          <Text className={`text-sm ${
            isSelected ? 'text-kibo-bg font-bold'
              : hasWorkout ? 'text-kibo-success font-semibold'
              : isToday ? 'text-kibo-text font-semibold'
              : 'text-kibo-mute'
          }`}>
            {viewMode === 'month' ? format(d, 'd') : format(d, 'M/d')}
          </Text>
          {hasWorkout && !isSelected && (
            <View className="w-1 h-1 rounded-full bg-kibo-success mt-0.5" />
          )}
        </View>
      </Pressable>
    );
  };

  // === Header：模式切換 ===
  const ViewSwitcher = () => (
    <View className="flex-row gap-1 mb-2 bg-kibo-card rounded-lg p-1">
      {([
        { id: 'month' as const, label: '月' },
        { id: 'week' as const, label: '週' },
        { id: 'last7days' as const, label: '近 7 天' },
      ]).map((v) => {
        const active = viewMode === v.id;
        return (
          <Pressable
            key={v.id}
            onPress={() => { haptic.tapLight(); setView(v.id); }}
            className={`flex-1 py-1.5 rounded-md ${active ? 'bg-kibo-primary' : ''}`}
          >
            <Text className={`text-center text-xs font-semibold ${active ? 'text-kibo-bg' : 'text-kibo-text'}`}>
              {v.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // === Month 模式 ===
  const renderMonth = () => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const pad = getDay(first);
    const list = eachDayOfInterval({ start: first, end: last });
    return (
      <>
        <View className="flex-row items-center justify-between mb-3 px-2">
          <Pressable onPress={() => { haptic.tapLight(); onChangeMonth(subMonths(month, 1)); }} className="p-2">
            <Text className="text-kibo-primary text-lg">‹</Text>
          </Pressable>
          <Text className="text-kibo-text font-bold">{format(month, 'yyyy 年 M 月')}</Text>
          <Pressable onPress={() => { haptic.tapLight(); onChangeMonth(addMonths(month, 1)); }} className="p-2">
            <Text className="text-kibo-primary text-lg">›</Text>
          </Pressable>
        </View>
        <View className="flex-row mb-1">
          {WEEK_LABELS.map((w) => (
            <View key={w} className="flex-1 items-center">
              <Text className="text-[10px] text-kibo-mute">{w}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {Array.from({ length: pad }).map((_, i) => (
            <View key={`pad-${i}`} style={{ width: `${100 / 7}%` }} className="aspect-square p-1" />
          ))}
          {list.map((d, i) => renderDayCell(d, i, 7))}
        </View>
      </>
    );
  };

  // === Week 模式 ===
  const renderWeek = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
    const list = eachDayOfInterval({ start, end });
    return (
      <>
        <View className="flex-row items-center justify-between mb-3 px-2">
          <Pressable onPress={() => { haptic.tapLight(); onSelect(subWeeks(selectedDate, 1)); }} className="p-2">
            <Text className="text-kibo-primary text-lg">‹</Text>
          </Pressable>
          <Text className="text-kibo-text font-bold">{format(start, 'M/d')} – {format(end, 'M/d')}</Text>
          <Pressable onPress={() => { haptic.tapLight(); onSelect(addWeeks(selectedDate, 1)); }} className="p-2">
            <Text className="text-kibo-primary text-lg">›</Text>
          </Pressable>
        </View>
        <View className="flex-row mb-1">
          {WEEK_LABELS.map((w) => (
            <View key={w} className="flex-1 items-center">
              <Text className="text-[10px] text-kibo-mute">{w}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row">
          {list.map((d, i) => renderDayCell(d, i, 7))}
        </View>
      </>
    );
  };

  // === Last 7 days 模式 ===
  const renderLast7 = () => {
    const list = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
    return (
      <>
        <Text className="text-kibo-text font-bold mb-3 text-center">過去 7 天</Text>
        <View className="flex-row">
          {list.map((d, i) => renderDayCell(d, i, 7))}
        </View>
      </>
    );
  };

  return (
    <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card">
      <ViewSwitcher />
      {viewMode === 'month' && renderMonth()}
      {viewMode === 'week' && renderWeek()}
      {viewMode === 'last7days' && renderLast7()}
    </View>
  );
}
