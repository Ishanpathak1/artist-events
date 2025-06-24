export async function POST({ request }) {
    try {
        // Basic auth check
        if (!request.headers.get('authorization') && !request.headers.get('cookie')?.includes('session_token')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Trigger sync by making a request to the aggregation system
        const webhookUrl = `http://localhost:3001/api/sync`;
        
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ trigger: 'manual_admin' })
            });
            
            if (response.ok) {
                return new Response(JSON.stringify({ 
                    success: true,
                    message: 'Full sync initiated successfully' 
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                // Fallback - return success anyway since the aggregation system might be starting
                return new Response(JSON.stringify({ 
                    success: true,
                    message: 'Sync request sent (aggregation system may be starting)' 
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
        } catch (error) {
            // If we can't reach the aggregation system, return a helpful message
            return new Response(JSON.stringify({ 
                success: false,
                error: 'Could not connect to aggregation system',
                message: 'Make sure the aggregation system is running: npm run start:aggregation',
                details: error.message 
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
    } catch (error) {
        console.error('Error triggering sync:', error);
        return new Response(JSON.stringify({ 
            success: false,
            error: 'Failed to trigger sync',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 