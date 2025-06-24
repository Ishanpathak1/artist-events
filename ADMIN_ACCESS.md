# Admin Dashboard Access Guide

## 🔑 Super Admin Access

**Your Super Admin Account:**
- **Email:** `xxx`
- **Default Password:** `xxxx` (⚠️ **CHANGE THIS IMMEDIATELY**)
- **Role:** Super Admin (full access to everything)

## 🌐 Admin Dashboard URLs

### Local Development
- **Main Admin Dashboard:** `http://localhost:4321/admin`
- **User Management:** `http://localhost:4321/admin/users`
- **Event Management:** `http://localhost:4321/admin/events`
- **Admin Management (Super Admin Only):** `http://localhost:4321/admin/admins`

### Production (Replace with your domain)
- **Main Admin Dashboard:** `https://yourdomain.com/admin`
- **User Management:** `https://yourdomain.com/admin/users`
- **Event Management:** `https://yourdomain.com/admin/events`
- **Admin Management (Super Admin Only):** `https://yourdomain.com/admin/admins`

## 🚀 Getting Started

1. **Start your application:**
   ```bash
   npm run dev
   ```

2. **Access the admin dashboard:**
   - Go to `http://localhost:4321/admin`
   - Log in with your super admin credentials

3. **First Login Steps:**
   - ⚠️ **IMPORTANT:** Change your password immediately
   - Explore the dashboard features
   - Grant admin access to other users if needed

## 👥 Granting Admin Access to Others

As the super admin, you have exclusive rights to grant admin access:

1. **Navigate to Admin Management:**
   - Go to `/admin/admins`
   - This page is only visible to you (super admin)

2. **Grant Access:**
   - Enter the email of an existing user
   - Select specific permissions or leave empty for full access
   - Click "Grant Admin Access"

3. **Revoke Access:**
   - View current admins in the list
   - Click "Revoke Access" for any non-super admin
   - Confirm the action

## 🔒 Security Features

### Admin Authentication
- **Super Admin Check:** Only `ishan.pathak2711@gmail.com` with `is_super_admin = true`
- **Regular Admin Check:** Users with `user_type = 'admin'`
- **Session Validation:** All admin pages verify active sessions

### Admin Permissions
- **User Management:** View, edit, ban/unban users
- **Event Management:** Approve, edit, delete events
- **Admin Management:** Grant/revoke admin access (super admin only)
- **Bulk Operations:** Mass approve or delete events

### Protected Actions
- Cannot revoke super admin access
- Cannot ban super admin account
- Session invalidation when admin access is revoked
- Audit trail for admin actions

## 📊 Dashboard Features

### Overview Page (`/admin`)
- Platform statistics (users, events, etc.)
- Recent user registrations
- Recent event submissions
- Quick action links

### User Management (`/admin/users`)
- View all platform users
- Search and filter by type/status
- Edit user information
- Ban/unban users
- View user activity details

### Event Management (`/admin/events`)
- View all events with creator info
- Filter by status and creator type
- Approve pending events
- Bulk approve/delete operations
- View detailed event information

### Admin Management (`/admin/admins`) - Super Admin Only
- View current admin users
- Grant admin access to existing users
- Revoke admin access from users
- Manage admin permissions

## 🛠️ Database Schema Updates

The migration added these new tables and columns:

### New Columns in `users` table:
- `banned_at` - Timestamp when user was banned
- `ban_reason` - Reason for banning
- `is_super_admin` - Boolean flag for super admin
- `admin_permissions` - JSONB for additional permissions
- `name` - User's display name

### New Tables:
- `admin_permissions` - Available admin permissions
- `user_admin_permissions` - User-specific admin permissions
- `admin_activity_log` - Audit trail for admin actions

## ⚠️ Important Security Notes

1. **Change Default Password:** The default password `admin123` should be changed immediately
2. **Environment Variables:** Ensure your database URL is properly set in `.env`
3. **Super Admin Email:** Only `ishan.pathak2711@gmail.com` has super admin privileges
4. **Admin Access:** Regular admins cannot grant admin access to others
5. **Session Security:** Admin sessions are validated on every request

## 🔧 Troubleshooting

### Can't Access Admin Dashboard
- Ensure you're logged in with the correct email
- Check that your session hasn't expired
- Verify your account has admin privileges

### Permission Denied
- Only super admin can access `/admin/admins`
- Regular admins have limited access to certain features
- Check your user_type and is_super_admin flags

### Database Issues
- Ensure migration ran successfully
- Check database connection in environment variables
- Verify all required tables exist

## 📞 Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify database connection
3. Ensure all environment variables are set
4. Check that the migration completed successfully

---

**Remember:** As the super admin, you have complete control over the platform. Use these privileges responsibly and secure your account properly. 