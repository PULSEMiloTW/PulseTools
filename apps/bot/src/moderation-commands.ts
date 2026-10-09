import type { ChatInputCommandInteraction } from 'discord.js';
import type { Actor } from '../../../packages/shared/src/models.js';
import type { ModerationService } from '../../../packages/core/src/moderation-service.js';
import { PulseError } from '../../../packages/shared/src/errors.js';
import { formatTimestamp } from '../../../packages/shared/src/timestamp.js';
export async function moderationCommand(interaction: ChatInputCommandInteraction, actor: Actor, service: ModerationService) {
  const sub = interaction.options.getSubcommand();
  const timezone = await service.timezone(actor);
  if (sub === 'note') {
    await service.note(actor, interaction.options.getString('case_id', true), interaction.options.getString('text', true), interaction.options.getUser('user', true).id);
    return '案件備註已新增；原始案件與處分結果保留。';
  }
  if (sub === 'detail') {
    const { record, notes } = await service.detail(actor, interaction.options.getString('case_id', true), interaction.options.getUser('user', true).id);
    return `Case ID：${record.id}\n對象：${record.targetId}\n管理者：${record.moderatorId}\n操作：${record.action}\n狀態：${record.status}\n原因：${record.reason}\n時間：${formatTimestamp(record.createdAt, timezone)}（${timezone}）\n關聯案件：${record.relatedCaseId ?? '無'}\n錯誤碼：${record.errorCode ?? '無'}\n實際清理數：${record.affectedCount ?? '不適用'}\n備註：\n${notes.map((n) => `${formatTimestamp(n.createdAt, timezone)} · ${n.authorId} · ${n.text}`).join('\n') || '無'}`;
  }
  if (sub === 'history') return (await service.history(actor, interaction.options.getUser('user', true).id)).map((c) => `${c.id} · ${c.action} · ${c.status} · ${formatTimestamp(c.createdAt, timezone)}（${timezone}）`).join('\n') || '此 Guild 沒有該對象的案件。';
  const target = sub === 'purge' ? actor.userId : sub === 'unban' ? interaction.options.getString('user_id', true) : interaction.options.getUser('user', true).id;
  const optional = { durationMinutes: interaction.options.getInteger('minutes'), count: interaction.options.getInteger('count'), relatedCaseId: interaction.options.getString('related_case_id'), channelId: sub === 'purge' ? interaction.channelId : null };
  const record = await service.execute(actor, { requestId: interaction.id, action: sub, targetId: target, reason: interaction.options.getString('reason', true), confirmed: interaction.options.getBoolean('confirm', true), ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== null)) });
  if (!record) throw new PulseError('INVALID_INPUT');
  return `Case ID：${record.id}\n操作：${record.action}\n狀態：${record.status}\n對象：${record.targetId}\n管理者：${record.moderatorId}\n時間：${formatTimestamp(record.createdAt, timezone)}（${timezone}）\n關聯案件：${record.relatedCaseId ?? '無'}\n錯誤碼：${record.errorCode ?? '無'}\n實際清理數：${record.affectedCount ?? '不適用'}`;
}
