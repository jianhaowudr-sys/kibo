import { format, isSameDay, startOfDay, differenceInDays, subDays } from 'date-fns';

export const todayKey = () => format(new Date(), 'yyyy-MM-dd');

export const dateKey = (d: Date | number) => format(typeof d === 'number' ? new Date(d) : d, 'yyyy-MM-dd');

export const displayDate = (d: Date | number) => format(typeof d === 'number' ? new Date(d) : d, 'MM/dd');

export const displayDateTime = (d: Date | number) => format(typeof d === 'number' ? new Date(d) : d, 'MM/dd HH:mm');

export const displayTime = (d: Date | number) => format(typeof d === 'number' ? new Date(d) : d, 'HH:mm');

export const formatDuration = (sec: number): string => {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

export const last7Days = (): string[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => dateKey(subDays(today, 6 - i)));
};

export const isToday = (d: Date | number) => isSameDay(new Date(), new Date(d));

export const daysBetween = (a: Date | number, b: Date | number) =>
  differenceInDays(new Date(a), new Date(b));
