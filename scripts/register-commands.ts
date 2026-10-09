import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { z } from 'zod';
import { commands } from '../apps/bot/src/commands.js';
import { parseEnvironment } from '../packages/shared/src/environment.js';
import { RegistrationError, registrationFailureMessage } from './registration-errors.js';

async function register() {
  const env = parseEnvironment(process.env);
  if (!env.DISCORD_COMMAND_GUILD_IDS.length) throw new RegistrationError('請設定 DISCORD_COMMAND_GUILD_IDS；不會自動註冊全域指令。');
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
  const application = z.object({ id: z.string() }).parse(await rest.get(Routes.oauth2CurrentApplication()));
  if (application.id !== env.DISCORD_CLIENT_ID) throw new RegistrationError('Bot Token 與 DISCORD_CLIENT_ID 不一致。');
  // 先確認全部目標，避免第二個 Guild 無效時第一個已被修改。
  for (const guildId of env.DISCORD_COMMAND_GUILD_IDS) {
    try { await rest.get(Routes.guild(guildId)); }
    catch (error) { throw new RegistrationError(`Guild ${guildId} 預檢失敗：${registrationFailureMessage(error)} 尚未寫入任何指令。`); }
  }
  for (const guildId of env.DISCORD_COMMAND_GUILD_IDS) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body: commands.map((command) => command.toJSON()) });
    console.info(`已註冊 ${commands.length} 個頂層指令至測試 Guild ${guildId}。Guild 業務授權仍需 Owner allow。`);
  }
}
register().catch((error: unknown) => { console.error(registrationFailureMessage(error)); process.exitCode = 1; });
