import { sqliteDb } from '@/db/client';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

type CSVRow = {
  date: string;
  workoutName: string;
  exerciseName: string;
  setOrder: number;
  weight: number;
  reps: number;
  distance: number | null;
  seconds: number | null;
  notes: string;
  workoutNote: string;
  durationSec: number;
};

function detectSeparator(headerLine: string): ',' | ';' | '\t' {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;
  if (tab >= semi && tab >= comma) return '\t';
  if (semi >= comma) return ';';
  return ',';
}

function parseCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === sep && !inQuote) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseDuration(s: string): number {
  if (!s) return 0;
  const trimmed = s.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const h = /(\d+)h/.exec(trimmed)?.[1];
  const m = /(\d+)min/.exec(trimmed)?.[1];
  const sec = /(\d+)s(?!min)/.exec(trimmed)?.[1];
  return (Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(sec ?? 0);
}

function normalizeExerciseName(name: string): string {
  return name.replace(/\s*\(\s*/g, '（').replace(/\s*\)\s*/g, '）').trim();
}

function indexHeader(headerCols: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headerCols.forEach((h, i) => {
    const k = h.trim().toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim();
    idx[k] = i;
  });
  return idx;
}

function parseCSV(text: string): CSVRow[] {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = detectSeparator(lines[0]);
  const headerCols = parseCSVLine(lines[0], sep);
  const idx = indexHeader(headerCols);

  const iDate = idx['date'];
  const iWName = idx['workout name'];
  const iWDur = idx['duration'];
  const iExName = idx['exercise name'];
  const iOrder = idx['set order'];
  const iWeight = idx['weight'];
  const iReps = idx['reps'];
  const iDist = idx['distance'];
  const iSec = idx['seconds'];
  const iNotes = idx['notes'];
  const iWNote = idx['workout notes'];

  if (iDate == null || iExName == null) return [];

  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], sep);
    if (cols.length < headerCols.length - 1) continue;

    const date = cols[iDate]?.trim();
    const exName = cols[iExName]?.trim();
    if (!date || !exName) continue;

    // Skip Strong's "W" warmup rows and "Note"-only rows.
    const orderRaw = (iOrder != null ? cols[iOrder] ?? '' : '').trim();
    if (orderRaw.toLowerCase() === 'note') continue;
    if (/^[a-zA-Z]/.test(orderRaw) && orderRaw.toUpperCase() === 'W') continue;

    rows.push({
      date,
      workoutName: (iWName != null ? cols[iWName] : '').trim(),
      exerciseName: exName,
      setOrder: Number(orderRaw) || 1,
      weight: iWeight != null ? Number(cols[iWeight]) || 0 : 0,
      reps: iReps != null ? Number(cols[iReps]) || 0 : 0,
      distance: iDist != null && cols[iDist] ? Number(cols[iDist]) || null : null,
      seconds: iSec != null && cols[iSec] ? Number(cols[iSec]) || null : null,
      notes: iNotes != null ? cols[iNotes] || '' : '',
      workoutNote: iWNote != null ? cols[iWNote] || '' : '',
      durationSec: iWDur != null ? parseDuration(cols[iWDur] || '') : 0,
    });
  }
  return rows;
}

export type ImportResult = {
  workoutsCreated: number;
  setsCreated: number;
  newExercises: number;
  skippedRows: number;
  totalRows: number;
};

export async function importStrongCSV(
  onProgress?: (processed: number, total: number) => void,
): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const text = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // Diagnostics so the user can see why import shows 0
  const totalLines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  const headerLine = (text.split(/\r?\n/)[0] ?? '').slice(0, 200);
  const sepDetected =
    (headerLine.match(/\t/g) || []).length >= Math.max((headerLine.match(/;/g) || []).length, (headerLine.match(/,/g) || []).length)
      ? 'TAB'
      : (headerLine.match(/;/g) || []).length >= (headerLine.match(/,/g) || []).length
        ? ';'
        : ',';

  const rows = parseCSV(text);

  if (rows.length === 0) {
    throw new Error(
      `CSV 解析失敗\n\n` +
        `檔名：${picked.assets[0].name}\n` +
        `總行數：${totalLines}\n` +
        `偵測分隔符：${sepDetected}\n` +
        `Header：${headerLine}\n\n` +
        `若 Header 看起來不對，可能不是 Strong 標準匯出，把 Header 截圖給開發者。`,
    );
  }

  const groups = new Map<string, CSVRow[]>();
  for (const r of rows) {
    const k = `${r.date}|${r.workoutName}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const user = await sqliteDb.getFirstAsync<{ id: number }>('SELECT id FROM users ORDER BY id ASC LIMIT 1');
  if (!user) throw new Error('找不到使用者');

  const existing = await sqliteDb.getAllAsync<{ id: number; name: string; unit: string; category: string; exp_per_unit: number }>(
    'SELECT id, name, unit, category, exp_per_unit FROM exercises',
  );
  const byName = new Map<string, typeof existing[number]>(
    existing.map((e) => [normalizeExerciseName(e.name), e]),
  );

  let newExercises = 0;
  let workoutsCreated = 0;
  let setsCreated = 0;
  let skipped = 0;
  let processed = 0;
  const total = rows.length;

  const groupKeys = Array.from(groups.keys()).sort();

  for (const key of groupKeys) {
    const groupRows = groups.get(key)!;
    if (groupRows.length === 0) continue;
    const first = groupRows[0];

    // Strong export may include time: "2023-04-25 19:12:03". Take YYYY-MM-DD prefix.
    const dateOnly = first.date.slice(0, 10);
    const timePart = first.date.length > 10 ? first.date.slice(11) : '';
    const dateParts = dateOnly.split('-');
    if (dateParts.length !== 3 || !/^\d{4}$/.test(dateParts[0])) {
      skipped += groupRows.length;
      processed += groupRows.length;
      continue;
    }
    const [hh, mm, ss] = (timePart || '12:00:00').split(':').map((v) => Number(v) || 0);
    const startedAt = new Date(
      Number(dateParts[0]),
      Number(dateParts[1]) - 1,
      Number(dateParts[2]),
      hh,
      mm,
      ss,
    ).getTime();
    const endedAt = startedAt + first.durationSec * 1000;

    const existingWorkout = await sqliteDb.getFirstAsync<{ id: number }>(
      `SELECT id FROM workouts WHERE user_id = ? AND started_at = ? LIMIT 1`,
      [user.id, startedAt],
    );
    if (existingWorkout) {
      skipped += groupRows.length;
      processed += groupRows.length;
      continue;
    }

    const result = await sqliteDb.runAsync(
      `INSERT INTO workouts (user_id, started_at, ended_at, note, total_exp, total_volume, duration_sec)
       VALUES (?, ?, ?, ?, 0, 0, ?)`,
      [
        user.id,
        startedAt,
        endedAt,
        first.workoutNote || first.workoutName || null,
        first.durationSec,
      ],
    );
    const workoutId = result.lastInsertRowId as number;
    workoutsCreated += 1;

    let totalExp = 0;
    let totalVolume = 0;

    for (let i = 0; i < groupRows.length; i++) {
      const row = groupRows[i];
      const normalized = normalizeExerciseName(row.exerciseName);
      let ex = byName.get(normalized);

      if (!ex) {
        const hasReps = row.reps > 0;
        const hasDist = row.distance != null && row.distance > 0;
        const hasSec = row.seconds != null && row.seconds > 0;
        const category = hasDist || hasSec ? 'cardio' : 'strength';
        const unit = hasReps ? 'reps' : hasSec ? 'seconds' : hasDist ? 'meters' : 'reps';
        const firstChar = row.exerciseName.trim().charAt(0) || '?';

        const exResult = await sqliteDb.runAsync(
          `INSERT INTO exercises (name, category, muscle_group, part, equipment, unit, icon, exp_per_unit, is_custom, seed_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 2)`,
          [row.exerciseName, category, '匯入', '其他', null, unit, firstChar, 1.0],
        );
        const newId = exResult.lastInsertRowId as number;
        ex = { id: newId, name: row.exerciseName, unit, category, exp_per_unit: 1 };
        byName.set(normalized, ex);
        newExercises += 1;
      }

      let exp = 0;
      const volume = row.weight * row.reps;
      if (ex.unit === 'reps') {
        const intensity = row.weight > 0 ? 1 + row.weight / 80 : 1;
        exp = Math.round(row.reps * ex.exp_per_unit * intensity);
      } else if (ex.unit === 'seconds') {
        exp = Math.round((row.seconds ?? 0) * ex.exp_per_unit);
      } else if (ex.unit === 'meters') {
        exp = Math.round(((row.distance ?? 0) / 100) * ex.exp_per_unit);
      }

      await sqliteDb.runAsync(
        `INSERT INTO workout_sets (workout_id, exercise_id, order_idx, weight, reps, duration_sec, distance_m, completed, exp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          workoutId,
          ex.id,
          i,
          row.weight > 0 ? row.weight : null,
          row.reps > 0 ? row.reps : null,
          row.seconds,
          row.distance != null && row.distance > 0 ? row.distance * 1000 : null,
          exp,
          startedAt + i * 1000,
        ],
      );
      setsCreated += 1;
      totalExp += exp;
      totalVolume += volume;

      processed += 1;
      if (onProgress && processed % 50 === 0) onProgress(processed, total);
    }

    await sqliteDb.runAsync(
      'UPDATE workouts SET total_exp = ?, total_volume = ? WHERE id = ?',
      [totalExp, totalVolume, workoutId],
    );
  }

  const userTotals = await sqliteDb.getFirstAsync<{ c: number; e: number }>(
    `SELECT COUNT(*) as c, COALESCE(SUM(total_exp), 0) as e
     FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL`,
    [user.id],
  );
  const lastDateRow = await sqliteDb.getFirstAsync<{ d: string }>(
    `SELECT date(started_at / 1000, 'unixepoch', 'localtime') as d
     FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL
     ORDER BY started_at DESC LIMIT 1`,
    [user.id],
  );
  await sqliteDb.runAsync(
    'UPDATE users SET total_workouts = ?, total_exp = ?, last_workout_date = ? WHERE id = ?',
    [userTotals?.c ?? 0, userTotals?.e ?? 0, lastDateRow?.d ?? null, user.id],
  );

  return {
    workoutsCreated,
    setsCreated,
    newExercises,
    skippedRows: skipped,
    totalRows: total,
  };
}
