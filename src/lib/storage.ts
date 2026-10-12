export const prefix = "pulsetools:";
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function remove(key: string) {
  try {
    localStorage.removeItem(prefix + key);
  } catch {}
}
export function stringList(key: string): string[] {
  const value = read<unknown>(key, []);
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}
export function clearData() {
  try {
    Object.keys(localStorage)
      .filter((x) => x.startsWith(prefix))
      .forEach((x) => localStorage.removeItem(x));
    return true;
  } catch {
    return false;
  }
}
