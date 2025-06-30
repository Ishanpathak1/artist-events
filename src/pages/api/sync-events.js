import { EventAggregator } from '../../services/EventAggregator.js';
// For now, let's use a simpler approach - import the fetching scripts directly
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(context) {
  try {
    console.log('🔄 Starting event sync...');

    // Get query parameters
    const url = new URL(context.request.url);
    const sourceType = url.searchParams.get('source') || 'ticketmaster';

    let result;
    
    try {
      if (sourceType === 'ticketmaster' || sourceType === 'all') {
        console.log('🎫 Syncing Ticketmaster events...');
        const { stdout, stderr } = await execAsync('node scripts/fetch-ticketmaster-events.js');
        console.log('Ticketmaster sync output:', stdout);
        if (stderr) console.error('Ticketmaster sync error:', stderr);
      }
      
      if (sourceType === 'free' || sourceType === 'all') {
        console.log('🎵 Syncing free music events...');
        const { stdout, stderr } = await execAsync('node scripts/fetch-free-music-events.js');
        console.log('Free events sync output:', stdout);
        if (stderr) console.error('Free events sync error:', stderr);
      }

      result = {
        synced_sources: sourceType === 'all' ? ['ticketmaster', 'free'] : [sourceType],
        status: 'completed'
      };

    } catch (scriptError) {
      console.error('Script execution error:', scriptError);
      // Don't fail completely, return partial success
      result = {
        error: scriptError.message,
        status: 'partial'
      };
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Sync completed',
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