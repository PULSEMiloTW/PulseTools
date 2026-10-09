import { PermissionFlagsBits, type AutocompleteInteraction } from 'discord.js';
import type { ModerationService } from '../../../packages/core/src/moderation-service.js';
import { formatTimestamp } from '../../../packages/shared/src/timestamp.js';
export async function handleModerationAutocomplete(interaction: AutocompleteInteraction, moderation: ModerationService) {
  try {
    if (!interaction.guildId || interaction.commandName !== 'mod') { await interaction.respond([]); return; }
    const focused = interaction.options.getFocused(true), sub = interaction.options.getSubcommand();
    if (!((focused.name === 'related_case_id' && ['untimeout','unban'].includes(sub)) || (focused.name === 'case_id' && ['detail','note'].includes(sub)))) { await interaction.respond([]); return; }
    const option = interaction.options.get(sub === 'unban' ? 'user_id' : 'user');
    if (typeof option?.value !== 'string') { await interaction.respond([]); return; }
    const result = await moderation.choices({ userId: interaction.user.id, guildId: interaction.guildId, nativeAdministrator: interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false }, option.value, String(focused.value), sub === 'untimeout' ? 'timeout' : sub === 'unban' ? 'ban' : undefined);
    const labels: Record<string, string> = { warn: '警告', timeout: '禁言', untimeout: '解除禁言', kick: '踢除', ban: '封鎖', unban: '解除封鎖', purge: '訊息清理' };
    await interaction.respond(Array.isArray(result) ? [] : result.records.slice(0, 25).map((record) => ({
      name: `${record.id} · ${labels[record.action]} · ${formatTimestamp(record.createdAt, result.timezone)} ${result.timezone} · ${record.status}`.slice(0, 100), value: record.id,
    })));
  } catch {
    // 選單不是授權憑證；拒絕或服務錯誤不洩露任何案件存在與否。
    if (!interaction.responded) { try { await interaction.respond([]); } catch { console.error('[PulseTools] MOD_AUTOCOMPLETE_FAILED'); } }
  }
}
