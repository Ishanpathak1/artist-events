-- Email Campaign System with Admin Moderation
-- Run this after your existing schema

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'event', 'update', 'newsletter', 'community'
    html_content TEXT NOT NULL,
    preview_image_url VARCHAR(500),
    variables JSONB, -- Available template variables like {{artist_name}}, {{event_title}}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Email Campaigns (with admin approval workflow)
CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES email_templates(id),
    
    -- Campaign Content
    subject VARCHAR(200) NOT NULL,
    content TEXT NOT NULL, -- Processed template with variables filled
    raw_content JSONB, -- Original template data + variables
    
    -- Workflow Status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'sent', 'cancelled')),
    
    -- Admin Review
    reviewed_by INTEGER REFERENCES users(id),
    admin_notes TEXT,
    
    -- Audience Settings
    target_audience VARCHAR(50) DEFAULT 'all', -- 'all', 'event_attendees', 'followers', 'city_based'
    audience_filter JSONB, -- Additional filters like city, event_id, etc.
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    
    -- Metrics
    total_recipients INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    unsubscribes INTEGER DEFAULT 0
);

-- Email Recipients & Analytics
CREATE TABLE IF NOT EXISTS email_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES email_campaigns(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    
    -- Status
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    bounced_at TIMESTAMP,
    unsubscribed_at TIMESTAMP,
    
    -- Tracking
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    
    UNIQUE(campaign_id, user_id)
);

-- Email Subscriptions & Preferences
CREATE TABLE IF NOT EXISTS email_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subscription Status
    is_subscribed BOOLEAN DEFAULT true,
    subscribed_at TIMESTAMP DEFAULT NOW(),
    unsubscribed_at TIMESTAMP,
    
    -- Preferences
    frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
    categories JSONB DEFAULT '["events", "updates"]', -- What types of emails they want
    
    -- Location-based
    location_city VARCHAR(100),
    location_radius INTEGER DEFAULT 25, -- miles
    
    UNIQUE(user_id)
);

-- Email Template Variables (for dynamic content)
CREATE TABLE IF NOT EXISTS email_template_variables (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES email_templates(id) ON DELETE CASCADE,
    variable_name VARCHAR(50) NOT NULL,
    variable_type VARCHAR(20) NOT NULL, -- 'text', 'url', 'image', 'date'
    default_value TEXT,
    is_required BOOLEAN DEFAULT false,
    description TEXT
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_email_campaigns_artist_id ON email_campaigns(artist_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_sent_at ON email_campaigns(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_recipients_campaign_id ON email_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_user_id ON email_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_user_id ON email_subscriptions(user_id);

-- Default Email Templates
INSERT INTO email_templates (name, description, category, html_content, variables) VALUES 
(
    'Event Announcement - Modern',
    'Clean, modern template for announcing new events',
    'event',
    '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 20px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:28px">🎵 {{artist_name}}</h1>
<p style="color:rgba(255,255,255,0.9);margin:10px 0 0">You''re invited to something special!</p>
</div>
<div style="padding:40px 20px">
<h2 style="color:#1e293b;margin:0 0 20px;font-size:24px">{{event_title}}</h2>
<p style="color:#64748b;line-height:1.6;margin:0 0 30px">{{event_description}}</p>
<div style="background:#f1f5f9;padding:20px;border-radius:10px;margin:0 0 30px">
<p style="margin:0 0 10px;color:#1e293b"><strong>📅 Date:</strong> {{event_date}}</p>
<p style="margin:0 0 10px;color:#1e293b"><strong>🕐 Time:</strong> {{event_time}}</p>
<p style="margin:0 0 10px;color:#1e293b"><strong>📍 Venue:</strong> {{venue_name}}</p>
<p style="margin:0;color:#1e293b"><strong>💰 Price:</strong> {{ticket_price}}</p>
</div>
<div style="text-align:center">
<a href="{{ticket_url}}" style="background:#667eea;color:#fff;padding:15px 30px;text-decoration:none;border-radius:25px;display:inline-block;font-weight:600">Get Tickets Now 🎫</a>
</div>
</div>
<div style="background:#f8fafc;padding:20px;text-align:center;color:#64748b;font-size:14px">
<p>Thanks for being part of our music community!</p>
<p><a href="{{unsubscribe_url}}" style="color:#64748b">Unsubscribe</a></p>
</div>
</div>
</body>
</html>',
    '["artist_name", "event_title", "event_description", "event_date", "event_time", "venue_name", "ticket_price", "ticket_url"]'
),
(
    'Artist Update - Casual',
    'Friendly template for artist updates and news',
    'update',
    '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
<div style="padding:40px 20px;text-align:center;border-bottom:3px solid #667eea">
<h1 style="color:#1e293b;margin:0;font-size:28px">Hey from {{artist_name}}! 👋</h1>
</div>
<div style="padding:40px 20px">
<div style="margin:0 0 30px">{{custom_content}}</div>
<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px;border-radius:15px;text-align:center">
<p style="margin:0;font-size:16px">Stay connected with me!</p>
<div style="margin:20px 0 0">
<a href="{{instagram_url}}" style="color:#fff;margin:0 10px;text-decoration:none">📷 Instagram</a>
<a href="{{twitter_url}}" style="color:#fff;margin:0 10px;text-decoration:none">🐦 Twitter</a>
</div>
</div>
</div>
<div style="background:#f8fafc;padding:20px;text-align:center;color:#64748b;font-size:14px">
<p>You''re receiving this because you''re awesome!</p>
<p><a href="{{unsubscribe_url}}" style="color:#64748b">Unsubscribe</a></p>
</div>
</div>
</body>
</html>',
    '["artist_name", "custom_content", "instagram_url", "twitter_url"]'
),
(
    'Newsletter - Monthly Roundup',
    'Comprehensive template for monthly newsletters',
    'newsletter',
    '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff">
<div style="background:#1e293b;padding:30px 20px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:24px">🎵 {{newsletter_title}}</h1>
<p style="color:rgba(255,255,255,0.8);margin:10px 0 0">{{month_year}} Edition</p>
</div>
<div style="padding:40px 20px">
<h2 style="color:#1e293b;margin:0 0 20px">What''s Happening 🎪</h2>
<div style="margin:0 0 40px">{{newsletter_content}}</div>
<div style="background:#f1f5f9;padding:25px;border-radius:10px">
<h3 style="color:#1e293b;margin:0 0 15px">Upcoming Events 📅</h3>
<div>{{upcoming_events}}</div>
</div>
</div>
<div style="background:#f8fafc;padding:20px;text-align:center;color:#64748b;font-size:14px">
<p>Thanks for being part of our music community!</p>
<p><a href="{{unsubscribe_url}}" style="color:#64748b">Unsubscribe</a></p>
</div>
</div>
</body>
</html>',
    '["newsletter_title", "month_year", "newsletter_content", "upcoming_events"]'
);

-- Auto-subscribe new users to email list
INSERT INTO email_subscriptions (user_id, is_subscribed, subscribed_at)
SELECT id, true, NOW() 
FROM users 
WHERE NOT EXISTS (
    SELECT 1 FROM email_subscriptions WHERE user_id = users.id
);

-- Admin Broadcasts Table (for admin-to-all communications)
CREATE TABLE IF NOT EXISTS admin_broadcasts (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    broadcast_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    cta_text VARCHAR(100),
    cta_url TEXT,
    recipient_type VARCHAR(50) NOT NULL, -- 'all', 'subscribers', 'artists', 'active'
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sending', 'sent', 'failed', 'partial'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP
);

-- Additional indexes for admin broadcasts
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_admin_id ON admin_broadcasts(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_status ON admin_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created_at ON admin_broadcasts(created_at);

COMMENT ON TABLE email_campaigns IS 'Email campaigns with admin approval workflow';
COMMENT ON TABLE email_templates IS 'Reusable email templates with variables';
COMMENT ON TABLE email_recipients IS 'Individual email delivery tracking';
COMMENT ON TABLE email_subscriptions IS 'User email preferences and subscription status';
COMMENT ON TABLE admin_broadcasts IS 'Admin broadcast messages to all users'; 