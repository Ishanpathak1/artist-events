import { EventAggregator } from '../../services/EventAggregator.js';

const aggregator = new EventAggregator();

export async function GET(context) {
  try {
    // Check for authorization (simple API key check)
    const authHeader = context.request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.SYNC_API_KEY || 'your-secret-sync-key'}`;
    
    if (authHeader !== expectedAuth) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get query parameters
    const url = new URL(context.request.url);
    const sourceId = url.searchParams.get('source');
    const fullSync = url.searchParams.get('full') === 'true';

    console.log(`🔄 Starting sync - Source: ${sourceId || 'all'}, Full: ${fullSync}`);

    let result;
    if (fullSync) {
      // Run full sync across all sources
      result = await aggregator.runFullSync();
    } else if (sourceId) {
      // Sync specific source
      result = await aggregator.syncSource(parseInt(sourceId));
    } else {
      // Default: sync all active sources
      result = await aggregator.runFullSync();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Sync completed successfully',
      timestamp: new Date().toISOString(),
      result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Sync API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(context) {
  // Handle webhook-triggered syncs
  return await GET(context);
} 