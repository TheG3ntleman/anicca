export const MAX_EXPORT_BYTES = 250 * 1024 * 1024;
export function encodedByteLength(value: string): number {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length % 4 ||
    /[^A-Za-z0-9+/=]/.test(value)
  )
    throw new Error('Invalid media encoding.');
  const padding = value.indexOf('=');
  if (padding !== -1 && !['=', '=='].includes(value.slice(padding)))
    throw new Error('Invalid media encoding.');
  return (
    (value.length / 4) * 3 -
    (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0)
  );
}
