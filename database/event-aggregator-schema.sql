-- Advanced Event Aggregation System Schema
-- This extends the existing schema with sophisticated aggregation capabilities

-- Event Sources Management
CREATE TABLE IF NOT EXISTS event_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'api', 'webhook', 'scraper', 'manual'
    base_url TEXT,
    api_key_encrypted TEXT, -- Encrypted API keys
    webhook_secret TEXT,
    sync_frequency INTEGER DEFAULT 60, -- minutes
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending', -- 'active', 'error', 'pending'
    error_count INTEGER DEFAULT 0,
    config JSONB, -- Source-specific configuration
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Events Table (extending existing)
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_id INTEGER REFERENCES event_sources(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_data JSONB; -- Original data from source
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2); -- ML confidence 0-1
ALTER TABLE events ADD COLUMN IF NOT EXISTS duplicate_group_id UUID; -- For grouping duplicates
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_master_record BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sync_hash VARCHAR(64); -- For change detection

-- Create unique constraint for external events
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_external 
ON events(source_id, external_id) WHERE source_id IS NOT NULL;

-- Event Duplicates Detection
CREATE TABLE IF NOT EXISTS event_duplicates (
    id SERIAL PRIMARY KEY,
    group_id UUID NOT NULL,
    master_event_id INTEGER REFERENCES events(id),
    duplicate_event_id INTEGER REFERENCES events(id),
    similarity_score DECIMAL(5,4), -- 0-1 similarity score
    detection_method VARCHAR(50), -- 'ml', 'exact_match', 'fuzzy_match', 'manual'
    detection_confidence DECIMAL(3,2),
    matched_fields JSONB, -- Which fields matched
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'detected' -- 'detected', 'confirmed', 'rejected'
);

-- Location Intelligence
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone VARCHAR(50),
    venue_type VARCHAR(50), -- 'theater', 'arena', 'club', 'outdoor', etc.
    capacity INTEGER,
    amenities JSONB,
    external_ids JSONB, -- IDs from various mapping services
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add location reference to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);

-- Sync Jobs Management
CREATE TABLE IF NOT EXISTS sync_jobs (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES event_sources(id),
    job_type VARCHAR(50), -- 'full_sync', 'incremental', 'webhook'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    events_processed INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_updated INTEGER DEFAULT 0,
    events_deduplicated INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook Events Log
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES event_sources(id),
    event_type VARCHAR(100),
    payload JSONB,
    signature VARCHAR(255),
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ML Model Configurations
CREATE TABLE IF NOT EXISTS ml_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50), -- 'deduplication', 'categorization', 'sentiment'
    version VARCHAR(20),
    model_path TEXT,
    is_active BOOLEAN DEFAULT false,
    accuracy_score DECIMAL(5,4),
    training_data_size INTEGER,
    features_used JSONB,
    hyperparameters JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    deployed_at TIMESTAMP
);

-- Feature Engineering for ML
CREATE TABLE IF NOT EXISTS event_features (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id),
    title_vector JSONB, -- Embeddings for title (stored as JSON array)
    description_vector JSONB, -- Embeddings for description (stored as JSON array)
    location_vector JSONB, -- Location embeddings (stored as JSON array)
    time_features JSONB, -- Extracted time features
    text_features JSONB, -- NLP extracted features
    generated_at TIMESTAMP DEFAULT NOW()
);

-- User Preferences for Personalization
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    location_radius INTEGER DEFAULT 50, -- km
    preferred_categories TEXT[],
    excluded_sources INTEGER[], -- source IDs to exclude
    min_confidence_score DECIMAL(3,2) DEFAULT 0.7,
    notification_preferences JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_events_duplicate_group ON events(duplicate_group_id) WHERE duplicate_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_source_sync ON events(source_id, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(processed, created_at) WHERE NOT processed;

-- Create extension for vector similarity (if using pgvector)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Functions for ML Operations
CREATE OR REPLACE FUNCTION calculate_event_similarity(
    event1_id INTEGER,
    event2_id INTEGER
) RETURNS DECIMAL(5,4) AS $$
DECLARE
    similarity_score DECIMAL(5,4);
BEGIN
    -- This will be implemented with actual ML logic
    -- For now, return a placeholder
    RETURN 0.5;
END;
$$ LANGUAGE plpgsql;

-- Function to generate duplicate group ID
CREATE OR REPLACE FUNCTION generate_duplicate_group_id() RETURNS UUID AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- Insert default event sources (only if they don't exist)
INSERT INTO event_sources (name, type, base_url, sync_frequency, config) 
SELECT 'Eventbrite', 'api', 'https://www.eventbriteapi.com/v3/', 30, '{"api_version": "v3", "categories": ["music", "arts", "business"]}'
WHERE NOT EXISTS (SELECT 1 FROM event_sources WHERE name = 'Eventbrite');

INSERT INTO event_sources (name, type, base_url, sync_frequency, config) 
SELECT 'Facebook Events', 'api', 'https://graph.facebook.com/', 60, '{"api_version": "v18.0"}'
WHERE NOT EXISTS (SELECT 1 FROM event_sources WHERE name = 'Facebook Events');

INSERT INTO event_sources (name, type, base_url, sync_frequency, config) 
SELECT 'Meetup', 'api', 'https://api.meetup.com/', 45, '{"api_version": "v3"}'
WHERE NOT EXISTS (SELECT 1 FROM event_sources WHERE name = 'Meetup');

INSERT INTO event_sources (name, type, base_url, sync_frequency, config) 
SELECT 'Manual Submissions', 'manual', NULL, NULL, '{"requires_approval": true}'
WHERE NOT EXISTS (SELECT 1 FROM event_sources WHERE name = 'Manual Submissions');

INSERT INTO event_sources (name, type, base_url, sync_frequency, config) 
SELECT 'Internal Events', 'internal', NULL, NULL, '{"auto_approve": true}'
WHERE NOT EXISTS (SELECT 1 FROM event_sources WHERE name = 'Internal Events');

-- Insert default ML model configuration (only if they don't exist)
INSERT INTO ml_models (name, type, version, is_active) 
SELECT 'Event Deduplication Model', 'deduplication', '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM ml_models WHERE name = 'Event Deduplication Model');

INSERT INTO ml_models (name, type, version, is_active) 
SELECT 'Event Categorization Model', 'categorization', '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM ml_models WHERE name = 'Event Categorization Model');

INSERT INTO ml_models (name, type, version, is_active) 
SELECT 'Location Extraction Model', 'location_extraction', '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM ml_models WHERE name = 'Location Extraction Model');

COMMENT ON TABLE event_sources IS 'Configuration for different event data sources';
COMMENT ON TABLE event_duplicates IS 'ML-detected and manually reviewed event duplicates';
COMMENT ON TABLE locations IS 'Normalized location data with geographic intelligence';
COMMENT ON TABLE sync_jobs IS 'Background job tracking for event synchronization';
COMMENT ON TABLE webhook_events IS 'Real-time webhook event processing log';
COMMENT ON TABLE ml_models IS 'Machine learning model configurations and metadata';
COMMENT ON TABLE event_features IS 'ML feature vectors for events (requires vector extension)';
COMMENT ON TABLE user_preferences IS 'User preferences for personalized event discovery'; 