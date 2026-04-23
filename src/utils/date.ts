import type { DateKey } from "../types";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateKey = (value: Date): DateKey =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

export const todayDateKey = (): DateKey => toDateKey(new Date());

export const parseDateKey = (dateKey: DateKey): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const isValidDateKey = (value: string): value is DateKey => {
  if (!DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const parsed = parseDateKey(value);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
};

export const addDaysToDateKey = (dateKey: DateKey, days: number): DateKey => {
  const next = parseDateKey(dateKey);
  next.setDate(next.getDate() + days);
  return toDateKey(next);
};

export const formatDateLabel = (dateKey: DateKey): string => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return formatter.format(parseDateKey(dateKey));
};

export const startOfWeekDateKey = (
  dateKey: DateKey,
  weekStartsOn: 0 | 1 = 1,
): DateKey => {
  const base = parseDateKey(dateKey);
  const day = base.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  base.setDate(base.getDate() - diff);
  return toDateKey(base);
};

export const endOfWeekDateKey = (
  dateKey: DateKey,
  weekStartsOn: 0 | 1 = 1,
): DateKey => addDaysToDateKey(startOfWeekDateKey(dateKey, weekStartsOn), 6);

export const getWeekDateKeys = (
  dateKey: DateKey,
  weekStartsOn: 0 | 1 = 1,
): DateKey[] => {
  const start = startOfWeekDateKey(dateKey, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(start, index));
};

export const formatShortWeekdayLabel = (dateKey: DateKey): string => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
  });
  return formatter.format(parseDateKey(dateKey));
};

export const formatWeekRangeLabel = (
  dateKey: DateKey,
  weekStartsOn: 0 | 1 = 1,
): string => {
  const start = parseDateKey(startOfWeekDateKey(dateKey, weekStartsOn));
  const end = parseDateKey(endOfWeekDateKey(dateKey, weekStartsOn));

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    });
    return `${formatter.format(start)} - ${start.getDate()}-${end.getDate()}`;
  }

  const startFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startFormatter.format(start)} - ${endFormatter.format(end)}`;
};
