import express from 'express';
import crypto from 'crypto';
import { Pool } from 'pg';
import { EventAggregator } from './EventAggregator.js';

/**
 * Real-time Webhook Server
 * Handles incoming webhooks from various event sources
 */
export class WebhookServer {
    constructor() {
        this.app = express();
        this.port = process.env.WEBHOOK_PORT || 3001;
        
        this.pool = new Pool({
            connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        
        this.aggregator = new EventAggregator();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Raw body parser for webhook signature verification
        this.app.use('/webhook', express.raw({ type: 'application/json' }));
        
        // JSON parser for other routes
        this.app.use(express.json());
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            next();
        });

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // Eventbrite webhooks
        this.app.post('/webhook/eventbrite', async (req, res) => {
            await this.handleEventbriteWebhook(req, res);
        });

        // Facebook webhooks (Page events)
        this.app.post('/webhook/facebook', async (req, res) => {
            await this.handleFacebookWebhook(req, res);
        });

        // Meetup webhooks
        this.app.post('/webhook/meetup', async (req, res) => {
            await this.handleMeetupWebhook(req, res);
        });

        // Generic webhook endpoint
        this.app.post('/webhook/:sourceId', async (req, res) => {
            await this.handleGenericWebhook(req, res);
        });

        // Webhook management endpoints
        this.app.get('/webhook/stats', async (req, res) => {
            await this.getWebhookStats(req, res);
        });

        this.app.get('/webhook/events/unprocessed', async (req, res) => {
            await this.getUnprocessedEvents(req, res);
        });

        this.app.post('/webhook/events/:eventId/retry', async (req, res) => {
            await this.retryWebhookEvent(req, res);
        });
    }

    /**
     * Eventbrite webhook handler
     */
    async handleEventbriteWebhook(req, res) {
        try {
            const signature = req.headers['x-eventbrite-signature'];
            const sourceId = await this.getSourceIdByName('Eventbrite');
            
            if (!sourceId) {
                return res.status(404).json({ error: 'Source not found' });
            }

            const source = await this.getSourceById(sourceId);
            
            // Verify webhook signature
            if (!this.verifyEventbriteSignature(req.body, signature, source.webhook_secret)) {
                return res.status(401).json({ error: 'Invalid signature' });
            }

            // Store webhook event
            const webhookEvent = await this.storeWebhookEvent(
                sourceId,
                'eventbrite.event.updated',
                req.body,
                signature
            );

            // Process immediately for real-time updates
            await this.processWebhookEvent(webhookEvent);

            res.status(200).json({ message: 'Webhook processed successfully' });
            
        } catch (error) {
            console.error('Eventbrite webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Facebook webhook handler
     */
    async handleFacebookWebhook(req, res) {
        try {
            // Handle verification challenge
            if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
                const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;
                if (req.query['hub.verify_token'] === verifyToken) {
                    console.log('Facebook webhook verified');
                    return res.status(200).send(req.query['hub.challenge']);
                } else {
                    return res.status(403).send('Invalid verify token');
                }
            }

            const signature = req.headers['x-hub-signature-256'];
            const sourceId = await this.getSourceIdByName('Facebook Events');
            
            if (!sourceId) {
                return res.status(404).json({ error: 'Source not found' });
            }

            const source = await this.getSourceById(sourceId);
            
            // Verify webhook signature
            if (!this.verifyFacebookSignature(req.body, signature, source.webhook_secret)) {
                return res.status(401).json({ error: 'Invalid signature' });
            }

            const body = JSON.parse(req.body);
            
            // Process each entry
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field === 'events') {
                        const webhookEvent = await this.storeWebhookEvent(
                            sourceId,
                            `facebook.${change.value.verb}`,
                            change.value,
                            signature
                        );

                        await this.processWebhookEvent(webhookEvent);
                    }
                }
            }

            res.status(200).json({ message: 'Webhook processed successfully' });
            
        } catch (error) {
            console.error('Facebook webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Meetup webhook handler
     */
    async handleMeetupWebhook(req, res) {
        try {
            const signature = req.headers['x-meetup-signature'];
            const sourceId = await this.getSourceIdByName('Meetup');
            
            if (!sourceId) {
                return res.status(404).json({ error: 'Source not found' });
            }

            const source = await this.getSourceById(sourceId);
            
            // Verify webhook signature
            if (!this.verifyMeetupSignature(req.body, signature, source.webhook_secret)) {
                return res.status(401).json({ error: 'Invalid signature' });
            }

            const body = JSON.parse(req.body);
            
            const webhookEvent = await this.storeWebhookEvent(
                sourceId,
                `meetup.${body.type}`,
                body,
                signature
            );

            await this.processWebhookEvent(webhookEvent);

            res.status(200).json({ message: 'Webhook processed successfully' });
            
        } catch (error) {
            console.error('Meetup webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Generic webhook handler for custom sources
     */
    async handleGenericWebhook(req, res) {
        try {
            const sourceId = parseInt(req.params.sourceId);
            const source = await this.getSourceById(sourceId);
            
            if (!source) {
                return res.status(404).json({ error: 'Source not found' });
            }

            const signature = req.headers['x-webhook-signature'] || req.headers['signature'];
            
            // Verify signature if webhook secret is configured
            if (source.webhook_secret) {
                if (!this.verifyGenericSignature(req.body, signature, source.webhook_secret)) {
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            }

            const body = JSON.parse(req.body);
            
            const webhookEvent = await this.storeWebhookEvent(
                sourceId,
                body.type || 'generic.event',
                body,
                signature
            );

            await this.processWebhookEvent(webhookEvent);

            res.status(200).json({ message: 'Webhook processed successfully' });
            
        } catch (error) {
            console.error('Generic webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Store webhook event in database
     */
    async storeWebhookEvent(sourceId, eventType, payload, signature) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO webhook_events (source_id, event_type, payload, signature, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING *
            `, [sourceId, eventType, JSON.stringify(payload), signature]);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    /**
     * Process webhook event immediately
     */
    async processWebhookEvent(webhookEvent) {
        try {
            const source = await this.getSourceById(webhookEvent.source_id);
            const payload = JSON.parse(webhookEvent.payload);
            
            // Transform webhook payload to normalized event format
            const normalizedEvent = this.normalizeWebhookEvent(payload, source);
            
            if (normalizedEvent) {
                // Process through ML pipeline
                const processedEvents = await this.aggregator.processEventsWithML([normalizedEvent], source);
                
                // Save processed events
                for (const event of processedEvents) {
                    await this.saveOrUpdateEvent(event, source);
                }
                
                // Mark webhook as processed
                await this.markWebhookProcessed(webhookEvent.id);
                
                console.log(`Processed webhook event ${webhookEvent.id} successfully`);
            }
            
        } catch (error) {
            console.error(`Error processing webhook event ${webhookEvent.id}:`, error);
            await this.markWebhookError(webhookEvent.id, error.message);
        }
    }

    /**
     * Normalize webhook events from different sources
     */
    normalizeWebhookEvent(payload, source) {
        switch (source.name.toLowerCase()) {
            case 'eventbrite':
                return this.normalizeEventbriteWebhook(payload);
            case 'facebook events':
                return this.normalizeFacebookWebhook(payload);
            case 'meetup':
                return this.normalizeMeetupWebhook(payload);
            default:
                return this.normalizeGenericWebhook(payload);
        }
    }

    normalizeEventbriteWebhook(payload) {
        const event = payload.api_url ? payload : null;
        if (!event) return null;
        
        return {
            external_id: event.id,
            title: event.name?.text || '',
            description: event.description?.text || '',
            start_date: event.start?.utc,
            end_date: event.end?.utc,
            venue: event.venue?.name || '',
            address: event.venue?.address?.localized_address_display || '',
            external_url: event.url,
            raw_data: payload,
            source_type: 'api'
        };
    }

    normalizeFacebookWebhook(payload) {
        return {
            external_id: payload.event_id || payload.id,
            title: payload.name || '',
            description: payload.description || '',
            start_date: payload.start_time,
            end_date: payload.end_time,
            venue: payload.place?.name || '',
            address: payload.place?.location?.formatted_address || '',
            external_url: `https://facebook.com/events/${payload.event_id}`,
            raw_data: payload,
            source_type: 'webhook'
        };
    }

    normalizeMeetupWebhook(payload) {
        const event = payload.event || payload;
        
        return {
            external_id: event.id,
            title: event.name || '',
            description: event.description || '',
            start_date: event.time ? new Date(event.time).toISOString() : null,
            end_date: event.duration ? new Date(event.time + event.duration).toISOString() : null,
            venue: event.venue?.name || '',
            address: event.venue?.address_1 || '',
            external_url: event.event_url,
            raw_data: payload,
            source_type: 'webhook'
        };
    }

    normalizeGenericWebhook(payload) {
        return {
            external_id: payload.id || payload.external_id,
            title: payload.title || payload.name || '',
            description: payload.description || '',
            start_date: payload.start_date || payload.start_time,
            end_date: payload.end_date || payload.end_time,
            venue: payload.venue || payload.location?.name || '',
            address: payload.address || payload.location?.address || '',
            external_url: payload.url || payload.external_url,
            raw_data: payload,
            source_type: 'webhook'
        };
    }

    /**
     * Signature verification methods
     */
    verifyEventbriteSignature(body, signature, secret) {
        if (!signature || !secret) return false;
        
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
            
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    verifyFacebookSignature(body, signature, secret) {
        if (!signature || !secret) return false;
        
        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
            
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    verifyMeetupSignature(body, signature, secret) {
        if (!signature || !secret) return false;
        
        const expectedSignature = crypto
            .createHmac('sha1', secret)
            .update(body)
            .digest('hex');
            
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(`sha1=${expectedSignature}`)
        );
    }

    verifyGenericSignature(body, signature, secret) {
        if (!signature || !secret) return false;
        
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
            
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * Database helper methods
     */
    async getSourceIdByName(name) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT id FROM event_sources WHERE name = $1',
                [name]
            );
            return result.rows[0]?.id;
        } finally {
            client.release();
        }
    }

    async getSourceById(id) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT * FROM event_sources WHERE id = $1',
                [id]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async markWebhookProcessed(webhookEventId) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                UPDATE webhook_events 
                SET processed = true, processed_at = NOW()
                WHERE id = $1
            `, [webhookEventId]);
        } finally {
            client.release();
        }
    }

    async markWebhookError(webhookEventId, errorMessage) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                UPDATE webhook_events 
                SET error_message = $1
                WHERE id = $2
            `, [errorMessage, webhookEventId]);
        } finally {
            client.release();
        }
    }

    async saveOrUpdateEvent(event, source) {
        const client = await this.pool.connect();
        try {
            // Check if event already exists
            const existing = await client.query(`
                SELECT id FROM events 
                WHERE source_id = $1 AND external_id = $2
            `, [source.id, event.external_id]);

            if (existing.rows.length > 0) {
                // Update existing event
                await client.query(`
                    UPDATE events 
                    SET title = $1, description = $2, start_date = $3, end_date = $4,
                        venue = $5, location_id = $6, confidence_score = $7,
                        raw_data = $8, last_synced_at = NOW()
                    WHERE id = $9
                `, [
                    event.title,
                    event.description,
                    event.start_date,
                    event.end_date,
                    event.venue,
                    event.location_id,
                    event.confidence_score,
                    JSON.stringify(event.raw_data),
                    existing.rows[0].id
                ]);
            } else {
                // Create new event
                await client.query(`
                    INSERT INTO events (
                        title, description, start_date, end_date, venue,
                        source_id, external_id, external_url, location_id,
                        confidence_score, raw_data, last_synced_at, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                `, [
                    event.title,
                    event.description,
                    event.start_date,
                    event.end_date,
                    event.venue,
                    source.id,
                    event.external_id,
                    event.external_url,
                    event.location_id,
                    event.confidence_score,
                    JSON.stringify(event.raw_data)
                ]);
            }
        } finally {
            client.release();
        }
    }

    /**
     * Management endpoints
     */
    async getWebhookStats(req, res) {
        const client = await this.pool.connect();
        try {
            const stats = await client.query(`
                SELECT 
                    es.name as source_name,
                    COUNT(we.*) as total_webhooks,
                    COUNT(we.*) FILTER (WHERE we.processed = true) as processed,
                    COUNT(we.*) FILTER (WHERE we.processed = false) as pending,
                    COUNT(we.*) FILTER (WHERE we.error_message IS NOT NULL) as errors
                FROM event_sources es
                LEFT JOIN webhook_events we ON es.id = we.source_id
                WHERE es.type = 'webhook'
                GROUP BY es.id, es.name
                ORDER BY es.name
            `);

            res.json({ stats: stats.rows });
        } finally {
            client.release();
        }
    }

    async getUnprocessedEvents(req, res) {
        const client = await this.pool.connect();
        try {
            const events = await client.query(`
                SELECT we.*, es.name as source_name
                FROM webhook_events we
                JOIN event_sources es ON we.source_id = es.id
                WHERE we.processed = false
                ORDER BY we.created_at DESC
                LIMIT 100
            `);

            res.json({ events: events.rows });
        } finally {
            client.release();
        }
    }

    async retryWebhookEvent(req, res) {
        try {
            const eventId = parseInt(req.params.eventId);
            
            const client = await this.pool.connect();
            const result = await client.query(
                'SELECT * FROM webhook_events WHERE id = $1',
                [eventId]
            );
            client.release();
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Webhook event not found' });
            }

            const webhookEvent = result.rows[0];
            await this.processWebhookEvent(webhookEvent);
            
            res.json({ message: 'Webhook event reprocessed successfully' });
        } catch (error) {
            console.error('Error retrying webhook event:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Start the webhook server
     */
    start() {
        this.app.listen(this.port, () => {
            console.log(`🎣 Webhook server running on port ${this.port}`);
            console.log(`📊 Health check: http://localhost:${this.port}/health`);
            console.log(`🔗 Webhook endpoints:`);
            console.log(`  - Eventbrite: http://localhost:${this.port}/webhook/eventbrite`);
            console.log(`  - Facebook: http://localhost:${this.port}/webhook/facebook`);
            console.log(`  - Meetup: http://localhost:${this.port}/webhook/meetup`);
            console.log(`  - Generic: http://localhost:${this.port}/webhook/{sourceId}`);
        });
    }
}

export default WebhookServer; 