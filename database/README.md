# 🗄️ Database Setup Guide

This guide walks you through setting up the enhanced PostgreSQL database for the Artist Events application.

## 📋 Prerequisites

1. **PostgreSQL 14+** installed on your system
2. **Node.js 18+** with npm
3. **Database credentials** with create/modify permissions

## 🚀 Quick Setup

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database and user
CREATE DATABASE artist_events;
CREATE USER artist_events_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE artist_events TO artist_events_user;
\q
```

### 3. Install Node.js Dependencies

```bash
npm install pg dotenv
```

### 4. Set Environment Variables

Create a `.env` file in your project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=artist_events
DB_USER=artist_events_user
DB_PASSWORD=your_secure_password
NODE_ENV=development
```

### 5. Run Database Schema

```bash
# Create all tables, indexes, and sample data
psql -U artist_events_user -d artist_events -f database/schema.sql
```

### 6. Migrate Existing JSON Data

```bash
# Update database credentials in database/migrate-from-json.js
# Then run the migration
node database/migrate-from-json.js
```

## 🏗️ Database Schema Overview

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Authentication and user management |
| `venues` | Event locations and venue information |
| `artists` | Performer/artist database |
| `events` | Main events table with enhanced fields |
| `tags` | Categorization tags for events |

### Advanced Features

| Table | Purpose |
|-------|---------|
| `event_sources` | Websites/APIs to monitor for events |
| `scrape_jobs` | Background scraping job queue |
| `scraped_events_raw` | Raw scraped data before processing |
| `event_submissions` | Public event submissions |
| `event_history` | Change tracking and audit logs |

### Relationships

```
events ──┬── venues (many-to-one)
         ├── event_artists ── artists (many-to-many)
         ├── event_tags ── tags (many-to-many)
         ├── sub_events (one-to-many)
         └── event_sources (many-to-one)
```

## 🔧 Common Operations

### Query Published Events

```javascript
import { getPublishedEvents } from '../lib/database.js';

const events = await getPublishedEvents();
console.log(`Found ${events.length} published events`);
```

### Search Events

```javascript
import { searchEvents } from '../lib/database.js';

const results = await searchEvents({
  query: 'jazz',
  genre: 'Jazz',
  date_from: '2024-01-01'
});
```

### Create New Event

```javascript
import { createEvent } from '../lib/database.js';

const eventId = await createEvent({
  slug: 'new-jazz-concert',
  title: 'Amazing Jazz Night',
  description: 'A wonderful evening of jazz music',
  start_date: '2024-03-15',
  start_time: '19:00',
  venue_id: 1,
  genre: 'Jazz',
  artists: [
    { name: 'Miles Davis Tribute', role: 'headliner' }
  ],
  tags: [1, 2, 3], // tag IDs
  status: 'published'
});
```

## 🛠️ Maintenance

### Backup Database

```bash
# Create backup
pg_dump -U artist_events_user artist_events > backup_$(date +%Y%m%d).sql

# Restore backup
psql -U artist_events_user artist_events < backup_20240315.sql
```

### Performance Monitoring

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🚨 Troubleshooting

### Connection Issues

**Error: `ECONNREFUSED`**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Start PostgreSQL if not running
brew services start postgresql@14     # macOS
sudo systemctl start postgresql       # Linux
```

**Error: `password authentication failed`**
```bash
# Reset user password
psql -U postgres
ALTER USER artist_events_user PASSWORD 'new_password';
```

### Migration Issues

**Error: `relation does not exist`**
```bash
# Make sure schema.sql was run first
psql -U artist_events_user -d artist_events -f database/schema.sql
```

**Error: `duplicate key value`**
```bash
# Clear existing data if needed
psql -U artist_events_user -d artist_events
TRUNCATE events, venues, artists, tags CASCADE;
```

## 📊 Schema Changes

When making schema changes:

1. **Create migration file:**
   ```sql
   -- migrations/001_add_event_images.sql
   ALTER TABLE events ADD COLUMN image_url VARCHAR(500);
   CREATE INDEX idx_events_image ON events(image_url) WHERE image_url IS NOT NULL;
   ```

2. **Update database functions:**
   ```javascript
   // Update lib/database.js with new fields
   ```

3. **Test thoroughly:**
   ```bash
   # Run migration on test database first
   psql -U test_user -d test_artist_events -f migrations/001_add_event_images.sql
   ```

## 🔍 Useful Queries

### Event Statistics

```sql
-- Events by status
SELECT status, COUNT(*) 
FROM events 
GROUP BY status;

-- Events by genre
SELECT genre, COUNT(*) 
FROM events 
WHERE status = 'published'
GROUP BY genre 
ORDER BY COUNT(*) DESC;

-- Popular venues
SELECT v.name, COUNT(e.id) as event_count
FROM venues v
JOIN events e ON v.id = e.venue_id
WHERE e.status = 'published'
GROUP BY v.id, v.name
ORDER BY event_count DESC
LIMIT 10;
```

### Scraping Monitoring

```sql
-- Source success rates
SELECT name, success_rate, last_successful_scrape
FROM event_sources
WHERE active = true
ORDER BY success_rate ASC;

-- Recent scraping activity
SELECT es.name, sj.status, sj.events_found, sj.completed_at
FROM scrape_jobs sj
JOIN event_sources es ON sj.source_id = es.id
ORDER BY sj.created_at DESC
LIMIT 20;
```

## 🎯 Next Steps

1. Set up automated backups
2. Configure monitoring and alerting
3. Implement database connection pooling
4. Set up read replicas for scaling
5. Add data analytics and reporting

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Library](https://node-postgres.com/)
- [Database Design Best Practices](https://en.wikipedia.org/wiki/Database_design)

For questions or issues, check the troubleshooting section above or create an issue in the project repository. 