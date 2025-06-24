-- Enhanced Artist Events Database Schema
-- Supports scraping, moderation, festivals, and comprehensive event management

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users and Authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'editor', 'user')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venues and Locations
CREATE TABLE venues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50) DEFAULT 'USA',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    website_url VARCHAR(500),
    phone VARCHAR(50),
    email VARCHAR(255),
    capacity INTEGER,
    venue_type VARCHAR(100), -- concert_hall, club, outdoor, theater, etc.
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Artists and Performers
CREATE TABLE artists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    bio TEXT,
    genre VARCHAR(100),
    website_url VARCHAR(500),
    instagram_handle VARCHAR(100),
    twitter_handle VARCHAR(100),
    facebook_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    spotify_url VARCHAR(500),
    image_url VARCHAR(500),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Events Table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Date and Time
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    is_all_day BOOLEAN DEFAULT false,
    
    -- Location
    venue_id INTEGER REFERENCES venues(id),
    custom_location TEXT, -- for non-venue events
    
    -- Event Details
    event_type VARCHAR(100) DEFAULT 'concert', -- concert, festival, workshop, exhibition, etc.
    genre VARCHAR(100),
    ticket_price VARCHAR(100),
    ticket_url VARCHAR(500),
    rsvp_url VARCHAR(500),
    
    -- Social Media
    instagram_handle VARCHAR(100),
    twitter_handle VARCHAR(100),
    facebook_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    
    -- Content
    blog_content TEXT,
    image_url VARCHAR(500),
    
    -- Metadata
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'published', 'cancelled', 'archived')),
    featured BOOLEAN DEFAULT false,
    source_type VARCHAR(50) DEFAULT 'manual' CHECK (source_type IN ('manual', 'scraped', 'api', 'submitted')),
    source_url VARCHAR(500),
    source_id INTEGER, -- references event_sources(id)
    
    -- Moderation
    created_by INTEGER REFERENCES users(id),
    moderated_by INTEGER REFERENCES users(id),
    moderated_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scraped_at TIMESTAMP
);

-- Event to Artist Many-to-Many Relationship
CREATE TABLE event_artists (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id),
    artist_name VARCHAR(255), -- for artists not in artists table
    role VARCHAR(100) DEFAULT 'performer', -- performer, headliner, support, dj, etc.
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sub-events for Festivals and Multi-day Events
CREATE TABLE sub_events (
    id SERIAL PRIMARY KEY,
    parent_event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    start_time TIME,
    end_time TIME,
    stage_location VARCHAR(255),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sub-event to Artist Many-to-Many
CREATE TABLE sub_event_artists (
    id SERIAL PRIMARY KEY,
    sub_event_id INTEGER NOT NULL REFERENCES sub_events(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES artists(id),
    artist_name VARCHAR(255),
    role VARCHAR(100) DEFAULT 'performer',
    order_index INTEGER DEFAULT 0
);

-- Event Tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- hex color code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_tags (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, tag_id)
);

-- ============================================================================
-- SCRAPING AND SOURCE MANAGEMENT
-- ============================================================================

-- Sources to Monitor
CREATE TABLE event_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    source_type VARCHAR(100) NOT NULL CHECK (source_type IN ('venue_website', 'facebook_page', 'eventbrite', 'artist_website', 'news_site', 'api', 'rss_feed')),
    
    -- Scraping Configuration
    scrape_frequency INTEGER DEFAULT 1440, -- minutes (1440 = daily)
    css_selectors JSONB, -- CSS selectors for scraping
    api_config JSONB, -- API keys, endpoints, etc.
    parsing_rules JSONB, -- Custom parsing rules
    
    -- Status and Monitoring
    active BOOLEAN DEFAULT true,
    last_scraped TIMESTAMP,
    last_successful_scrape TIMESTAMP,
    last_error TEXT,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    
    -- Associated entities
    venue_id INTEGER REFERENCES venues(id),
    artist_id INTEGER REFERENCES artists(id),
    
    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scraping Jobs and Queue
CREATE TABLE scrape_jobs (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES event_sources(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    events_found INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_updated INTEGER DEFAULT 0,
    error_message TEXT,
    raw_data JSONB, -- store raw scraped data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw scraped data before processing
CREATE TABLE scraped_events_raw (
    id SERIAL PRIMARY KEY,
    scrape_job_id INTEGER NOT NULL REFERENCES scrape_jobs(id),
    source_id INTEGER NOT NULL REFERENCES event_sources(id),
    raw_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    event_id INTEGER REFERENCES events(id), -- linked after processing
    processing_errors TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MODERATION AND WORKFLOW
-- ============================================================================

-- Event Change History
CREATE TABLE event_history (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    changed_by INTEGER REFERENCES users(id),
    change_type VARCHAR(100) NOT NULL, -- created, updated, approved, rejected, published
    old_data JSONB,
    new_data JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Duplicate Detection
CREATE TABLE event_duplicates (
    id SERIAL PRIMARY KEY,
    event1_id INTEGER NOT NULL REFERENCES events(id),
    event2_id INTEGER NOT NULL REFERENCES events(id),
    similarity_score DECIMAL(5,2),
    resolution VARCHAR(50) CHECK (resolution IN ('duplicate', 'different', 'merged', 'pending')),
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Submissions from Public
CREATE TABLE event_submissions (
    id SERIAL PRIMARY KEY,
    submitter_name VARCHAR(255),
    submitter_email VARCHAR(255),
    event_data JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    event_id INTEGER REFERENCES events(id), -- created event if approved
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Event indexes
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_dates ON events(start_date, end_date);
CREATE INDEX idx_events_venue ON events(venue_id);
CREATE INDEX idx_events_featured ON events(featured) WHERE featured = true;
CREATE INDEX idx_events_source ON events(source_type, source_id);

-- Search indexes
CREATE INDEX idx_events_title_search ON events USING gin(to_tsvector('english', title));
CREATE INDEX idx_events_description_search ON events USING gin(to_tsvector('english', description));
CREATE INDEX idx_venues_name_search ON venues USING gin(to_tsvector('english', name));
CREATE INDEX idx_artists_name_search ON artists USING gin(to_tsvector('english', name));

-- Source monitoring indexes
CREATE INDEX idx_sources_scrape_schedule ON event_sources(active, scrape_frequency, last_scraped);
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status, created_at);

-- ============================================================================
-- SAMPLE DATA AND CONSTRAINTS
-- ============================================================================

-- Add some default tags
INSERT INTO tags (name, slug, color) VALUES 
    ('Jazz', 'jazz', '#4A90E2'),
    ('Rock', 'rock', '#E94B3C'),
    ('Electronic', 'electronic', '#9013FE'),
    ('Folk', 'folk', '#4CAF50'),
    ('Classical', 'classical', '#795548'),
    ('Live Music', 'live-music', '#FF9800'),
    ('Festival', 'festival', '#E91E63'),
    ('Free Event', 'free-event', '#8BC34A'),
    ('All Ages', 'all-ages', '#03DAC6'),
    ('21+', '21-plus', '#FF5722');

-- Add update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_sources_updated_at BEFORE UPDATE ON event_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 