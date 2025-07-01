import { EventAggregator } from '../../services/EventAggregator.js';
// For now, let's use a simpler approach - import the fetching scripts directly
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(context) {
  try {
    console.log('🔄 Starting enhanced music event sync...');

    // Get query parameters
    const url = new URL(context.request.url);
    const sourceType = url.searchParams.get('source') || 'all';

    let result;
    let syncedSources = [];
    
    try {
      // Enhanced music event sources - all legal and free!
      
      if (sourceType === 'ticketmaster' || sourceType === 'all') {
        console.log('🎫 Syncing Ticketmaster events...');
        try {
          const { stdout, stderr } = await execAsync('node scripts/fetch-ticketmaster-events.js');
          console.log('Ticketmaster sync output:', stdout);
          if (stderr) console.error('Ticketmaster sync error:', stderr);
          syncedSources.push('ticketmaster');
        } catch (err) {
          console.error('Ticketmaster sync failed:', err.message);
        }
      }
      
      if (sourceType === 'bandsintown' || sourceType === 'all') {
        console.log('🎤 Syncing Bandsintown events...');
        try {
          const { stdout, stderr } = await execAsync('node scripts/fetch-bandsintown-events.js');
          console.log('Bandsintown sync output:', stdout);
          if (stderr) console.error('Bandsintown sync error:', stderr);
          syncedSources.push('bandsintown');
        } catch (err) {
          console.error('Bandsintown sync failed:', err.message);
        }
      }
      
      if (sourceType === 'lastfm' || sourceType === 'all') {
        console.log('🎧 Syncing Last.fm events...');
        try {
          const { stdout, stderr } = await execAsync('node scripts/fetch-lastfm-events.js');
          console.log('Last.fm sync output:', stdout);
          if (stderr) console.error('Last.fm sync error:', stderr);
          syncedSources.push('lastfm');
        } catch (err) {
          console.error('Last.fm sync failed:', err.message);
        }
      }
      
      if (sourceType === 'public' || sourceType === 'all') {
        console.log('🎪 Syncing curated public music events...');
        try {
          const { stdout, stderr } = await execAsync('node scripts/fetch-public-music-events.js');
          console.log('Public events sync output:', stdout);
          if (stderr) console.error('Public events sync error:', stderr);
          syncedSources.push('public-venues');
        } catch (err) {
          console.error('Public events sync failed:', err.message);
        }
      }
      
      if (sourceType === 'free' || sourceType === 'all') {
        console.log('🎵 Syncing free music events...');
        try {
          const { stdout, stderr } = await execAsync('node scripts/fetch-free-music-events.js');
          console.log('Free events sync output:', stdout);
          if (stderr) console.error('Free events sync error:', stderr);
          syncedSources.push('free-events');
        } catch (err) {
          console.error('Free events sync failed:', err.message);
        }
      }

      result = {
        synced_sources: syncedSources,
        total_sources: syncedSources.length,
        status: syncedSources.length > 0 ? 'completed' : 'partial',
        message: `Successfully synced ${syncedSources.length} music event sources`
      };

    } catch (scriptError) {
      console.error('Script execution error:', scriptError);
      result = {
        error: scriptError.message,
        synced_sources: syncedSources,
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