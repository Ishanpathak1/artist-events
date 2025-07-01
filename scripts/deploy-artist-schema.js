import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployArtistSchema() {
  console.log('🚀 Deploying Artist Subscriptions Schema...');
  
  // Use the same database config as other working files
  const DB_CONFIG = (() => {
    if (process.env.NEON_DATABASE_URL) {
      return {
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      };
    }
    
    if (process.env.DATABASE_URL) {
      return {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      };
    }
    
    return {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'artist_events',
      user: process.env.DB_USER || 'ishanpathak',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  })();
  
  const pool = new Pool(DB_CONFIG);

  try {
    const schemaPath = path.join(__dirname, '../database/artist-subscriptions-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    const client = await pool.connect();
    
    console.log('📦 Creating tables...');
    await client.query(schema);
    
    console.log('✅ Artist subscriptions schema deployed successfully!');
    console.log('');
    console.log('📊 Tables created:');
    console.log('  • artist_subscriptions - Fan subscription to artists');
    console.log('  • artist_email_campaigns - Email campaigns with approval workflow');
    console.log('  • artist_campaign_recipients - Email delivery tracking');
    console.log('  • campaign_approval_history - Admin approval history');
    console.log('');
    console.log('🎉 You can now visit /admin/review-campaigns to review artist email campaigns!');
    
    client.release();
  } catch (error) {
    console.error('❌ Schema deployment failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('✅ Tables already exist - schema is up to date!');
    }
  } finally {
    await pool.end();
  }
}

deployArtistSchema().catch(console.error); 