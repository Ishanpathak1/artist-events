import { Pool } from 'pg';

// Database configuration
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

export async function GET(context) {
  try {
    const url = new URL(context.request.url);
    const campaignId = url.searchParams.get('campaign_id');
    const broadcastId = url.searchParams.get('bid'); // broadcast id from template
    const userId = url.searchParams.get('uid'); // user id from template

    // Track the open if we have valid parameters
    if (broadcastId && userId) {
      const client = await pool.connect();
      try {
        // Update broadcast open tracking
        await client.query(`
          UPDATE admin_broadcasts 
          SET opened_count = opened_count + 1 
          WHERE id = $1
        `, [broadcastId]);
        
        console.log(`📧 Email opened - Broadcast ID: ${broadcastId}, User ID: ${userId}`);
      } finally {
        client.release();
      }
    } else if (campaignId && userId) {
      // Legacy campaign tracking
      console.log(`📧 Campaign opened - Campaign ID: ${campaignId}, User ID: ${userId}`);
    }

    // Return a transparent 1x1 pixel GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    return new Response(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Email tracking error:', error);
    
    // Still return the pixel even if tracking fails
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    return new Response(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length.toString()
      }
    });
  }
} 