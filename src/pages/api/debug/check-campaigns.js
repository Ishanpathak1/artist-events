import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET({ request }) {
  try {
    // Get all email campaigns
    const campaigns = await pool.query(`
      SELECT 
        c.id,
        c.title,
        c.status,
        c.audience_type,
        c.estimated_recipients,
        c.submitted_at,
        c.reviewed_at,
        c.sent_at,
        u.email as artist_email
      FROM artist_email_campaigns c
      LEFT JOIN users u ON c.artist_id = u.id
      ORDER BY c.submitted_at DESC
    `);

    // Also check regular email_campaigns table
    const regularCampaigns = await pool.query(`
      SELECT 
        id,
        subject,
        status,
        created_at,
        sent_at
      FROM email_campaigns
      ORDER BY created_at DESC
    `).catch(() => ({ rows: [] })); // Table might not exist

    return new Response(JSON.stringify({
      success: true,
      artistCampaigns: campaigns.rows,
      regularCampaigns: regularCampaigns.rows,
      summary: {
        total: campaigns.rows.length,
        pending: campaigns.rows.filter(c => c.status === 'pending').length,
        approved: campaigns.rows.filter(c => c.status === 'approved').length,
        sent: campaigns.rows.filter(c => c.status === 'sent').length,
        rejected: campaigns.rows.filter(c => c.status === 'rejected').length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Check campaigns error:', error);
    return new Response(JSON.stringify({ 
      error: 'Database error: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 