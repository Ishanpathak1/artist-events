#!/usr/bin/env node

/**
 * Advanced Event Aggregation System
 * Main entry point that starts all components
 */

import dotenv from 'dotenv';
dotenv.config();

import { EventAggregator } from '../src/services/EventAggregator.js';
import WebhookServer from '../src/services/WebhookServer.js';
import LocationIntelligence from '../src/services/LocationIntelligence.js';
import cron from 'node-cron';
import { Pool } from 'pg';

class AggregationSystemManager {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });

        this.aggregator = new EventAggregator();
        this.webhookServer = new WebhookServer();
        this.locationIntelligence = new LocationIntelligence();
        
        this.isRunning = false;
        this.scheduledJobs = new Map();
    }

    /**
     * Start the complete aggregation system
     */
    async start() {
        console.log('🚀 Starting Advanced Event Aggregation System...');
        
        try {
            // Initialize database schema if needed
            await this.initializeDatabase();
            
            // Start webhook server
            this.webhookServer.start();
            
            // Start scheduled sync jobs
            await this.startScheduledJobs();
            
            // Start ML model training scheduler
            this.startMLScheduler();
            
            // Start cleanup scheduler
            this.startCleanupScheduler();
            
            this.isRunning = true;
            
            console.log('✅ Event Aggregation System started successfully!');
            console.log('📊 Dashboard: http://localhost:3000/admin/aggregation');
            console.log('🎣 Webhooks: http://localhost:3001/health');
            
            // Handle graceful shutdown
            process.on('SIGINT', () => this.shutdown());
            process.on('SIGTERM', () => this.shutdown());
            
        } catch (error) {
            console.error('❌ Failed to start aggregation system:', error);
            process.exit(1);
        }
    }

    /**
     * Initialize database schema and seed data
     */
    async initializeDatabase() {
        console.log('🔧 Initializing database...');
        
        const client = await this.pool.connect();
        try {
            // Check if the extended schema exists properly
            const tableCheck = await client.query(`
                SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'event_sources'
                ORDER BY table_name, ordinal_position
            `);
            
            console.log('📋 Current event_sources columns:', tableCheck.rows.map(r => r.column_name));
            
            // Check if we need to create/update the schema
            const requiredColumns = ['type', 'base_url', 'sync_frequency', 'config'];
            const existingColumns = tableCheck.rows.map(r => r.column_name);
            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
            
            if (tableCheck.rows.length === 0 || missingColumns.length > 0) {
                console.log('🗄️  Setting up aggregation schema...');
                
                if (missingColumns.length > 0) {
                    console.log('🔧 Missing columns:', missingColumns);
                    // Drop and recreate the table if it exists but is incomplete
                    await client.query('DROP TABLE IF EXISTS event_sources CASCADE');
                    console.log('🗑️  Dropped incomplete event_sources table');
                }
                
                // Read and execute schema file
                const fs = await import('fs');
                const schemaPath = new URL('../database/event-aggregator-schema.sql', import.meta.url);
                const schema = fs.readFileSync(schemaPath, 'utf8');
                
                await client.query(schema);
                console.log('✅ Database schema initialized');
            } else {
                console.log('✅ Database schema already exists and is complete');
            }
            
        } catch (error) {
            console.error('❌ Database initialization error:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Start scheduled synchronization jobs
     */
    async startScheduledJobs() {
        console.log('⏰ Starting scheduled sync jobs...');
        
        // Get all active sources
        const client = await this.pool.connect();
        const sources = await client.query(`
            SELECT * FROM event_sources 
            WHERE is_active = true 
            AND type IN ('api', 'scraper')
        `);
        client.release();

        for (const source of sources.rows) {
            const cronPattern = this.getCronPattern(source.sync_frequency);
            
            const job = cron.schedule(cronPattern, async () => {
                console.log(`🔄 Running sync for: ${source.name}`);
                try {
                    await this.aggregator.syncSource(source.id);
                } catch (error) {
                    console.error(`❌ Sync failed for ${source.name}:`, error);
                }
            }, {
                scheduled: true,
                timezone: "UTC"
            });

            this.scheduledJobs.set(source.id, job);
            console.log(`✅ Scheduled sync for ${source.name} (every ${source.sync_frequency} minutes)`);
        }

        // Full system sync every 6 hours
        const fullSyncJob = cron.schedule('0 */6 * * *', async () => {
            console.log('🌍 Running full system sync...');
            try {
                await this.aggregator.runFullSync();
            } catch (error) {
                console.error('❌ Full sync failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        this.scheduledJobs.set('full_sync', fullSyncJob);
    }

    /**
     * Start ML model training scheduler
     */
    startMLScheduler() {
        console.log('🤖 Starting ML training scheduler...');
        
        // Retrain deduplication model daily at 2 AM
        const dedupTrainingJob = cron.schedule('0 2 * * *', async () => {
            console.log('🧠 Training deduplication model...');
            try {
                await this.aggregator.trainDeduplicationModel();
            } catch (error) {
                console.error('❌ Deduplication model training failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        // Retrain categorization model weekly on Sunday at 3 AM
        const catTrainingJob = cron.schedule('0 3 * * 0', async () => {
            console.log('🏷️  Training categorization model...');
            try {
                await this.aggregator.trainCategorizationModel();
            } catch (error) {
                console.error('❌ Categorization model training failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        this.scheduledJobs.set('dedup_training', dedupTrainingJob);
        this.scheduledJobs.set('cat_training', catTrainingJob);
    }

    /**
     * Start cleanup scheduler
     */
    startCleanupScheduler() {
        console.log('🧹 Starting cleanup scheduler...');
        
        // Clean up old webhook events daily at 1 AM
        const cleanupJob = cron.schedule('0 1 * * *', async () => {
            console.log('🗑️  Cleaning up old data...');
            try {
                await this.cleanupOldData();
            } catch (error) {
                console.error('❌ Cleanup failed:', error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        this.scheduledJobs.set('cleanup', cleanupJob);
    }

    /**
     * Convert sync frequency (minutes) to cron pattern
     */
    getCronPattern(frequencyMinutes) {
        if (frequencyMinutes <= 5) {
            return '*/5 * * * *'; // Every 5 minutes (minimum)
        } else if (frequencyMinutes <= 15) {
            return '*/15 * * * *'; // Every 15 minutes
        } else if (frequencyMinutes <= 30) {
            return '*/30 * * * *'; // Every 30 minutes
        } else if (frequencyMinutes <= 60) {
            return '0 * * * *'; // Every hour
        } else if (frequencyMinutes <= 120) {
            return '0 */2 * * *'; // Every 2 hours
        } else {
            return '0 */6 * * *'; // Every 6 hours (maximum)
        }
    }

    /**
     * Clean up old data
     */
    async cleanupOldData() {
        const client = await this.pool.connect();
        try {
            // Remove webhook events older than 30 days
            await client.query(`
                DELETE FROM webhook_events 
                WHERE created_at < NOW() - INTERVAL '30 days'
            `);

            // Remove duplicate detection records older than 60 days
            await client.query(`
                DELETE FROM duplicate_events 
                WHERE detected_at < NOW() - INTERVAL '60 days'
                AND status IN ('rejected', 'confirmed')
            `);

            // Remove sync job logs older than 7 days
            await client.query(`
                DELETE FROM sync_jobs 
                WHERE created_at < NOW() - INTERVAL '7 days'
                AND status IN ('completed', 'failed')
            `);

            console.log('✅ Data cleanup completed');
        } finally {
            client.release();
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down aggregation system...');
        
        this.isRunning = false;
        
        // Stop all scheduled jobs
        for (const [name, job] of this.scheduledJobs) {
            job.destroy();
            console.log(`✅ Stopped job: ${name}`);
        }
        
        // Close database connections
        await this.pool.end();
        
        console.log('✅ Aggregation system shut down gracefully');
        process.exit(0);
    }

    /**
     * Get system status
     */
    async getStatus() {
        const client = await this.pool.connect();
        try {
            const stats = await client.query(`
                SELECT 
                    (SELECT COUNT(*) FROM events) as total_events,
                    (SELECT COUNT(*) FROM event_sources WHERE is_active = true) as active_sources,
                    (SELECT COUNT(*) FROM duplicate_events WHERE status = 'detected') as pending_duplicates,
                    (SELECT COUNT(*) FROM webhook_events WHERE processed = false) as unprocessed_webhooks,
                    (SELECT AVG(confidence_score) FROM events WHERE confidence_score IS NOT NULL) as avg_confidence
            `);

            return {
                running: this.isRunning,
                stats: stats.rows[0],
                active_jobs: this.scheduledJobs.size
            };
        } finally {
            client.release();
        }
    }
}

// Start the system if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const manager = new AggregationSystemManager();
    
    // Handle CLI commands
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            await manager.start();
            break;
            
        case 'status':
            const status = await manager.getStatus();
            console.log('📊 System Status:', JSON.stringify(status, null, 2));
            process.exit(0);
            break;
            
        case 'sync':
            const sourceId = process.argv[3];
            if (sourceId) {
                console.log(`🔄 Running sync for source ${sourceId}...`);
                await manager.aggregator.syncSource(parseInt(sourceId));
            } else {
                console.log('🌍 Running full sync...');
                await manager.aggregator.runFullSync();
            }
            process.exit(0);
            break;
            
        case 'train':
            console.log('🤖 Training ML models...');
            await manager.aggregator.trainDeduplicationModel();
            await manager.aggregator.trainCategorizationModel();
            process.exit(0);
            break;
            
        default:
            console.log(`
🎯 Advanced Event Aggregation System

Usage:
  node scripts/start-aggregation-system.js <command>

Commands:
  start                 Start the full aggregation system
  status                Show system status
  sync [source_id]      Run sync (all sources or specific source)
  train                 Train ML models

Environment Variables:
  NEON_DATABASE_URL          Database connection string
  WEBHOOK_PORT              Webhook server port (default: 3001)
  GOOGLE_MAPS_API_KEY       Google Maps API key for geocoding
  MAPBOX_API_KEY            Mapbox API key for geocoding
  FACEBOOK_VERIFY_TOKEN     Facebook webhook verification token
  EVENTBRITE_API_KEY        Eventbrite API key
  MEETUP_API_KEY            Meetup API key

Examples:
  npm run start:aggregation     # Start the system
  npm run aggregation:sync      # Run full sync
  npm run aggregation:status    # Check status
            `);
            process.exit(0);
    }
}

export default AggregationSystemManager; 