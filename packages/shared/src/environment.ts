import { z } from 'zod';
import { snowflake } from './models.js';

const optionalText = z.preprocess((value) => value === '' ? undefined : value, z.string().optional());
const schema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_OWNER_ID: snowflake,
  DATABASE_URL: z.string().url().refine((value) => {
    try { return ['postgres:', 'postgresql:'].includes(new URL(value).protocol); } catch { return false; }
  }),
  DISCORD_COMMAND_GUILD_IDS: z.string().default('').transform((value) => value.split(',').map((id) => id.trim()).filter(Boolean)).pipe(z.array(snowflake).max(10)),
  DISCORD_CLIENT_SECRET: optionalText,
  SESSION_SECRET: optionalText,
  R2_ACCOUNT_ID: optionalText,
  R2_ACCESS_KEY_ID: optionalText,
  R2_SECRET_ACCESS_KEY: optionalText,
  R2_BUCKET_NAME: optionalText,
  R2_PUBLIC_BASE_URL: optionalText,
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DISCORD_MESSAGE_EVENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DISCORD_MEMBER_EVENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});
export type Environment = z.infer<typeof schema>;
export function parseEnvironment(input: Record<string, string | undefined>): Environment {
  const result = schema.safeParse(input);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path[0]))].join('、');
    throw new Error(`缺少或不合法的必要環境設定：${names}。請在本機 .env 修正；不要將機密貼到聊天。`);
  }
  return result.data;
}
export function optionalCapabilities(env: Environment) {
  return {
    r2Configured: [env.R2_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET_NAME].every(Boolean),
    oauthConfigured: Boolean(env.DISCORD_CLIENT_SECRET && env.SESSION_SECRET && env.SESSION_SECRET.length >= 32),
  };
}
