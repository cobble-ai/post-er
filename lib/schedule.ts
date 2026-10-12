import { addDays } from "./dates";
import type { Draft, Platform } from "./types";

const onCalendar = (d: Draft) => d.status === "scheduled" || d.status === "posted";

/** First day from today with nothing scheduled or posted on that platform. */
export function nextEmptyDay(drafts: Draft[], platform: Platform, today: string): string {
  const taken = new Set(drafts.filter((d) => d.platform === platform && onCalendar(d)).map((d) => d.scheduled_date));
  let day = today;
  while (taken.has(day)) day = addDays(day, 1);
  return day;
}

export function slotFor(drafts: Draft[], day: string, platform: Platform): Draft | undefined {
  return drafts.find((d) => d.platform === platform && d.scheduled_date === day && onCalendar(d));
}

/** Consecutive days with at least one posted draft, ending today or yesterday. */
export function computeStreak(drafts: Draft[], today: string): number {
  const posted = new Set(drafts.filter((d) => d.status === "posted").map((d) => d.scheduled_date));
  let day = posted.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (posted.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
