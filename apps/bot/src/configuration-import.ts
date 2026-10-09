import { guildConfigurationSchema } from '../../../packages/shared/src/models.js';
import { PulseError } from '../../../packages/shared/src/errors.js';
const maxBytes = 65536;
export async function readConfigurationAttachment(attachment: { size: number; name: string | null; url: string }, fetcher: typeof fetch = fetch) {
  let url: URL;
  try { url = new URL(attachment.url); } catch { throw new PulseError('INVALID_INPUT'); }
  if (attachment.size < 1 || attachment.size > maxBytes || !attachment.name?.toLowerCase().endsWith('.json') || url.protocol !== 'https:' || !['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname) || !url.pathname.startsWith('/attachments/') || url.username || url.password || (url.port && url.port !== '443')) throw new PulseError('INVALID_INPUT');
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok || !response.body || Number(response.headers.get('content-length') ?? 0) > maxBytes) throw new PulseError('INVALID_INPUT');
  const reader = response.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new PulseError('INVALID_INPUT');
      parts.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  try {
    return guildConfigurationSchema.parse(JSON.parse(Buffer.concat(parts).toString('utf8')));
  } catch { throw new PulseError('INVALID_INPUT'); }
}
