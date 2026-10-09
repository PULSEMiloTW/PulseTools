import { config } from 'dotenv';
import type { PoolClient } from 'pg';
import { ActivityType, Client, Events, GatewayIntentBits, Partials, PermissionFlagsBits } from 'discord.js';
import { PostgresAuditRepository } from '../../../packages/database/src/audit-repository.js';
import { EventRouter } from '../../../packages/core/src/event-router.js';
import { AuditService } from '../../../packages/core/src/audit-service.js';
import { bindMessageEvents } from './message-events.js';
import { bindServerEvents } from './server-events.js';
import { PostgresServerEventRepository } from '../../../packages/database/src/server-event-repository.js';
import { PostgresNotificationRepository } from '../../../packages/database/src/notification-repository.js';
import { NotificationWorker } from '../../../packages/core/src/notification-worker.js';
import type { ServerEvent } from '../../../packages/shared/src/server-events.js';
import { createHash } from 'node:crypto';
import { connectDatabase } from '../../../packages/database/src/connection.js';
import { PostgresRepository } from '../../../packages/database/src/repository.js';
import { createCore } from '../../../packages/core/src/index.js';
import { parseEnvironment, optionalCapabilities } from '../../../packages/shared/src/environment.js';
import { handleCommand } from './interaction-handler.js';
import { safeErrorCode } from '../../../packages/shared/src/errors.js';

// 開發及編譯後皆從專案根啟動；不搜尋其他專案的 .env。
config({ path: '.env', quiet: true });
const startedAt = new Date();
let shuttingDown = false;
async function main() {
  const env = parseEnvironment(process.env);
  const { pool, db } = connectDatabase(env.DATABASE_URL);
  const repository = new PostgresRepository(db);
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildInvites];
  if (env.DISCORD_MESSAGE_EVENTS_ENABLED) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  if (env.DISCORD_MEMBER_EVENTS_ENABLED) intents.push(GatewayIntentBits.GuildMembers);
  const client = new Client({ intents, partials: [Partials.Message, Partials.Channel, Partials.GuildMember], allowedMentions: { parse: [], repliedUser: false } });
  const core = createCore(repository, env.DISCORD_OWNER_ID, env.DISCORD_MESSAGE_EVENTS_ENABLED, env.DISCORD_MEMBER_EVENTS_ENABLED);
  const auditRepository = new PostgresAuditRepository(db);
  const serverRepository = new PostgresServerEventRepository(db);
  const notifications = new PostgresNotificationRepository(db);
  const audit = new AuditService(auditRepository, core, serverRepository);
  const worker = new NotificationWorker(notifications, async (job, message) => {
    const guild = client.guilds.cache.get(job.guildId);
    const channel = await guild?.channels.fetch(job.channelId);
    const me = guild?.members.me;
    if (!channel?.isTextBased() || !('send' in channel) || !me || !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]) || (channel.isThread() && !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessagesInThreads))) throw { code: '50013' };
    const nonce = BigInt('0x' + createHash('sha256').update(job.id).digest('hex').slice(0, 16)).toString();
    return (await channel.send({ ...message, nonce, enforceNonce: true })).id;
  }, (job) => core.modules.enabled(job.guildId, job.moduleId), () => client.isReady());
  const wake = () => { void worker.flush().catch(() => console.error('[PulseTools] NOTIFICATION_WORKER_FAILED')); };
  const router = new EventRouter(async (event) => {
    if (await core.modules.enabled(event.guildId, 'PT-01')) await auditRepository.ingest(event);
    wake();
  }, (code) => console.error(`[PulseTools] ${code}`));
  const serverRouter = new EventRouter<ServerEvent>(async (event) => {
    if (await core.modules.enabled(event.guildId, 'PT-01') || ((event.type === 'member.join' || event.type === 'member.leave') && await core.modules.enabled(event.guildId, 'PT-02'))) await serverRepository.ingest(event);
    wake();
  }, (code) => console.error(`[PulseTools] ${code}`));
  let retention: ReturnType<typeof setInterval> | undefined;
  let delivery: ReturnType<typeof setInterval> | undefined;
  // 保留連線持有 advisory lock，避免同一資料庫啟動兩個 Bot 並重複處理事件。
  let lease: PoolClient | undefined;
  const shutdown = async (exitCode: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timer = setTimeout(() => process.exit(exitCode || 1), 10000).unref();
    client.destroy();
    if (retention) clearInterval(retention);
    if (delivery) clearInterval(delivery);
    await router.shutdown();
    await serverRouter.shutdown();
    await worker.shutdown();
    await core.modules.shutdown();
    lease?.release();
    await pool.end();
    clearTimeout(timer);
    process.exitCode = exitCode;
  };
  pool.on('error', () => { console.error('[PulseTools] 資料庫連線異常，安全停止。'); void shutdown(1); });
  process.once('SIGINT', () => { void shutdown(0); });
  process.once('SIGTERM', () => { void shutdown(0); });
  try {
    lease = await pool.connect();
    lease.on('error', () => { console.error('[PulseTools] Bot 程序鎖連線中斷，安全停止。'); void shutdown(1); });
    const lock = await lease.query<{ locked: boolean }>('select pg_try_advisory_lock(735902, 1) as locked');
    if (!lock.rows[0]?.locked) throw new Error('已有 PulseTools Bot 使用此資料庫；請勿重複啟動。');
    await repository.authorizedGuilds();
    await repository.auditHealth();
    await notifications.recover();
    await auditRepository.prune();
    let pruning = false;
    retention = setInterval(() => {
      if (pruning) return;
      pruning = true;
      void auditRepository.prune().catch(() => console.error('[PulseTools] AUDIT_RETENTION_FAILED')).finally(() => { pruning = false; });
    }, 3600000).unref();
    await core.modules.restore();
    if (env.DISCORD_MESSAGE_EVENTS_ENABLED) bindMessageEvents(client, core, router);
    bindServerEvents(client, core, serverRouter);
    const capabilities = optionalCapabilities(env);
    console.info(`[PulseTools] 選用設定：R2 ${capabilities.r2Configured ? '已設定（模組尚未開放）' : '未設定'}；OAuth ${capabilities.oauthConfigured ? '已設定（Phase 6 開放）' : '未設定'}。`);
    const presence = () => client.user?.setPresence({ status: 'online', activities: [{ name: 'Powered by Pulse Studio', type: ActivityType.Watching }] });
    client.once(Events.ClientReady, (ready) => {
      if (ready.application.id !== env.DISCORD_CLIENT_ID) {
        console.error('[PulseTools] Bot Token 與 Application ID 不一致，停止啟動。'); void shutdown(1); return;
      }
      presence();
      delivery = setInterval(wake, 2000).unref();
      wake();
      console.info(`[PulseTools] Discord 已連線 · Bot ${ready.user.id} · Guild ${ready.guilds.cache.size} · ${new Date().toISOString()}`);
    });
    client.on(Events.ShardResume, presence);
    client.on(Events.InteractionCreate, (interaction) => {
      if (!shuttingDown && interaction.isChatInputCommand()) void handleCommand(interaction, { startedAt, client, core, audit, notifications, wakeNotifications: wake, messageEventsEnabled: env.DISCORD_MESSAGE_EVENTS_ENABLED, memberEventsEnabled: env.DISCORD_MEMBER_EVENTS_ENABLED });
    });
    client.on(Events.Error, () => console.error('[PulseTools] Gateway 錯誤；discord.js 將處理重連。'));
    client.on(Events.Warn, () => console.warn('[PulseTools] Gateway 警告，請檢查連線與權限。'));
    await client.login(env.DISCORD_BOT_TOKEN);
  } catch (error) {
    console.error(`[PulseTools] 啟動失敗：${safeErrorCode(error)}。請執行 npm run doctor；確認 migration、資料庫、Bot 設定與是否重複啟動。`);
    await shutdown(1);
  }
}
main().catch((error: unknown) => {
  // 環境驗證訊息由本程式建立，僅包含變數名稱。
  console.error(error instanceof Error && error.message.startsWith('缺少或不合法') ? error.message : '[PulseTools] 無法初始化。');
  process.exitCode = 1;
});
