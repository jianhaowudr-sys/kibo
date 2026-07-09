import { buildIntervalTriggers, parseHhmm } from '../src/lib/reminders_core';

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

console.log(`ALL PASS (${pass} checks)`);
