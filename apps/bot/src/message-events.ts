import { Events, type Client } from 'discord.js';
import { z } from 'zod';
import type { EventRouter } from '../../../packages/core/src/event-router.js';
import type { Core } from '../../../packages/core/src/index.js';
import { snowflake } from '../../../packages/shared/src/models.js';
import type { MessageEvent } from '../../../packages/shared/src/audit.js';

const payloadSchema = z.object({
  guild_id: snowflake.optional(), channel_id: snowflake, id: snowflake.optional(), ids: z.array(snowflake).max(100).optional(),
  author: z.object({ id: snowflake, bot: z.boolean().optional() }).optional(),
  content: z.string().max(4000).optional(), edited_timestamp: z.iso.datetime({ offset: true }).nullable().optional(),
});
export function gatewayMessageEvents(name: string, input: unknown, receivedAt = new Date()): MessageEvent[] {
  const type = name === 'MESSAGE_CREATE' ? 'message.create' : name === 'MESSAGE_UPDATE' ? 'message.update' : name === 'MESSAGE_DELETE' || name === 'MESSAGE_DELETE_BULK' ? 'message.delete' : null;
  if (!type) return [];
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success || !parsed.data.guild_id || parsed.data.author?.bot) return [];
  const data = parsed.data;
  const ids = name === 'MESSAGE_DELETE_BULK' ? data.ids ?? [] : data.id ? [data.id] : [];
  return ids.map((id) => {
    const at = type === 'message.create' ? new Date(Number((BigInt(id) >> 22n) + 1420070400000n)) : type === 'message.update' && data.edited_timestamp ? new Date(data.edited_timestamp) : null;
    return { guildId: data.guild_id!, channelId: data.channel_id, messageId: id, authorId: data.author?.id ?? null,
      type, eventKey: `${type}:${id}:${type === 'message.update' ? (at?.toISOString() ?? 'unavailable') : ''}`,
      content: type === 'message.delete' ? null : data.content ?? null, partial: data.content === undefined,
      receivedAt, eventAt: at, messageCreatedAt: new Date(Number((BigInt(id) >> 22n) + 1420070400000n)) };
  });
}
export function bindMessageEvents(client: Client, core: Core, router: EventRouter) {
  // 使用原始 Dispatch 的實際欄位，避免把 discord.js 快取補齊的舊原文當作新版本。
  client.on(Events.Raw, (packet) => {
    for (const event of gatewayMessageEvents(packet.t, packet.d)) {
      if (core.modules.isRunning(event.guildId, 'PT-01')) void router.dispatch(event);
    }
  });
}
