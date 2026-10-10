export function assertTimestamp(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error('Invalid timestamp.');
}
export function assertId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > 200)
    throw new Error('Invalid record ID.');
}
