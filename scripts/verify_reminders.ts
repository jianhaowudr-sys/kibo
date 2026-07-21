import { buildIntervalTriggers, parseHhmm, dailyReminderTimes, formatHhmm } from '../src/lib/reminders_core';

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  pass++;
}

// ---- buildIntervalTriggers ----
// now = 2026-01-15 08:00 本地；win 9–12、每 60 分 → 每天 9/10/11 共 3 slot、7 天全未來 = 21
{
  const now = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
  const t = buildIntervalTriggers(60, { startHour: 9, endHour: 12 }, now);
  ok(t.length === 21, `full-window count = ${t.length}, want 21`);
  ok(t.every((ms) => ms > now), 'all triggers in the future');
  ok(t.every((ms) => new Date(ms).getMinutes() === 0), 'all on the hour');
  ok(t.every((ms) => { const h = new Date(ms).getHours(); return h >= 9 && h < 12; }), 'all hours within [9,12)');
  ok(t.every((ms, i) => i === 0 || ms > t[i - 1]), 'strictly increasing');
}
// now = 10:30 → 當天 9/10 已過，只剩 11；後 6 天各 3 → 1 + 18 = 19
{
  const now = new Date(2026, 0, 15, 10, 30, 0, 0).getTime();
  const t = buildIntervalTriggers(60, { startHour: 9, endHour: 12 }, now);
  ok(t.length === 19, `only-future count = ${t.length}, want 19`);
  ok(new Date(t[0]).getHours() === 11, 'first remaining slot is 11:00');
}
// 無效 intervalMin → []
{
  const now = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
  ok(buildIntervalTriggers(0, { startHour: 9, endHour: 12 }, now).length === 0, 'interval 0 → []');
  ok(buildIntervalTriggers(-5, { startHour: 9, endHour: 12 }, now).length === 0, 'interval -5 → []');
  ok(buildIntervalTriggers(NaN, { startHour: 9, endHour: 12 }, now).length === 0, 'interval NaN → []');
}
// 30 分間隔：win 9–10 → 每天 9:00/9:30 共 2 slot
{
  const now = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
  const t = buildIntervalTriggers(30, { startHour: 9, endHour: 10 }, now);
  ok(t.length === 14, `30-min count = ${t.length}, want 14`);
  ok(t.slice(0, 2).map((ms) => new Date(ms).getMinutes()).join(',') === '0,30', 'first day slots at :00 and :30');
}

// ---- parseHhmm ----
ok(JSON.stringify(parseHhmm('22:00')) === JSON.stringify({ hour: 22, minute: 0 }), '22:00');
ok(JSON.stringify(parseHhmm('9:05')) === JSON.stringify({ hour: 9, minute: 5 }), '9:05');
ok(JSON.stringify(parseHhmm('9:5')) === JSON.stringify({ hour: 9, minute: 5 }), '9:5 lenient minute');
ok(JSON.stringify(parseHhmm(' 7:30 ')) === JSON.stringify({ hour: 7, minute: 30 }), 'trim whitespace');
ok(parseHhmm('24:00') === null, '24:00 → null (hour out of range)');
ok(parseHhmm('12:60') === null, '12:60 → null (minute out of range)');
ok(parseHhmm('-1:00') === null, '-1:00 → null');
ok(parseHhmm('abc') === null, 'abc → null');
ok(parseHhmm('') === null, 'empty → null');
ok(parseHhmm('1200') === null, 'no colon → null');
ok(parseHhmm(null as any) === null, 'non-string → null');

// ---- dailyReminderTimes（喝水固定每日時間）----
// fixedTimes 優先：解析、去重、排序
{
  const t = dailyReminderTimes({ fixedTimes: ['20:00', '8:00', '8:00', '12:00'] });
  ok(t.length === 3, `去重後 3 個，實際 ${t.length}`);
  ok(t.map(formatHhmm).join(',') === '8:00,12:00,20:00', '排序 8/12/20');
}
// 上限 + 均勻取樣（保留頭尾覆蓋）
{
  const many = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const t = dailyReminderTimes({ fixedTimes: many }, { maxCount: 6 });
  ok(t.length <= 6, `上限 ≤6，實際 ${t.length}`);
  ok(t[0].hour === 0, '取樣保留最早 0:00');
  ok(t[t.length - 1].hour === 23, '取樣保留最晚 23:00');
}
// 舊 config 遷移：interval + window 推導
{
  const t = dailyReminderTimes({ intervalMin: 120, activeWindow: { startHour: 8, endHour: 22 } });
  ok(t.length === 7, `8..20 每 120 分 = 7 個，實際 ${t.length}`);
  ok(t[0].hour === 8 && t[0].minute === 0, '首個 8:00');
  ok(t.every((x, i) => i === 0 || (x.hour * 60 + x.minute) > (t[i - 1].hour * 60 + t[i - 1].minute)), '嚴格遞增');
}
// interval 30 分 12h → 24 個超上限 12 → 取樣 ≤12
{
  const t = dailyReminderTimes({ intervalMin: 30, activeWindow: { startHour: 8, endHour: 20 } });
  ok(t.length <= 12, `≤12，實際 ${t.length}`);
}
// 空/壞輸入 → []
ok(dailyReminderTimes({}).length === 0, '無 fixedTimes/interval → []');
ok(dailyReminderTimes({ fixedTimes: ['bad', '25:00'] }).length === 0, '全壞 fixedTimes → []');
ok(dailyReminderTimes({ intervalMin: 0, activeWindow: { startHour: 8, endHour: 20 } }).length === 0, 'interval 0 → []');

// ---- formatHhmm ----
ok(formatHhmm({ hour: 8, minute: 0 }) === '8:00', 'format 8:00');
ok(formatHhmm({ hour: 22, minute: 5 }) === '22:05', 'format 22:05 補零');

console.log(`ALL PASS (${pass} checks)`);
