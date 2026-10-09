import { expect, it } from 'vitest';
import { RegistrationError, registrationFailureMessage } from '../scripts/registration-errors.js';

it('Unknown Guild 提供可執行的修正方式且不顯示原始錯誤', () => {
  const message = registrationFailureMessage({ code: 10004, message: 'secret-never-output' });
  expect(message).toContain('伺服器 ID');
  expect(message).toContain('已加入');
  expect(message).not.toContain('secret-never-output');
});
it('無效 Token 只顯示固定安全訊息', () => {
  expect(registrationFailureMessage({ status: 401, requestBody: 'secret' })).toContain('Token 無效');
});
it('未知例外不能輸出 Token、URL 或第三方錯誤原文', () => {
  expect(registrationFailureMessage(new Error('secret-never-output'))).not.toContain('secret-never-output');
});
it('本程式建立的預檢原因可以顯示', () => {
  expect(registrationFailureMessage(new RegistrationError('目標預檢失敗'))).toBe('目標預檢失敗');
});
