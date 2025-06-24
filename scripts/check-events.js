import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkEvents() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT title, source_type, event_type, start_date, custom_location 
      FROM events 
      ORDER BY created_at DESC 
      LIMIT 15
    `);
    
    console.log('📊 Current events in database:');
    result.rows.forEach((event, i) => {
      const date = new Date(event.start_date).toLocaleDateString();
      console.log(`${i+1}. ${event.title}`);
      console.log(`   Type: ${event.event_type} | Source: ${event.source_type} | Date: ${date}`);
      console.log(`   Location: ${event.custom_location || 'TBA'}`);
      console.log('');
    });
    
    const totalResult = await client.query('SELECT COUNT(*) FROM events');
    console.log(`🎵 Total events: ${totalResult.rows[0].count}`);
    
    const sourceBreakdown = await client.query(`
      SELECT source_type, COUNT(*) as count 
      FROM events 
      GROUP BY source_type 
      ORDER BY count DESC
    `);
    
    console.log('\n📈 Events by source:');
    sourceBreakdown.rows.forEach(row => {
      console.log(`  ${row.source_type}: ${row.count} events`);
    });
    
  } finally {
    client.release();
    process.exit(0);
  }
}

checkEvents().catch(console.error); 