-- Admin System Migration for Artist Events Platform
-- This script adds admin functionality and sets up the super admin

-- Add missing columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Create admin permissions table for granular control
CREATE TABLE IF NOT EXISTS admin_permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user admin permissions junction table
CREATE TABLE IF NOT EXISTS user_admin_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES admin_permissions(id) ON DELETE CASCADE,
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, permission_id)
);

-- Create admin activity log
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50), -- 'user', 'event', 'blog_post', etc.
    target_id INTEGER,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin permissions
INSERT INTO admin_permissions (name, description, category) VALUES
('users.view', 'View user list and details', 'users'),
('users.edit', 'Edit user information', 'users'),
('users.ban', 'Ban and unban users', 'users'),
('users.delete', 'Delete user accounts', 'users'),
('users.grant_admin', 'Grant admin permissions to users', 'users'),
('events.view', 'View all events', 'events'),
('events.edit', 'Edit any event', 'events'),
('events.delete', 'Delete any event', 'events'),
('events.moderate', 'Approve/reject events', 'events'),
('blogs.view', 'View all blog posts', 'blogs'),
('blogs.edit', 'Edit any blog post', 'blogs'),
('blogs.delete', 'Delete any blog post', 'blogs'),
('blogs.moderate', 'Approve/reject blog posts', 'blogs'),
('admin.view_dashboard', 'Access admin dashboard', 'admin'),
('admin.view_logs', 'View admin activity logs', 'admin'),
('admin.system_settings', 'Modify system settings', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Create or update the super admin user
INSERT INTO users (
    email, 
    password_hash, 
    user_type, 
    name,
    is_super_admin,
    active, 
    profile_completed, 
    created_at
) VALUES (
    'ishan.pathak2711@gmail.com',
    '$2b$12$LQv3c1yqBwlVHpPjrCeyL.rP.BqXqLr1.qYTYVZQr0.aOqVJlcOGy', -- Default: admin123 (you should change this)
    'admin',
    'Ishan Pathak',
    true,
    true,
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO UPDATE SET
    is_super_admin = true,
    user_type = 'admin',
    name = EXCLUDED.name,
    active = true;

-- Grant all permissions to super admin
INSERT INTO user_admin_permissions (user_id, permission_id)
SELECT 
    u.id, 
    p.id
FROM users u
CROSS JOIN admin_permissions p
WHERE u.email = 'ishan.pathak2711@gmail.com'
ON CONFLICT (user_id, permission_id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin);
CREATE INDEX IF NOT EXISTS idx_users_banned_at ON users(banned_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON admin_activity_log(created_at);

-- Add trigger to log admin activities
CREATE OR REPLACE FUNCTION log_admin_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- This function can be extended to automatically log certain admin actions
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE admin_permissions IS 'Granular permissions for admin users';
COMMENT ON TABLE user_admin_permissions IS 'Admin permissions granted to specific users';
COMMENT ON TABLE admin_activity_log IS 'Log of all admin actions for audit trail'; 