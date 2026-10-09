export class RegistrationError extends Error {}

export function registrationFailureMessage(error: unknown): string {
  if (error instanceof RegistrationError) return error.message;
  if (error instanceof Error && error.message.startsWith('缺少或不合法的必要環境設定：')) return error.message;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  if (code === 10004) return 'Discord 10004：無法存取目標 Guild。請確認填的是伺服器 ID，且 PulseTools Bot 已加入該伺服器。';
  if (code === 50001) return 'Discord 50001：缺少目標 Guild 的存取權。請確認 Bot 安裝及 applications.commands 授權。';
  if (code === 50013) return 'Discord 50013：缺少所需權限。請檢查目標 Guild 的應用程式安裝權限。';
  if (status === 401) return 'Discord 401：Bot Token 無效，請在本機確認 DISCORD_BOT_TOKEN。';
  return '指令註冊未完成；請確認網路、Discord 服務及指令設定。原始錯誤與機密不會輸出。';
}
