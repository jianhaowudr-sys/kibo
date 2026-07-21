import { parseLayout, stringifyLayout, DEFAULT_DASHBOARD_LAYOUT } from '../src/lib/dashboard';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

const find = (l: { cards: any[] }, id: string) => l.cards.find((c) => c.id === id);

// (a) 舊 JSON 含 today-meals visible → nutrition-summary 承接 visible，且結果無 today-meals
{
  const raw = JSON.stringify({
    cards: [
      { id: 'today-meals', visible: true, order: 10, size: 'full' },
      { id: 'nutrition-summary', visible: false, order: 12, size: 'compact' },
    ],
  });
  const l = parseLayout(raw);
  ok(l.cards.every((c) => (c.id as string) !== 'today-meals'), '(a) 結果不含 today-meals');
  ok(find(l, 'nutrition-summary')?.visible === true, '(a) nutrition-summary 被開啟');
}

// (b) null → DEFAULT
{
  const l = parseLayout(null);
  ok(JSON.stringify(l) === JSON.stringify(DEFAULT_DASHBOARD_LAYOUT), '(b) null → DEFAULT');
  ok(l.cards.every((c) => (c.id as string) !== 'today-meals'), '(b) DEFAULT 無 today-meals');
}

// (c) 使用者兩張都關 → 不強開 nutrition-summary
{
  const raw = JSON.stringify({
    cards: [
      { id: 'today-meals', visible: false, order: 10, size: 'full' },
      { id: 'nutrition-summary', visible: false, order: 12, size: 'compact' },
    ],
  });
  const l = parseLayout(raw);
  ok(find(l, 'nutrition-summary')?.visible === false, '(c) 兩張都關 → 不強開');
}

// (d) today-meals 開但 nutrition-summary 已開 → 保持、不重複
{
  const raw = JSON.stringify({
    cards: [
      { id: 'today-meals', visible: true, order: 10, size: 'full' },
      { id: 'nutrition-summary', visible: true, order: 5, size: 'full' },
    ],
  });
  const l = parseLayout(raw);
  ok(l.cards.filter((c) => c.id === 'nutrition-summary').length === 1, '(d) nutrition-summary 不重複');
  ok(find(l, 'nutrition-summary')?.visible === true, '(d) 保持 visible');
  ok(find(l, 'nutrition-summary')?.order === 5, '(d) 保留原 order 5');
}

// (e) round-trip 穩定
{
  const once = parseLayout(null);
  const twice = parseLayout(stringifyLayout(once));
  ok(JSON.stringify(once) === JSON.stringify(twice), '(e) round-trip 穩定');
}

console.log(`ALL PASS (${pass} checks)`);
