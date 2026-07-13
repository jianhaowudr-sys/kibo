import { sqliteDb } from '@/db/client';
import { ALL_TABLES, ALL_TABLES_REVERSE } from '@/db/tables';
import { BACKUP_SCHEMA_VERSION, validateBackupFile, tablesToImport, planTableInsert } from './backup_core';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export type BackupData = {
  schemaVersion: number;
  exportedAt: string;
  appVersion?: string;
  tables: Record<string, any[]>;
};

export type ImportResult = {
  imported: boolean;
  tables: number;
  rows: number;
  skippedTables: string[];   // 檔案有但本地不認識的表
  skippedColumns: string[];  // 被丟棄的廢欄（"table.col" 形式）
};

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;

/** 讀 DB 內某表的實際欄位名（PRAGMA table_info）。 */
async function liveColumns(table: string): Promise<string[]> {
  const rows = await sqliteDb.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`);
  return rows.map((r) => r.name);
}

/**
 * 全表序列化。讀失敗 **throw**（不再靜默塞空陣列）——ensureSchema 保證 22 張都在，
 * 讀不到就是真的壞了，寧可匯出失敗也不能給使用者空殼備份。
 */
export async function serializeAll(): Promise<BackupData> {
  const tables: Record<string, any[]> = {};
  for (const t of ALL_TABLES) {
    tables[t] = await sqliteDb.getAllAsync<any>(`SELECT * FROM "${t}"`);
  }
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version,
    tables,
  };
}

export async function exportAll(): Promise<void> {
  const data = await serializeAll();
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `kibo_backup_${timestamp}.json`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

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

/** 匯入前先把當前資料整包快照存起來（safety net），只保留最近 2 份。 */
async function writePreImportSnapshot(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    const snap = await serializeAll();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await FileSystem.writeAsStringAsync(`${BACKUP_DIR}pre_import_${ts}.json`, JSON.stringify(snap), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    // 只留最近 2 份
    const files = (await FileSystem.readDirectoryAsync(BACKUP_DIR))
      .filter((f) => f.startsWith('pre_import_'))
      .sort();
    for (const old of files.slice(0, Math.max(0, files.length - 2))) {
      await FileSystem.deleteAsync(`${BACKUP_DIR}${old}`, { idempotent: true });
    }
  } catch {
    // 快照失敗不擋匯入（交易本身已保證原子性）；但盡量留。
  }
}

export async function importAll(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.[0]) {
    return { imported: false, tables: 0, rows: 0, skippedTables: [], skippedColumns: [] };
  }

  const content = await FileSystem.readAsStringAsync(picked.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
  const data = JSON.parse(content) as BackupData;

  // (1) 驗證在任何刪除發生前
  const v = validateBackupFile(data);
  if (!v.ok) throw new Error(v.reason ?? '備份檔無效');

  // (2) safety-net：先快照當前資料
  await writePreImportSnapshot();

  // (3) 決定要 replace 的表 + 各表欄位規劃（交易外先算好）
  const { tables, skippedTables } = tablesToImport(Object.keys(data.tables), ALL_TABLES);
  const plans = new Map<string, ReturnType<typeof planTableInsert>>();
  const restorable: string[] = [];  // 實際會清空+還原的表
  for (const t of tables) {
    const rows = data.tables[t] ?? [];
    const fileCols = rows.length > 0 ? Object.keys(rows[0]) : [];
    const plan = planTableInsert(fileCols, await liveColumns(t));
    plans.set(t, plan);
    // 有資料但沒有任何可對映欄位（schema 完全不符）→ 不能還原也不該清空（避免靜默 wipe）
    if (rows.length > 0 && plan.columns.length === 0) {
      skippedTables.push(t);
    } else {
      restorable.push(t);  // 含「檔案為空 → 還原成空」的正常語意
    }
  }

  // (4) 整包 DELETE + INSERT 包在交易，任何失敗 throw → ROLLBACK，本地資料完好如初
  let totalRows = 0;
  let totalTables = 0;
  const skippedColumns: string[] = [];

  await sqliteDb.withExclusiveTransactionAsync(async (txn) => {
    // 反序 DELETE（子先父後）——只清可還原的表
    const toDelete = ALL_TABLES_REVERSE.filter((t) => restorable.includes(t));
    for (const t of toDelete) await txn.runAsync(`DELETE FROM "${t}"`);

    // 正序 INSERT
    for (const t of restorable) {
      const rows = data.tables[t] ?? [];
      if (rows.length === 0) continue;
      const plan = plans.get(t)!;
      for (const c of plan.skippedColumns) skippedColumns.push(`${t}.${c}`);
      if (plan.columns.length === 0) continue;
      const sql = plan.sql(t);
      totalTables += 1;
      for (const r of rows) {
        const values = plan.columns.map((c) => (r as any)[c]);
        await txn.runAsync(sql, values); // 失敗即 throw → 整包 rollback
        totalRows += 1;
      }
    }
  });

  return { imported: true, tables: totalTables, rows: totalRows, skippedTables, skippedColumns };
}
