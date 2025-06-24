-- User Authentication and Profile System
-- Run this after the main schema to add authentication features

-- Update users table with authentication and profile fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE NOT NULL,
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'audience' CHECK (user_type IN ('audience', 'artist', 'admin')),
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS website_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Artist profiles table (extends users for artists)
CREATE TABLE IF NOT EXISTS artist_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stage_name VARCHAR(255),
    genres TEXT[], -- Array of genres
    instruments TEXT[], -- Array of instruments
    experience_level VARCHAR(50) CHECK (experience_level IN ('beginner', 'intermediate', 'professional', 'expert')),
    performance_radius INTEGER DEFAULT 50, -- Miles willing to travel
    hourly_rate DECIMAL(10,2),
    availability JSONB DEFAULT '{}', -- Weekly availability schedule
    portfolio_images TEXT[], -- Array of image URLs
    demo_tracks TEXT[], -- Array of audio file URLs
    press_kit_url VARCHAR(500),
    booking_email VARCHAR(255),
    booking_phone VARCHAR(20),
    verified_artist BOOLEAN DEFAULT false,
    total_events INTEGER DEFAULT 0,
    total_followers INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    featured_artist BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for login management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User followers/following system
CREATE TABLE IF NOT EXISTS user_follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

-- Event bookmarks/favorites
CREATE TABLE IF NOT EXISTS event_bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, event_id)
);

-- Artist reviews and ratings
CREATE TABLE IF NOT EXISTS artist_reviews (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist_id, reviewer_id, event_id)
);

-- User notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'event_reminder', 'new_follower', 'event_approved', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}', -- Additional notification data
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image VARCHAR(500),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    seo_title VARCHAR(255),
    seo_description TEXT,
    tags TEXT[],
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blog post likes
CREATE TABLE IF NOT EXISTS blog_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Blog post comments
CREATE TABLE IF NOT EXISTS blog_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES blog_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update events table to link with users
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 0;

-- Event attendees/RSVPs
CREATE TABLE IF NOT EXISTS event_attendees (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'going' CHECK (status IN ('going', 'interested', 'not_going')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Event likes
CREATE TABLE IF NOT EXISTS event_likes (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_artist_profiles_user_id ON artist_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_event_bookmarks_user ON event_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_event_bookmarks_event ON event_bookmarks(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);

-- Create triggers to update counters
CREATE OR REPLACE FUNCTION update_event_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'event_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE events SET like_count = like_count + 1 WHERE id = NEW.event_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE events SET like_count = like_count - 1 WHERE id = OLD.event_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'event_attendees' THEN
        IF TG_OP = 'INSERT' AND NEW.status = 'going' THEN
            UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
        ELSIF TG_OP = 'DELETE' AND OLD.status = 'going' THEN
            UPDATE events SET attendee_count = attendee_count - 1 WHERE id = OLD.event_id;
        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.status = 'going' AND NEW.status != 'going' THEN
                UPDATE events SET attendee_count = attendee_count - 1 WHERE id = NEW.event_id;
            ELSIF OLD.status != 'going' AND NEW.status = 'going' THEN
                UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id;
            END IF;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_event_likes_count ON event_likes;
CREATE TRIGGER trigger_event_likes_count
    AFTER INSERT OR DELETE ON event_likes
    FOR EACH ROW EXECUTE FUNCTION update_event_counts();

DROP TRIGGER IF EXISTS trigger_event_attendees_count ON event_attendees;
CREATE TRIGGER trigger_event_attendees_count
    AFTER INSERT OR UPDATE OR DELETE ON event_attendees
    FOR EACH ROW EXECUTE FUNCTION update_event_counts();

-- Create function to update blog post counts
CREATE OR REPLACE FUNCTION update_blog_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'blog_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE blog_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE blog_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'blog_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE blog_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create blog triggers
DROP TRIGGER IF EXISTS trigger_blog_likes_count ON blog_likes;
CREATE TRIGGER trigger_blog_likes_count
    AFTER INSERT OR DELETE ON blog_likes
    FOR EACH ROW EXECUTE FUNCTION update_blog_counts();

DROP TRIGGER IF EXISTS trigger_blog_comments_count ON blog_comments;
CREATE TRIGGER trigger_blog_comments_count
    AFTER INSERT OR DELETE ON blog_comments
    FOR EACH ROW EXECUTE FUNCTION update_blog_counts();

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, user_type, active, profile_completed, created_at)
VALUES (
    'admin@artistevents.com',
    '$2b$12$LQv3c1yqBwlVHpPjrCeyL.rP.BqXqLr1.qYTYVZQr0.aOqVJlcOGy', -- bcrypt hash for 'admin123'
    'admin',
    true,
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE users IS 'Extended user table with authentication and profile features';
COMMENT ON TABLE artist_profiles IS 'Additional profile information for artist users';
COMMENT ON TABLE user_sessions IS 'Active user login sessions';
COMMENT ON TABLE user_follows IS 'User following relationships';
COMMENT ON TABLE event_bookmarks IS 'User bookmarked events';
COMMENT ON TABLE artist_reviews IS 'Reviews and ratings for artists';
COMMENT ON TABLE notifications IS 'User notifications system';
COMMENT ON TABLE blog_posts IS 'Artist blog posts and articles';
COMMENT ON TABLE event_attendees IS 'Event RSVP and attendance tracking';
COMMENT ON TABLE event_likes IS 'Event likes and favorites'; 