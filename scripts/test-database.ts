import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// 明確啟用隔離 Schema 測試；不登入 Discord，不操作 Bot 程序。
const result = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', 'tests/database.integration.test.ts'], {
  stdio: 'inherit', env: { ...process.env, DATABASE_TEST_SCHEMA_ISOLATION: '1' },
});
if (result.error) console.error('無法啟動隔離資料庫測試。');
process.exitCode = result.status ?? 1;
