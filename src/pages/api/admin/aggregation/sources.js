import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function GET({ request }) {
    try {
        // Basic auth check
        if (!request.headers.get('authorization') && !request.headers.get('cookie')?.includes('session_token')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const client = await pool.connect();
        
        try {
            const sourcesQuery = `
                SELECT 
                    es.*,
                    COUNT(e.id) as event_count
                FROM event_sources es
                LEFT JOIN events e ON e.source_id = es.id
                GROUP BY es.id
                ORDER BY es.created_at DESC
            `;
            
            const result = await client.query(sourcesQuery);
            
            const sources = result.rows.map(source => ({
                ...source,
                event_count: parseInt(source.event_count) || 0,
                config: typeof source.config === 'string' ? JSON.parse(source.config) : source.config
            }));
            
            return new Response(JSON.stringify(sources), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Error fetching event sources:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to fetch event sources',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST({ request }) {
    try {
        // Basic auth check
        if (!request.headers.get('authorization') && !request.headers.get('cookie')?.includes('session_token')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await request.json();
        const { name, type, base_url, sync_frequency, config } = data;
        
        if (!name || !type) {
            return new Response(JSON.stringify({ error: 'Name and type are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const client = await pool.connect();
        
        try {
            const insertQuery = `
                INSERT INTO event_sources (name, type, base_url, sync_frequency, config, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
            `;
            
            const result = await client.query(insertQuery, [
                name,
                type,
                base_url || null,
                sync_frequency || 60,
                JSON.stringify(config || {})
            ]);
            
            return new Response(JSON.stringify(result.rows[0]), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            });
            
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('Error creating event source:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to create event source',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 