import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function GET({ request }) {
    try {
        // Get basic authentication from headers
        const authHeader = request.headers.get('authorization');
        
        // For now, simple auth check - in production you'd want proper JWT validation
        if (!authHeader && !request.headers.get('cookie')?.includes('session_token')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const client = await pool.connect();
        
        try {
            // Get comprehensive statistics
            const statsQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM events) as total_events,
                    (SELECT COUNT(*) FROM event_sources WHERE is_active = true) as active_sources,
                    (SELECT COUNT(*) FROM event_duplicates WHERE status = 'detected') as duplicates_detected,
                    (SELECT COUNT(*) FROM webhook_events WHERE processed = false) as unprocessed_webhooks,
                    (SELECT COALESCE(AVG(confidence_score), 0) FROM events WHERE confidence_score IS NOT NULL) as avg_confidence,
                    (SELECT COUNT(*) FROM sync_jobs WHERE status = 'running') as running_jobs,
                    (SELECT COUNT(*) FROM events WHERE created_at > NOW() - INTERVAL '24 hours') as events_today,
                    (SELECT COUNT(*) FROM locations) as total_locations
            `;
            
            const result = await client.query(statsQuery);
            const stats = result.rows[0];
            
            // Convert numeric strings to numbers
            const response = {
                totalEvents: parseInt(stats.total_events) || 0,
                activeSources: parseInt(stats.active_sources) || 0,
                duplicatesDetected: parseInt(stats.duplicates_detected) || 0,
                unprocessedWebhooks: parseInt(stats.unprocessed_webhooks) || 0,
                avgConfidence: parseFloat(stats.avg_confidence) || 0,
                runningJobs: parseInt(stats.running_jobs) || 0,
                eventsToday: parseInt(stats.events_today) || 0,
                totalLocations: parseInt(stats.total_locations) || 0
            };
            
            return new Response(JSON.stringify(response), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Error fetching aggregation stats:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to fetch statistics',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 