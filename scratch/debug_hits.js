import Database from '../src/shared/helpers/database.helper.js';
import dayjs from 'dayjs';

async function checkHits() {
  const db = await Database.getConnection();
  try {
    const user = await db.queryOne('SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1');
    const reminders = await db.queryAll(
        'SELECT id, title, recurrence_type, recurrence_interval, next_trigger_at FROM reminders WHERE user_id = $1 AND is_paused = false AND next_trigger_at IS NOT NULL',
        [user.id]
    );
    
    let totalUpcomingHits = 0;
    const now = dayjs();
    const future24h = now.add(24, 'hour');

    console.log('Now:', now.format());
    console.log('Future 24h:', future24h.format());

    for (const r of reminders) {
        let hits = 0;
        const next = dayjs(r.next_trigger_at);
        if (next.isAfter(future24h)) {
            console.log(`- ${r.title}: Next trigger is after 24h (${next.format()})`);
            continue;
        }

        if (r.recurrence_type === 'once') {
            hits = 1;
        } else if (r.recurrence_type === 'secondly') {
            const secondsLeft = future24h.diff(next, 'second');
            hits = Math.floor(secondsLeft / (r.recurrence_interval || 1)) + 1;
        } else if (r.recurrence_type === 'minutely') {
            const minsLeft = future24h.diff(next, 'minute');
            hits = Math.floor(minsLeft / (r.recurrence_interval || 1)) + 1;
        } else if (r.recurrence_type === 'hourly') {
            const hoursLeft = future24h.diff(next, 'hour');
            hits = Math.floor(hoursLeft / (r.recurrence_interval || 1)) + 1;
        } else {
            hits = 1;
        }
        console.log(`- ${r.title}: ${r.recurrence_type} every ${r.recurrence_interval}, Hits in 24h: ${hits} (Next: ${next.format()})`);
        totalUpcomingHits += hits;
    }
    console.log('\nTOTAL UPCOMING HITS:', totalUpcomingHits);
  } finally {
    db.release();
    process.exit();
  }
}

checkHits();
