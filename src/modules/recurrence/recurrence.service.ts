import pkg from 'rrule';
const { RRule } = pkg;
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

interface RecurrenceParams {
  startAt: Date;
  recurrenceType: 'once' | 'secondly' | 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  recurrenceInterval?: number;
  timezone: string;
}

export const calculateNextTrigger = (params: RecurrenceParams): Date | null => {
  const { startAt, recurrenceType, recurrenceInterval, timezone } = params;
  if (!startAt || isNaN(new Date(startAt).getTime())) return null;

  const now = dayjs.tz(dayjs(), timezone);
  let start = dayjs.tz(startAt, timezone);

  if (recurrenceType === 'once') {
    return start.isAfter(now) ? start.toDate() : null;
  }

  // Performance optimization: if the frequency is high (secondly/minutely) 
  // and the start date is far in the past, move it forward to avoid RRule skipping billions of occurrences.
  if (recurrenceType === 'secondly' || recurrenceType === 'minutely') {
    const oneHourAgo = now.subtract(1, 'hour');
    if (start.isBefore(oneHourAgo)) {
      // Adjust start date to be within the last hour, maintaining the same sub-minute/sub-second "phase"
      const diffSeconds = now.diff(start, 'second');
      const intervalInSeconds = recurrenceType === 'secondly' ? (recurrenceInterval || 1) : (recurrenceInterval || 1) * 60;
      const skipSeconds = Math.floor(diffSeconds / intervalInSeconds) * intervalInSeconds;
      start = start.add(skipSeconds, 'second');
    }
  }

  let freq: any;
  switch (recurrenceType) {
    case 'secondly': freq = RRule.SECONDLY; break;
    case 'minutely': freq = RRule.MINUTELY; break;
    case 'hourly': freq = RRule.HOURLY; break;
    case 'daily': freq = RRule.DAILY; break;
    case 'weekly': freq = RRule.WEEKLY; break;
    case 'monthly': freq = RRule.MONTHLY; break;
    case 'custom': freq = RRule.DAILY; break;
    default: freq = RRule.DAILY;
  }

  const rule = new RRule({
    freq,
    interval: recurrenceInterval || 1,
    dtstart: start.toDate(),
  });

  try {
    const next = rule.after(now.toDate(), false);
    return next || null;
  } catch (error) {
    console.error('RRule Error in calculateNextTrigger:', error);
    return null;
  }
};
export const getUpcomingOccurrences = (params: RecurrenceParams, count: number = 5): Date[] => {
  const { startAt, recurrenceType, recurrenceInterval, timezone } = params;
  if (!startAt || isNaN(new Date(startAt).getTime())) return [];

  const now = dayjs.tz(dayjs(), timezone);
  let start = dayjs.tz(startAt, timezone);

  if (recurrenceType === 'once') {
    return start.isAfter(now) ? [start.toDate()] : [];
  }

  // Performance optimization (same as above)
  if (recurrenceType === 'secondly' || recurrenceType === 'minutely') {
    const oneHourAgo = now.subtract(1, 'hour');
    if (start.isBefore(oneHourAgo)) {
      const diffSeconds = now.diff(start, 'second');
      const intervalInSeconds = recurrenceType === 'secondly' ? (recurrenceInterval || 1) : (recurrenceInterval || 1) * 60;
      const skipSeconds = Math.floor(diffSeconds / intervalInSeconds) * intervalInSeconds;
      start = start.add(skipSeconds, 'second');
    }
  }

  let freq: any;
  switch (recurrenceType) {
    case 'secondly': freq = RRule.SECONDLY; break;
    case 'minutely': freq = RRule.MINUTELY; break;
    case 'hourly': freq = RRule.HOURLY; break;
    case 'daily': freq = RRule.DAILY; break;
    case 'weekly': freq = RRule.WEEKLY; break;
    case 'monthly': freq = RRule.MONTHLY; break;
    default: freq = RRule.DAILY;
  }

  const rule = new RRule({
    freq,
    interval: recurrenceInterval || 1,
    dtstart: start.toDate(),
  });

  try {
    const occurrences: Date[] = [];
    let current = now.toDate();
    for (let i = 0; i < count; i++) {
      const next = rule.after(current, i === 0);
      if (!next) break;
      occurrences.push(next);
      current = next;
    }
    return occurrences;
  } catch (error) {
    console.error('RRule Error in getUpcomingOccurrences:', error);
    return [];
  }
};
