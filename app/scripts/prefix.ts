export const MSG_PREFIX = 'sp:';
export function pref(type: string): string {
  return MSG_PREFIX + type;
}
export function strip(type: string | undefined): string | undefined {
  if (!type) return type;
  return type.startsWith(MSG_PREFIX) ? type.slice(MSG_PREFIX.length) : type;
}
