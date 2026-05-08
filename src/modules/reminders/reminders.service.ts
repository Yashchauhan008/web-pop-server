import pkg from 'rrule';
const { RRule } = pkg;
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

interface RecurrenceParams {
  startAt: Date;
  recurrenceType: string;
  recurrenceInterval?: number;
  timezone: string;
}

export class RemindersService {
  /**
   * Calculates the next trigger time based on recurrence rules.
   */
  static calculateNextTrigger(params: RecurrenceParams): Date | null {
    const { startAt, recurrenceType, recurrenceInterval, timezone } = params;
    const now = dayjs.tz(dayjs(), timezone);
    const start = dayjs.tz(startAt, timezone);

    if (recurrenceType === 'once') {
      return start.isAfter(now) ? start.toDate() : null;
    }

    const freq = this.getFrequency(recurrenceType);
    if (freq === null) return null;

    const rule = new RRule({
      freq,
      interval: recurrenceInterval || 1,
      dtstart: start.toDate(),
    });

    const next = rule.after(now.toDate(), false);
    return next || null;
  }

  /**
   * Returns a list of the next N trigger times for previewing.
   */
  static getUpcomingOccurrences(params: RecurrenceParams, count: number = 5): Date[] {
    const { startAt, recurrenceType, recurrenceInterval, timezone } = params;
    const now = dayjs.tz(dayjs(), timezone);
    const start = dayjs.tz(startAt, timezone);

    if (recurrenceType === 'once') {
      return start.isAfter(now) ? [start.toDate()] : [];
    }

    const freq = this.getFrequency(recurrenceType);
    if (freq === null) return [];

    const rule = new RRule({
      freq,
      interval: recurrenceInterval || 1,
      dtstart: start.toDate(),
    });

    return rule.between(now.toDate(), dayjs(now).add(1, 'year').toDate(), true).slice(0, count);
  }

  private static getFrequency(type: string): any {
    switch (type) {
      case 'secondly': return RRule.SECONDLY;
      case 'minutely': return RRule.MINUTELY;
      case 'hourly': return RRule.HOURLY;
      case 'daily': return RRule.DAILY;
      case 'weekly': return RRule.WEEKLY;
      case 'monthly': return RRule.MONTHLY;
      case 'yearly': return RRule.YEARLY;
      default: return null;
    }
  }
}
