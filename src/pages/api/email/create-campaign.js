import { Pool } from 'pg';
import { authenticateUser } from '../../../../lib/auth-middleware.js';

// Database connection
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
  'postgresql://ishanpathak@localhost:5432/artist_events';

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function POST(context) {
  try {
    // Check authentication
    const authResult = await authenticateUser(context.request);
    if (!authResult.user) {
      return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = authResult.user;
    const body = await context.request.json();
    
    // Validate required fields
    const { template_id, subject, target_audience = 'all' } = body;
    
    if (!template_id || !subject) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Template ID and subject are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = await pool.connect();
    
    try {
      // Verify template exists
      const templateResult = await client.query(
        'SELECT * FROM email_templates WHERE id = $1 AND is_active = true',
        [template_id]
      );
      
      if (templateResult.rows.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Template not found' 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const template = templateResult.rows[0];
      
      // Process template variables from form data
      const templateVariables = JSON.parse(template.variables || '[]');
      const variableData = {};
      
      // Extract variables from body
      templateVariables.forEach(variable => {
        if (body[variable]) {
          variableData[variable] = body[variable];
        }
      });
      
      // Add artist information
      variableData.artist_name = body.artist_name || `${user.first_name} ${user.last_name}`;
      
      // Set up audience filter
      let audienceFilter = {};
      if (target_audience === 'city_based' && body.city_filter) {
        audienceFilter.city = body.city_filter;
      }

      // Process template content with variables
      let processedContent = template.html_content;
      Object.entries(variableData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processedContent = processedContent.replace(regex, value || '');
      });

      // Insert campaign into database
      const campaignResult = await client.query(`
        INSERT INTO email_campaigns (
          artist_id, template_id, subject, content, raw_content,
          status, target_audience, audience_filter, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `, [
        user.id,
        template_id,
        subject.trim(),
        processedContent,
        JSON.stringify(variableData),
        'pending', // Submit directly for review
        target_audience,
        JSON.stringify(audienceFilter)
      ]);

      const campaignId = campaignResult.rows[0].id;

      return new Response(JSON.stringify({
        success: true,
        message: 'Campaign created and submitted for review',
        campaignId: campaignId
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create campaign error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to create campaign'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 