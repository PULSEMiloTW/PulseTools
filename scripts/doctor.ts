import 'dotenv/config';
import { parseEnvironment, optionalCapabilities } from '../packages/shared/src/environment.js';
import { connectDatabase } from '../packages/database/src/connection.js';
import { PostgresRepository } from '../packages/database/src/repository.js';

async function doctor() {
  const env = parseEnvironment(process.env);
  console.info('必要環境變數驗證通過（不顯示值）。');
  console.info(`Node ${process.versions.node}；R2 / OAuth 為選用設定：${JSON.stringify(optionalCapabilities(env))}`);
  const { db, pool } = connectDatabase(env.DATABASE_URL);
  try {
    const repository = new PostgresRepository(db);
    await repository.health();
    await repository.auditHealth();
    await repository.managementHealth();
    const guilds = await repository.authorizedGuilds();
    await repository.lockdown();
    console.info(`PostgreSQL 與基礎資料表正常；已授權 Guild 數：${guilds.length}。`);
    console.info('doctor 不登入 Discord、不註冊指令、不修改資料，不能當作 Bot 上線證明。');
  } finally { await pool.end(); }
}
doctor().catch((error: unknown) => {
  console.error(error instanceof Error && error.message.startsWith('缺少或不合法') ? error.message : '資料庫或基礎 Schema 不可用；請確認 DATABASE_URL 並執行 migration。');
  process.exitCode = 1;
});
