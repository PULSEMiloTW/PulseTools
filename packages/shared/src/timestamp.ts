export function formatTimestamp(value: Date, timezone = 'Asia/Taipei', milliseconds = false): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  const base = `${part('year')}/${part('month')}/${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`;
  return milliseconds ? `${base}.${value.getUTCMilliseconds().toString().padStart(3, '0')}` : base;
}
export function receivedTimestamp(now = new Date()) {
  return { eventAt: now, receivedAt: now, processedAt: now, timestampSource: 'received' as const };
}
