import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { parseEnvironment, optionalCapabilities } from '../packages/shared/src/environment.js';
import { formatTimestamp, receivedTimestamp } from '../packages/shared/src/timestamp.js';
import { pulseEmbed, safeText, theme } from '../packages/embed-system/src/index.js';
import { commands } from '../apps/bot/src/commands.js';

// 明確的離線測試輸入；不連線 Discord，不當作真實憑證。
const env = { DISCORD_BOT_TOKEN: 'offline-test-only', DISCORD_CLIENT_ID: '100000000000000001', DISCORD_OWNER_ID: '100000000000000002', DATABASE_URL: 'postgresql://localhost/offline_test' };
describe('環境與錯誤安全', () => {
  it('沒有選用憑證仍可啟動核心設定驗證', () => {
    expect(optionalCapabilities(parseEnvironment(env))).toEqual({ r2Configured: false, oauthConfigured: false });
  });
  it('缺少必要設定提供名稱，錯誤不帶 Secret', () => {
    expect(() => parseEnvironment({ DISCORD_BOT_TOKEN: 'secret-never-echo' })).toThrow('DISCORD_OWNER_ID');
    try { parseEnvironment({ DISCORD_BOT_TOKEN: 'secret-never-echo' }); }
    catch (error) { expect(String(error)).not.toContain('secret-never-echo'); }
  });
  it('拒絕非 PostgreSQL URL 與不合法註冊 Guild', () => {
    expect(() => parseEnvironment({ ...env, DATABASE_URL: 'https://example.com' })).toThrow('DATABASE_URL');
    expect(() => parseEnvironment({ ...env, DISCORD_COMMAND_GUILD_IDS: 'other' })).toThrow('DISCORD_COMMAND_GUILD_IDS');
  });
  it('doctor 缺少必要設定時非零退出且不洩漏環境值', () => {
    try {
      execFileSync(process.execPath, ['--import', 'tsx', 'scripts/doctor.ts'], { env: { ...process.env, DISCORD_BOT_TOKEN: '', DISCORD_OWNER_ID: '', DATABASE_URL: '' }, encoding: 'utf8', stdio: 'pipe' });
      throw new Error('doctor 不應成功');
    } catch (error) {
      expect(error).toHaveProperty('status', 1);
      expect(String((error as { stderr?: string }).stderr)).toContain('必要環境設定');
    }
  });
});
describe('Timestamp 與 Embed', () => {
  it('UTC 正確轉換 Taipei 跨日時間', () => {
    const date = new Date('2026-10-08T20:30:45.123Z');
    expect(formatTimestamp(date)).toBe('2026/10/09 04:30:45');
    expect(formatTimestamp(date, 'UTC', true)).toBe('2026/10/08 20:30:45.123');
  });
  it('缺少精確事件時間時標記 received，不推測 Discord 時間', () => {
    const date = new Date('2026-10-09T00:00:00Z');
    expect(receivedTimestamp(date)).toEqual({ eventAt: date, receivedAt: date, processedAt: date, timestampSource: 'received' });
  });
  it('統一品牌 Footer、原生時間、規格色彩', () => {
    const date = new Date('2026-10-09T00:00:00Z');
    const result = pulseEmbed({ title: '成員加入', description: '測試', kind: 'memberJoin', timestamp: date }).toJSON();
    expect(result.footer?.text).toBe('Powered by Pulse Studio');
    expect(result.timestamp).toBe(date.toISOString());
    expect(result.color).toBe(theme.memberJoin);
  });
  it('不會由使用者文字觸發 mention 或 markdown', () => {
    const result = safeText('@everyone @here <@&100000000000000001> **測試**');
    expect(result).not.toContain('@everyone');
    expect(result).not.toContain('@here');
    expect(result).toContain('@\u200b');
    expect(result).toContain('\\*');
  });
  it('大資料仍遵守 6000 字元及 25 fields 限制', () => {
    const result = pulseEmbed({ title: 'T'.repeat(500), description: 'D'.repeat(9000), fields: Array.from({ length: 40 }, () => ({ name: 'N'.repeat(500), value: 'V'.repeat(3000) })) });
    expect(result.length).toBeLessThanOrEqual(6000);
    expect(result.toJSON().fields?.length).toBeLessThanOrEqual(25);
  });
  it('所有 Slash Commands 能轉換為官方結構且限定 Guild', () => {
    expect(commands.map((command) => command.toJSON().name)).toEqual(['logs', 'pulse', 'system', 'owner', 'config', 'module']);
    for (const command of commands) expect(command.toJSON().contexts).toEqual([0]);
  });
});
