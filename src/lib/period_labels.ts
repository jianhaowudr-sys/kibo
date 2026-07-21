import type { PeriodFlow } from '@/db/schema';

/** 經血量 enum → 中文（避免歷史列顯示英文 flow 值）。 */
export const PERIOD_FLOW_LABELS: Record<PeriodFlow, string> = {
  spot: '點滴',
  light: '少量',
  medium: '中量',
  heavy: '大量',
};

export function periodFlowLabel(flow: string): string {
  return (PERIOD_FLOW_LABELS as Record<string, string>)[flow] ?? flow;
}
