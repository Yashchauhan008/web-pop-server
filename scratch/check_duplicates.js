import Database from '../src/shared/helpers/database.helper.js';

async function checkDuplicates() {
  const db = await Database.getConnection();
  try {
    const user = await db.queryOne('SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1');
    const duplicates = await db.queryAll(
        'SELECT fcm_token, COUNT(*) FROM devices WHERE user_id = $1 GROUP BY fcm_token HAVING COUNT(*) > 1',
        [user.id]
    );
    console.log(`Checking user: ${user.email}`);
    console.log('Duplicates found:', duplicates);
    
    const allDevices = await db.queryAll('SELECT id, nickname, fcm_token FROM devices WHERE user_id = $1', [user.id]);
    console.log('All devices:', allDevices);
  } finally {
    db.release();
    process.exit();
  }
}

checkDuplicates();
