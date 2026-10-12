// All dates are local calendar days in "YYYY-MM-DD" form.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Monday of the week containing the given day. */
export function startOfWeek(s: string): string {
  const d = parseISODate(s);
  return addDays(s, -((d.getDay() + 6) % 7));
}

export function formatDay(s: string): string {
  return parseISODate(s).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatRange(start: string): string {
  const a = parseISODate(start);
  const b = parseISODate(addDays(start, 6));
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}`;
}
