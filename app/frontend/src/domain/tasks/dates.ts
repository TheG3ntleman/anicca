import type { CalendarDate } from './types';
export function localDate(now = new Date()): CalendarDate {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function addDays(date: CalendarDate, amount: number): CalendarDate {
  const [year, month, day] = date.split('-').map(Number);
  return localDate(new Date(year, month - 1, day + amount, 12));
}
export function validDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setFullYear(year, month - 1, day);
  parsed.setHours(12, 0, 0, 0);
  return localDate(parsed) === value && year >= 1000;
}
export function formatDate(
  date: CalendarDate | null,
  today = localDate(),
): string {
  if (!date) return 'Not scheduled';
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: year === new Date().getFullYear() ? undefined : 'numeric',
  });
}
