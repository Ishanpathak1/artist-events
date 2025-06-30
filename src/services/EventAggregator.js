import { Pool } from 'pg';
import crypto from 'crypto';

/**
 * Advanced Event Aggregation Service
 * Handles multi-source event collection with ML-based deduplication
 */
export class EventAggregator {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        
        // ML models will be loaded here
        this.deduplicationModel = null;
        this.locationModel = null;
        this.categorizationModel = null;
        
        // Rate limiting and caching
        this.rateLimiter = new Map();
        this.cache = new Map();
    }

    /**
     * Main aggregation pipeline
     */
    async aggregateEvents(sourceId = null) {
        const client = await this.pool.connect();
        try {
            // Get active sources
            const sources = await this.getActiveSources(sourceId);
            
            for (const source of sources) {
                await this.processEventSource(source);
            }
        } finally {
            client.release();
        }
    }

    /**
     * Process events from a specific source
     */
    async processEventSource(source) {
        console.log(`Processing events from source: ${source.name}`);
        
        // Check rate limiting
        if (!this.checkRateLimit(source)) {
            console.log(`Rate limit exceeded for source: ${source.name}`);
            return;
        }

        try {
            // Create sync job
            const jobId = await this.createSyncJob(source.id, 'incremental');
            
            // Fetch events based on source type
            let rawEvents = [];
            switch (source.type) {
                case 'api':
                    rawEvents = await this.fetchFromAPI(source);
                    break;
                case 'webhook':
                    rawEvents = await this.processWebhookEvents(source);
                    break;
                case 'scraper':
                    rawEvents = await this.scrapeEvents(source);
                    break;
                default:
                    console.log(`Unsupported source type: ${source.type}`);
                    return;
            }

            // Process each event through the ML pipeline
            const processedEvents = await this.processEventsWithML(rawEvents, source);
            
            // Save processed events
            const results = await this.saveProcessedEvents(processedEvents, source);
            
            // Update sync job
            await this.updateSyncJob(jobId, 'completed', results);
            
            console.log(`Completed processing ${rawEvents.length} events from ${source.name}`);
            
        } catch (error) {
            console.error(`Error processing source ${source.name}:`, error);
            await this.updateSyncJob(jobId, 'failed', { error: error.message });
        }
    }

    /**
     * ML-powered event processing pipeline
     */
    async processEventsWithML(rawEvents, source) {
        const processedEvents = [];
        
        for (const rawEvent of rawEvents) {
            try {
                // 1. Extract and normalize event data
                const normalizedEvent = await this.normalizeEventData(rawEvent, source);
                
                // 2. Location intelligence
                const location = await this.extractLocationIntelligence(normalizedEvent);
                if (location) {
                    normalizedEvent.location_id = location.id;
                }
                
                // 3. Category classification
                const category = await this.classifyEventCategory(normalizedEvent);
                normalizedEvent.category = category;
                
                // 4. Generate feature vectors for ML
                const features = await this.generateEventFeatures(normalizedEvent);
                normalizedEvent.features = features;
                
                // 5. Check for duplicates using ML
                const duplicateInfo = await this.detectDuplicates(normalizedEvent);
                normalizedEvent.duplicate_info = duplicateInfo;
                
                // 6. Calculate confidence score
                normalizedEvent.confidence_score = await this.calculateConfidenceScore(normalizedEvent);
                
                processedEvents.push(normalizedEvent);
                
            } catch (error) {
                console.error(`Error processing event ${rawEvent.id}:`, error);
            }
        }
        
        return processedEvents;
    }

    /**
     * ML-based duplicate detection
     */
    async detectDuplicates(event) {
        const client = await this.pool.connect();
        try {
            // Get potential duplicates based on time and location proximity
            const candidates = await client.query(`
                SELECT e.*, ef.title_vector, ef.description_vector, ef.location_vector
                FROM events e
                LEFT JOIN event_features ef ON e.id = ef.event_id
                WHERE e.start_date BETWEEN $1 AND $2
                AND ST_DWithin(
                    ST_Point($3, $4)::geography,
                    ST_Point(l.longitude, l.latitude)::geography,
                    5000  -- 5km radius
                )
                AND e.id != $5
            `, [
                event.start_date,
                event.end_date,
                event.longitude,
                event.latitude,
                event.id
            ]);

            const duplicates = [];
            for (const candidate of candidates.rows) {
                const similarity = await this.calculateEventSimilarity(event, candidate);
                
                if (similarity.score > 0.8) {  // High similarity threshold
                    duplicates.push({
                        event_id: candidate.id,
                        similarity_score: similarity.score,
                        matched_fields: similarity.matched_fields,
                        detection_method: 'ml'
                    });
                }
            }

            return duplicates;
        } finally {
            client.release();
        }
    }

    /**
     * Calculate similarity between two events using ML
     */
    async calculateEventSimilarity(event1, event2) {
        // Title similarity (using embeddings)
        const titleSim = await this.cosineSimilarity(
            event1.features.title_vector,
            event2.features.title_vector
        );
        
        // Description similarity
        const descSim = await this.cosineSimilarity(
            event1.features.description_vector,
            event2.features.description_vector
        );
        
        // Location proximity
        const locationSim = this.calculateLocationSimilarity(event1, event2);
        
        // Time proximity
        const timeSim = this.calculateTimeSimilarity(event1, event2);
        
        // Weighted combination
        const overallScore = (
            titleSim * 0.4 +
            descSim * 0.3 +
            locationSim * 0.2 +
            timeSim * 0.1
        );
        
        return {
            score: overallScore,
            matched_fields: {
                title: titleSim,
                description: descSim,
                location: locationSim,
                time: timeSim
            }
        };
    }

    /**
     * Location intelligence with geocoding and venue matching
     */
    async extractLocationIntelligence(event) {
        const client = await this.pool.connect();
        try {
            // Check if we already have this location
            let location = await this.findExistingLocation(event.venue, event.address);
            
            if (!location) {
                // Geocode the address
                const geoData = await this.geocodeAddress(event.address);
                
                // Create new location record
                location = await client.query(`
                    INSERT INTO locations (
                        name, address, city, state, country, postal_code,
                        latitude, longitude, timezone, venue_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING *
                `, [
                    event.venue,
                    event.address,
                    geoData.city,
                    geoData.state,
                    geoData.country,
                    geoData.postal_code,
                    geoData.latitude,
                    geoData.longitude,
                    geoData.timezone,
                    await this.classifyVenueType(event.venue, event.description)
                ]);
                
                location = location.rows[0];
            }
            
            return location;
        } finally {
            client.release();
        }
    }

    /**
     * Generate ML feature vectors for an event
     */
    async generateEventFeatures(event) {
        // This would integrate with actual ML models
        // For now, we'll create placeholder feature vectors
        
        return {
            title_vector: await this.generateTextEmbedding(event.title),
            description_vector: await this.generateTextEmbedding(event.description),
            location_vector: await this.generateLocationEmbedding(event.venue, event.address),
            time_features: this.extractTimeFeatures(event.start_date, event.end_date),
            text_features: this.extractTextFeatures(event.title + ' ' + event.description)
        };
    }

    /**
     * API integrations for different sources
     */
    async fetchFromAPI(source) {
        switch (source.name.toLowerCase()) {
            case 'eventbrite':
                return await this.fetchEventbriteEvents(source);
            case 'facebook events':
                return await this.fetchFacebookEvents(source);
            case 'meetup':
                return await this.fetchMeetupEvents(source);
            default:
                throw new Error(`Unknown API source: ${source.name}`);
        }
    }

    async fetchEventbriteEvents(source) {
        const config = source.config;
        const apiKey = await this.decryptApiKey(source.api_key_encrypted);
        
        const response = await fetch(`${source.base_url}/events/search/?token=${apiKey}&location.within=50km&location.latitude=37.7749&location.longitude=-122.4194&expand=venue,organizer&sort_by=date`);
        
        if (!response.ok) {
            throw new Error(`Eventbrite API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.events.map(this.normalizeEventbriteEvent);
    }

    async fetchFacebookEvents(source) {
        // Facebook Events API integration
        // Note: Facebook has restricted public event access
        const config = source.config;
        const accessToken = await this.decryptApiKey(source.api_key_encrypted);
        
        // This would require special permissions and app review
        const response = await fetch(`${source.base_url}/events?access_token=${accessToken}`);
        
        if (!response.ok) {
            throw new Error(`Facebook API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data.map(this.normalizeFacebookEvent);
    }

    async fetchMeetupEvents(source) {
        const config = source.config;
        const apiKey = await this.decryptApiKey(source.api_key_encrypted);
        
        const response = await fetch(`${source.base_url}/find/upcoming_events?key=${apiKey}&lat=37.7749&lon=-122.4194&radius=50`);
        
        if (!response.ok) {
            throw new Error(`Meetup API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.events.map(this.normalizeMeetupEvent);
    }

    /**
     * Real-time webhook processing
     */
    async processWebhookEvents(source) {
        const client = await this.pool.connect();
        try {
            const webhookEvents = await client.query(`
                SELECT * FROM webhook_events 
                WHERE source_id = $1 AND processed = false
                ORDER BY created_at ASC
            `, [source.id]);
            
            const processedEvents = [];
            for (const webhookEvent of webhookEvents.rows) {
                try {
                    // Verify webhook signature
                    if (!this.verifyWebhookSignature(webhookEvent, source.webhook_secret)) {
                        console.error(`Invalid webhook signature for event ${webhookEvent.id}`);
                        continue;
                    }
                    
                    // Process webhook payload
                    const event = await this.processWebhookPayload(webhookEvent.payload, source);
                    if (event) {
                        processedEvents.push(event);
                    }
                    
                    // Mark as processed
                    await client.query(`
                        UPDATE webhook_events 
                        SET processed = true, processed_at = NOW()
                        WHERE id = $1
                    `, [webhookEvent.id]);
                    
                } catch (error) {
                    console.error(`Error processing webhook event ${webhookEvent.id}:`, error);
                    await client.query(`
                        UPDATE webhook_events 
                        SET error_message = $1
                        WHERE id = $2
                    `, [error.message, webhookEvent.id]);
                }
            }
            
            return processedEvents;
        } finally {
            client.release();
        }
    }

    /**
     * Utility functions
     */
    
    async getActiveSources(sourceId = null) {
        const client = await this.pool.connect();
        try {
            const query = sourceId 
                ? 'SELECT * FROM event_sources WHERE id = $1 AND is_active = true'
                : 'SELECT * FROM event_sources WHERE is_active = true';
            
            const params = sourceId ? [sourceId] : [];
            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    checkRateLimit(source) {
        const now = Date.now();
        const key = `rate_limit_${source.id}`;
        const limit = source.rate_limit_per_hour;
        
        if (!this.rateLimiter.has(key)) {
            this.rateLimiter.set(key, { count: 0, resetTime: now + 3600000 });
        }
        
        const rateInfo = this.rateLimiter.get(key);
        
        if (now > rateInfo.resetTime) {
            rateInfo.count = 0;
            rateInfo.resetTime = now + 3600000;
        }
        
        if (rateInfo.count >= limit) {
            return false;
        }
        
        rateInfo.count++;
        return true;
    }

    async createSyncJob(sourceId, jobType) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO sync_jobs (source_id, job_type, status, started_at)
                VALUES ($1, $2, 'running', NOW())
                RETURNING id
            `, [sourceId, jobType]);
            
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    async updateSyncJob(jobId, status, metadata = {}) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                UPDATE sync_jobs 
                SET status = $1, completed_at = NOW(), metadata = $2,
                    events_processed = $3, events_created = $4, events_updated = $5
                WHERE id = $6
            `, [
                status, 
                JSON.stringify(metadata),
                metadata.events_processed || 0,
                metadata.events_created || 0,
                metadata.events_updated || 0,
                jobId
            ]);
        } finally {
            client.release();
        }
    }

    // Placeholder functions for ML operations
    async generateTextEmbedding(text) {
        // This would integrate with actual embedding models (OpenAI, Hugging Face, etc.)
        return new Array(512).fill(0).map(() => Math.random());
    }

    async generateLocationEmbedding(venue, address) {
        // Location-specific embeddings
        return new Array(128).fill(0).map(() => Math.random());
    }

    async cosineSimilarity(vector1, vector2) {
        // Cosine similarity calculation
        if (!vector1 || !vector2 || vector1.length !== vector2.length) return 0;
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vector1.length; i++) {
            dotProduct += vector1[i] * vector2[i];
            norm1 += vector1[i] * vector1[i];
            norm2 += vector2[i] * vector2[i];
        }
        
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    extractTimeFeatures(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return {
            hour_of_day: start.getHours(),
            day_of_week: start.getDay(),
            month: start.getMonth(),
            duration_hours: (end - start) / (1000 * 60 * 60),
            is_weekend: start.getDay() === 0 || start.getDay() === 6,
            is_evening: start.getHours() >= 18,
            season: Math.floor(start.getMonth() / 3)
        };
    }

    extractTextFeatures(text) {
        // Basic NLP features
        const words = text.toLowerCase().split(/\s+/);
        
        return {
            word_count: words.length,
            char_count: text.length,
            has_music_keywords: words.some(w => ['music', 'concert', 'band', 'dj'].includes(w)),
            has_art_keywords: words.some(w => ['art', 'gallery', 'exhibition', 'painting'].includes(w)),
            has_food_keywords: words.some(w => ['food', 'restaurant', 'dinner', 'lunch'].includes(w)),
            sentiment_score: Math.random() // Placeholder for actual sentiment analysis
        };
    }

    async calculateConfidenceScore(event) {
        // Calculate overall confidence based on various factors
        let score = 0.5; // Base score
        
        // Boost for complete data
        if (event.title && event.description) score += 0.1;
        if (event.location_id) score += 0.1;
        if (event.venue) score += 0.1;
        if (event.start_date && event.end_date) score += 0.1;
        
        // Boost for verified sources
        if (event.source_type === 'api') score += 0.1;
        
        // Penalize for detected duplicates
        if (event.duplicate_info && event.duplicate_info.length > 0) {
            score -= 0.2;
        }
        
        return Math.min(1.0, Math.max(0.0, score));
    }

    /**
     * Sync events from a specific source (called by aggregation system)
     */
    async syncSource(sourceId) {
        console.log(`🔄 Starting sync for source ID: ${sourceId}`);
        
        const client = await this.pool.connect();
        try {
            // Get the source details
            const sourceResult = await client.query('SELECT * FROM event_sources WHERE id = $1', [sourceId]);
            
            if (sourceResult.rows.length === 0) {
                throw new Error(`Source with ID ${sourceId} not found`);
            }
            
            const source = sourceResult.rows[0];
            
            if (!source.is_active) {
                console.log(`Source ${source.name} is not active, skipping sync`);
                return;
            }
            
            // Update last sync attempt
            await client.query('UPDATE event_sources SET last_sync_at = NOW() WHERE id = $1', [sourceId]);
            
            // Process the source
            await this.processEventSource(source);
            
            // Update sync status to active
            await client.query('UPDATE event_sources SET sync_status = $1 WHERE id = $2', ['active', sourceId]);
            
            console.log(`✅ Sync completed for source: ${source.name}`);
            
        } catch (error) {
            console.error(`❌ Sync failed for source ID ${sourceId}:`, error);
            
            // Update error count and status
            await client.query(`
                UPDATE event_sources 
                SET sync_status = 'error', error_count = error_count + 1 
                WHERE id = $1
            `, [sourceId]);
            
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Run full sync across all active sources
     */
    async runFullSync() {
        console.log('🌍 Starting full system sync...');
        
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT id FROM event_sources WHERE is_active = true');
            const sourceIds = result.rows.map(row => row.id);
            
            console.log(`Found ${sourceIds.length} active sources to sync`);
            
            for (const sourceId of sourceIds) {
                try {
                    await this.syncSource(sourceId);
                } catch (error) {
                    console.error(`Failed to sync source ${sourceId}:`, error);
                    // Continue with other sources even if one fails
                }
            }
            
            console.log('✅ Full system sync completed');
            
        } finally {
            client.release();
        }
    }
}

export default EventAggregator; 