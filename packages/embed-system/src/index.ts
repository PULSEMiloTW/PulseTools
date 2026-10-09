import { EmbedBuilder, escapeMarkdown } from 'discord.js';

export const theme = {
  memberJoin: 0x10b981, memberLeave: 0xf87171, voice: 0x8b5cf6, moderation: 0xf59e0b,
  information: 0x3b82f6, error: 0xef4444, r2: 0x3b82f6, success: 0x10b981,
} as const;
export type EmbedKind = keyof typeof theme;
export const allowedMentions = { parse: [] as ('users' | 'roles' | 'everyone')[], repliedUser: false };
export function safeText(value: string, maxLength = 1024): string {
  return escapeMarkdown(value).replaceAll('@', '@\u200b').slice(0, maxLength) || '—';
}
export function pulseEmbed(input: {
  title: string;
  description: string;
  kind?: EmbedKind;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: Date;
  thumbnail?: string;
}) {
  const embed = new EmbedBuilder()
    .setTitle(safeText(input.title, 256))
    .setDescription(safeText(input.description, 3000))
    .setColor(theme[input.kind ?? 'information'])
    .setFooter({ text: 'Powered by Pulse Studio' })
    .setTimestamp(input.timestamp ?? new Date());
  let budget = 6000 - embed.length;
  for (const field of input.fields?.slice(0, 25) ?? []) {
    const name = safeText(field.name, Math.min(256, budget - 1));
    if (budget < 3 || name.length >= budget) break;
    const value = safeText(field.value, Math.min(1024, budget - name.length));
    embed.addFields({ name, value, inline: field.inline ?? false });
    budget -= name.length + value.length;
  }
  if (input.thumbnail && /^https:\/\//.test(input.thumbnail)) embed.setThumbnail(input.thumbnail);
  return embed;
}
