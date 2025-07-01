-- Artist-Specific Email Subscription System
-- Allows users to subscribe to individual artists

-- Artist-specific subscriptions (users can follow specific artists)
CREATE TABLE IF NOT EXISTS artist_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    artist_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- artist is a user
    
    -- Subscription preferences
    is_subscribed BOOLEAN DEFAULT true,
    notification_types JSONB DEFAULT '["events", "releases", "updates"]', -- what they want to hear about
    
    -- Timestamps
    subscribed_at TIMESTAMP DEFAULT NOW(),
    unsubscribed_at TIMESTAMP,
    
    UNIQUE(user_id, artist_id)
);

-- Enhanced email campaigns with approval workflow
CREATE TABLE IF NOT EXISTS artist_email_campaigns (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Campaign Details
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    campaign_type VARCHAR(50) DEFAULT 'general', -- 'event', 'release', 'general', 'behind_scenes'
    
    -- Audience Selection
    audience_type VARCHAR(50) NOT NULL, -- 'everyone', 'my_fans', 'event_attendees', 'city_based'
    audience_filter JSONB, -- additional filters (event_id, city, etc.)
    estimated_recipients INTEGER DEFAULT 0,
    
    -- Approval Workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'sent', 'cancelled')),
    
    -- Admin Review
    reviewed_by INTEGER REFERENCES users(id),
    admin_notes TEXT,
    rejection_reason TEXT,
    
    -- Scheduling
    scheduled_at TIMESTAMP,
    send_immediately BOOLEAN DEFAULT false,
    
    -- Analytics
    total_recipients INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    unsubscribes INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    sent_at TIMESTAMP
);

-- Campaign recipients tracking
CREATE TABLE IF NOT EXISTS artist_campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES artist_email_campaigns(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    
    -- Delivery tracking
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    bounced_at TIMESTAMP,
    unsubscribed_at TIMESTAMP,
    
    -- Engagement tracking
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    
    UNIQUE(campaign_id, user_id)
);

-- Admin approval history
CREATE TABLE IF NOT EXISTS campaign_approval_history (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES artist_email_campaigns(id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES users(id),
    action VARCHAR(20) NOT NULL, -- 'submitted', 'approved', 'rejected', 'requested_changes'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_artist_subscriptions_user_id ON artist_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_artist_subscriptions_artist_id ON artist_subscriptions(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_subscriptions_active ON artist_subscriptions(user_id, artist_id, is_subscribed);

CREATE INDEX IF NOT EXISTS idx_artist_campaigns_artist_id ON artist_email_campaigns(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_campaigns_status ON artist_email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_artist_campaigns_pending ON artist_email_campaigns(status, submitted_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON artist_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_user_id ON artist_campaign_recipients(user_id);

-- Note: No sample data included - artist subscriptions will be created organically as users subscribe to artists

COMMENT ON TABLE artist_subscriptions IS 'Users can subscribe to specific artists for email notifications';
COMMENT ON TABLE artist_email_campaigns IS 'Artist-initiated email campaigns with admin approval workflow';
COMMENT ON TABLE artist_campaign_recipients IS 'Tracking individual email delivery and engagement';
COMMENT ON TABLE campaign_approval_history IS 'History of admin decisions on campaigns'; 