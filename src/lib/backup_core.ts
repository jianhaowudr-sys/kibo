// 備份格式純函數（零 import，node 可直測）。見 scripts/verify_backup_core.ts。

export const BACKUP_SCHEMA_VERSION = 4;

export type BackupValidation = { ok: boolean; reason?: string };

/**
 * 匯入前先驗證，**任何刪除發生前**就擋掉壞檔。
 * - 非物件 / 缺 tables → 拒
 * - schemaVersion 缺失或 < 1 → 拒
 * - schemaVersion > 目前版本 → 拒（備份來自較新版本）
 * - 1..目前版本 → 收
 */
export function validateBackupFile(data: any): BackupValidation {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: '備份檔格式錯誤' };
  }
  if (!data.tables || typeof data.tables !== 'object' || Array.isArray(data.tables)) {
    return { ok: false, reason: '備份檔缺少資料表內容' };
  }
  const v = data.schemaVersion;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) {
    return { ok: false, reason: '備份檔版本無效或過舊，無法匯入' };
  }
  if (v > BACKUP_SCHEMA_VERSION) {
    return { ok: false, reason: '備份來自較新版本的 App，請先更新 App 再匯入' };
  }
  return { ok: true };
}

/**
 * 決定實際要匯入哪些表：file ∩ known，以 known（FK 安全）的順序回傳。
 * v3 舊檔只含 11 張 → 只 replace 那 11 張，其餘不動（天然向下相容）。
 * 檔案有但本地不認識的表 → skippedTables（記 warning）。
 */
export function tablesToImport(
  fileTableNames: string[],
  knownTables: readonly string[],
): { tables: string[]; skippedTables: string[] } {
  const known = new Set(knownTables);
  const fileSet = new Set(fileTableNames);
  const skippedTables = fileTableNames.filter((t) => !known.has(t));
  const tables = knownTables.filter((t) => fileSet.has(t));
  return { tables, skippedTables };
}

export type InsertPlan = {
  columns: string[];        // 實際要插入的欄（檔案 ∩ DB）
  skippedColumns: string[]; // 檔案有但 DB 已無（廢欄，丟棄）
  sql: (table: string) => string;
};

/**
 * 規劃單表 INSERT 欄位：檔案欄 ∩ live 欄。
 * - 舊備份缺新欄 → 不列，DB 用 default。
 * - 舊備份多出已廢欄 → 丟棄並記 skippedColumns。
 */
export function planTableInsert(fileColumns: string[], liveColumns: string[]): InsertPlan {
  const live = new Set(liveColumns);
  const columns = fileColumns.filter((c) => live.has(c));
  const skippedColumns = fileColumns.filter((c) => !live.has(c));
  const sql = (table: string) => {
    const colList = columns.map((c) => `"${c}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    return `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`;
  };
  return { columns, skippedColumns, sql };
}
