import { expect, it, vi } from 'vitest';
import { readConfigurationAttachment } from '../apps/bot/src/configuration-import.js';
import { guildConfigurationSchema } from '../packages/shared/src/models.js';
const attachment = { name: 'configuration.json', size: 2, url: 'https://cdn.discordapp.com/attachments/123/456/configuration.json?ex=example' };
it('設定附件只接受 Discord HTTPS JSON，下載前拒絕外部網址與超大檔', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
  for (const change of [{ url: 'http://cdn.discordapp.com/attachments/a.json' }, { url: 'https://example.com/attachments/a.json' }, { url: 'https://cdn.discordapp.com:999/attachments/a.json' }, { name: 'data.txt' }, { size: 65537 }]) await expect(readConfigurationAttachment({ ...attachment, ...change }, fetcher)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(fetcher).not.toHaveBeenCalled();
  expect(await readConfigurationAttachment(attachment, fetcher)).toEqual(guildConfigurationSchema.parse({}));
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
});
it('串流超過限制、機密欄位與無效 JSON 都被拒絕', async () => {
  for (const body of ['x'.repeat(65537), '{"secret":"never-import"}', 'invalid-json']) {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    await expect(readConfigurationAttachment(attachment, fetcher)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  }
});
