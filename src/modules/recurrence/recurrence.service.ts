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
  const now = dayjs.tz(dayjs(), timezone);
  const start = dayjs.tz(startAt, timezone);

  if (recurrenceType === 'once') {
    return start.isAfter(now) ? start.toDate() : null;
  }

  let freq: any;
  switch (recurrenceType) {
    case 'secondly':
      freq = RRule.SECONDLY;
      break;
    case 'minutely':
      freq = RRule.MINUTELY;
      break;
    case 'hourly':
      freq = RRule.HOURLY;
      break;
    case 'daily':
      freq = RRule.DAILY;
      break;
    case 'weekly':
      freq = RRule.WEEKLY;
      break;
    case 'monthly':
      freq = RRule.MONTHLY;
      break;
    case 'custom':
      freq = RRule.DAILY; // Default to daily if custom not fully defined
      break;
    default:
      freq = RRule.DAILY;
  }

  const rule = new RRule({
    freq,
    interval: recurrenceInterval || 1,
    dtstart: start.toDate(),
  });

  const next = rule.after(now.toDate(), false);
  return next || null;
};
