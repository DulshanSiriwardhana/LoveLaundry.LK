import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns';

export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export interface MonthMeta {
  monthKey: string;
  year: number;
  month: number;
  daysInMonth: number;
  periodStart: string;
  periodEnd: string;
  dates: string[];
  label: string;
}

export function isValidMonthKey(value: string): boolean {
  if (!MONTH_KEY_REGEX.test(value)) return false;
  const [y, m] = value.split('-').map(Number);
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12;
}

export function isValidServiceDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

export function getMonthMeta(monthKey: string): MonthMeta {
  if (!isValidMonthKey(monthKey)) throw new Error(`Invalid month key: ${monthKey}`);
  const [year, month] = monthKey.split('-').map(Number);
  const first = startOfMonth(new Date(Date.UTC(year, month - 1, 1)));
  const last = endOfMonth(first);
  const dates = eachDayOfInterval({ start: first, end: last }).map((d) => format(d, 'yyyy-MM-dd'));
  return {
    monthKey,
    year,
    month,
    daysInMonth: dates.length,
    periodStart: dates[0],
    periodEnd: dates[dates.length - 1],
    dates,
    label: format(first, 'MMMM yyyy'),
  };
}

export function dateBelongsToMonth(date: string, monthKey: string): boolean {
  return date.startsWith(`${monthKey}-`) && isValidServiceDate(date);
}

export function dayOfMonth(date: string): number {
  return Number(date.slice(-2));
}

export function nextDate(date: string): string {
  return format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
}

export function previousDate(date: string): string {
  return format(addDays(parseISO(date), -1), 'yyyy-MM-dd');
}

export function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

/** Current date in Asia/Colombo as YYYY-MM-DD. */
export function todayInColombo(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function currentMonthKey(): string {
  return todayInColombo().slice(0, 7);
}

export function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
