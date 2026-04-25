import { sqliteDb } from '@/db/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

const TABLES = [
  'users',
  'exercises',
  'workouts',
  'workout_sets',
  'eggs',
  'pets',
  'achievements',
  'routines',
  'routine_exercises',
  'body_measurements',
  'meals',
];

export type BackupData = {
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, any[]>;
};

export async function exportAll(): Promise<void> {
  const tables: Record<string, any[]> = {};
  for (const t of TABLES) {
    try {
      const rows = await sqliteDb.getAllAsync<any>(`SELECT * FROM ${t}`);
      tables[t] = rows;
    } catch {
      tables[t] = [];
    }
  }

  const data: BackupData = {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    tables,
  };

  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `kibo_backup_${timestamp}.json`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: '匯出 Kibo 資料',
      UTI: 'public.json',
    });
  } else {
    throw new Error('此裝置不支援分享');
  }
}

export async function importAll(): Promise<{ imported: boolean; tables: number; rows: number }> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) {
    return { imported: false, tables: 0, rows: 0 };
  }

  const content = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const data = JSON.parse(content) as BackupData;

  if (!data.tables || typeof data.tables !== 'object') {
    throw new Error('備份檔格式錯誤');
  }

  for (const t of TABLES.slice().reverse()) {
    try {
      await sqliteDb.runAsync(`DELETE FROM ${t}`);
    } catch {}
  }

  let totalRows = 0;
  let totalTables = 0;

  for (const t of TABLES) {
    const rows = data.tables[t] ?? [];
    if (rows.length === 0) continue;
    totalTables += 1;

    const sample = rows[0];
    const columns = Object.keys(sample);
    const placeholders = columns.map(() => '?').join(', ');
    const colList = columns.join(', ');
    const sql = `INSERT INTO ${t} (${colList}) VALUES (${placeholders})`;

    for (const r of rows) {
      const values = columns.map((c) => (r as any)[c]);
      try {
        await sqliteDb.runAsync(sql, values);
        totalRows += 1;
      } catch {}
    }
  }

  return { imported: true, tables: totalTables, rows: totalRows };
}
