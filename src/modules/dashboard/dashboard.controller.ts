import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import dayjs from 'dayjs';

export const getStats = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;

  // 1. Total Dispatches
  const dispatchesCount = await db.queryOne(
    'SELECT COUNT(*) as count FROM notification_logs WHERE user_id = $1',
    [user.id]
  );

  // 2. Active Reminders
  const activeCount = await db.queryOne(
    'SELECT COUNT(*) as count FROM reminders WHERE user_id = $1 AND is_paused = false',
    [user.id]
  );

  // 3. Total Upcoming Signals (Hits) in next 24h
  const reminders = await db.queryAll(
    'SELECT recurrence_type, recurrence_interval, next_trigger_at, timezone FROM reminders WHERE user_id = $1 AND is_paused = false AND next_trigger_at IS NOT NULL',
    [user.id]
  );

  let totalUpcomingHits = 0;
  const now = dayjs();
  const future24h = now.add(24, 'hour');

  console.log(`[Stats Debug] User: ${user.email}, Reminders found: ${reminders.length}`);

  for (const r of reminders) {
    const next = dayjs(r.next_trigger_at);
    if (next.isAfter(future24h)) continue;

    let hits = 0;
    const interval = Math.max(1, r.recurrence_interval || 1);

    if (r.recurrence_type === 'once') {
      hits = 1;
    } else if (r.recurrence_type === 'secondly') {
      const secondsLeft = future24h.diff(next, 'second');
      hits = Math.floor(secondsLeft / interval) + 1;
    } else if (r.recurrence_type === 'minutely') {
      const minsLeft = future24h.diff(next, 'minute');
      hits = Math.floor(minsLeft / interval) + 1;
    } else if (r.recurrence_type === 'hourly') {
      const hoursLeft = future24h.diff(next, 'hour');
      hits = Math.floor(hoursLeft / interval) + 1;
    } else if (r.recurrence_type === 'daily') {
      const daysLeft = future24h.diff(next, 'day');
      hits = Math.floor(daysLeft / interval) + 1;
    } else {
      hits = 1;
    }
    
    totalUpcomingHits += hits;
    console.log(`[Stats Debug] Reminder: ${r.recurrence_type}, Interval: ${interval}, Hits: ${hits}`);
  }
  
  console.log(`[Stats Debug] Final totalUpcomingHits: ${totalUpcomingHits}`);

  // 4. Linked Devices
  const devicesCount = await db.queryOne(
    'SELECT COUNT(*) as count FROM devices WHERE user_id = $1',
    [user.id]
  );

  // 5. Activity Chart (Last 7 days)
  const activityData = await db.queryAll(`
    WITH days AS (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT 
      to_char(days.day, 'Mon DD') as name,
      COUNT(nl.id) as triggers
    FROM days
    LEFT JOIN notification_logs nl ON nl.sent_at::date = days.day AND nl.user_id = $1
    GROUP BY days.day
    ORDER BY days.day ASC
  `, [user.id]);

  // 6. Reliability (Success vs Failed)
  const reliability = await db.queryAll(`
    SELECT 
      status,
      COUNT(*) as value
    FROM notification_logs
    WHERE user_id = $1
    GROUP BY status
  `, [user.id]);

  // 7. Pattern Distribution
  const distribution = await db.queryAll(`
    SELECT 
      recurrence_type as name,
      COUNT(*) as value
    FROM reminders
    WHERE user_id = $1
    GROUP BY recurrence_type
  `, [user.id]);

  res.json({
    success: true,
    data: {
      stats: {
        activeFleet: parseInt(activeCount.count),
        totalDispatches: parseInt(dispatchesCount.count),
        upcoming24h: totalUpcomingHits,
        linkedNodes: parseInt(devicesCount.count)
      },
      activity: activityData.map(d => ({ ...d, triggers: parseInt(d.triggers) })),
      reliability: reliability.map(r => ({ 
        name: r.status === 'sent' ? 'Success' : 'Failed', 
        value: parseInt(r.value) 
      })),
      distribution: distribution.map(d => ({
        name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
        value: parseInt(d.value)
      }))
    }
  });
};
