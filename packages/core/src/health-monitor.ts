import type { Client } from 'discord.js';
import { Routes } from 'discord.js';
import { performance } from 'node:perf_hooks';
import type { Core } from './index.js';
import type { PostgresMonitoringRepository } from '../../database/src/monitoring-repository.js';
import type { PostgresNotificationRepository } from '../../database/src/notification-repository.js';
import type { Actor } from '../../shared/src/models.js';
import type { HealthMetrics } from '../../shared/src/monitoring.js';
export class HealthMonitor {
  private cpu = process.cpuUsage();
  private measuredAt = performance.now();
  private active: Promise<void> | undefined;
  constructor(private readonly core: Core, private readonly client: Client, private readonly startedAt: Date,
    private readonly store: Pick<PostgresMonitoringRepository, 'sample'|'history'|'stats'|'prune'>,
    private readonly notifications: Pick<PostgresNotificationRepository, 'status'>) {}
  async status(actor: Actor): Promise<HealthMetrics> {
    await this.core.permissions.requireAdmin(actor);
    const measured = performance.now(), cpu = process.cpuUsage(), elapsed = Math.max(1, measured - this.measuredAt);
    const cpuPercent = Math.max(0, ((cpu.user - this.cpu.user) + (cpu.system - this.cpu.system)) / (elapsed * 1000) * 100);
    this.cpu = cpu; this.measuredAt = measured;
    const before = performance.now();
    let databaseHealthy = false, databaseLatencyMs: number | null = null;
    try { databaseHealthy = await this.core.repository.health(); databaseLatencyMs = performance.now() - before; } catch { /* 真實失敗以 Degraded 顯示，不輸出連線設定。 */ }
    let apiLatencyMs: number | null = null;
    if (this.client.isReady()) {
      const apiStart = performance.now();
      try { await this.client.rest.get(Routes.user('@me')); apiLatencyMs = performance.now() - apiStart; } catch { /* 不以 Gateway ping 假冒 REST latency。 */ }
    }
    const inventory = await Promise.all([this.core.repository.authorizedGuilds(), this.core.repository.moduleStates(actor.guildId), this.store.stats(actor.guildId), this.notifications.status(actor.guildId)])
      .then(([guilds, modules, errors, deliveries]) => ({ authorizedGuildCount: guilds.length, activeModuleCount: modules.filter((m) => this.core.modules.isRunning(actor.guildId, m.moduleId)).length,
        errorCount: errors.reduce((sum, r) => sum + r.count, 0), pendingNotifications: deliveries.filter((r) => r.status === 'Pending' || r.status === 'Sending').reduce((sum, r) => sum + r.count, 0), failedNotifications: deliveries.filter((r) => r.status === 'Failed').reduce((sum, r) => sum + r.count, 0) }))
      .catch(() => ({ authorizedGuildCount: null, activeModuleCount: null, errorCount: null, pendingNotifications: null, failedNotifications: null }));
    const memory = process.memoryUsage();
    return { startedAt: this.startedAt.toISOString(), uptimeSeconds: Math.max(0, (Date.now() - this.startedAt.getTime()) / 1000),
      botStatus: this.client.isReady() && databaseHealthy && apiLatencyMs !== null && inventory.authorizedGuildCount !== null ? 'Online' : 'Degraded', gatewayPingMs: this.client.ws.ping >= 0 ? this.client.ws.ping : null, apiLatencyMs, databaseHealthy, databaseLatencyMs,
      cpuPercent, rssBytes: memory.rss, heapBytes: memory.heapUsed, guildCount: this.client.guilds.cache.size, ...inventory };
  }
  poll(ownerId: string) {
    if (this.active) return this.active;
    this.active = this.collect(ownerId).finally(() => { this.active = undefined; });
    return this.active;
  }
  private async collect(ownerId: string) {
    for (const guild of await this.core.repository.authorizedGuilds()) {
      if (await this.core.modules.enabled(guild.id, 'PT-05')) await this.store.sample(guild.id, await this.status({ guildId: guild.id, userId: ownerId, nativeAdministrator: false }));
    }
    await this.store.prune();
  }
  async history(actor: Actor) { await this.core.permissions.requireAdmin(actor); return this.store.history(actor.guildId); }
  async shutdown() { await this.active; }
}
