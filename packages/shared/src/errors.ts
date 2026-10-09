export type ErrorCode = 'OWNER_REQUIRED' | 'GUILD_DENIED' | 'PERMISSION_DENIED' | 'LOCKDOWN' | 'INVALID_INPUT' | 'CONFLICT' | 'MODULE_UNAVAILABLE' | 'DEPENDENCY_REQUIRED' | 'DEPENDENT_RUNNING' | 'DATABASE_UNAVAILABLE';
const messages: Record<ErrorCode, string> = {
  OWNER_REQUIRED: '此操作僅限 PulseTools Owner。',
  GUILD_DENIED: '此伺服器尚未獲得 PulseTools 授權。',
  PERMISSION_DENIED: '你沒有此操作所需的 PulseTools 與 Discord 權限。',
  LOCKDOWN: 'Owner 緊急安全模式已啟用，此操作暫停。',
  INVALID_INPUT: '輸入內容不符合設定規格。',
  CONFLICT: '設定已被其他操作更新，請重新讀取後再試。',
  MODULE_UNAVAILABLE: '此模組尚未實作或無法使用，不能啟用。',
  DEPENDENCY_REQUIRED: '請先啟用此模組所需的依賴。',
  DEPENDENT_RUNNING: '有其他模組依賴此模組，請先停用依賴它的模組。',
  DATABASE_UNAVAILABLE: '資料庫無法使用，請檢查本機設定與連線。',
};
export class PulseError extends Error {
  constructor(public readonly code: ErrorCode) { super(messages[code]); this.name = 'PulseError'; }
}
// 不輸出第三方例外原文；可能含 URL 密碼、Token、請求內容或原始訊息。
export function safeErrorCode(error: unknown): string {
  return error instanceof PulseError ? error.code : 'INTERNAL_ERROR';
}
