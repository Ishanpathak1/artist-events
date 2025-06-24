# 🎵 Artist Events Platform

A comprehensive event discovery and management platform built with **Astro 5.10.0**, **TypeScript**, and **PostgreSQL**. Designed to help artists, venues, and music lovers discover, share, and promote events with advanced features like web scraping, moderation workflows, and festival support.

![Artist Events Platform](https://img.shields.io/badge/Astro-5.10.0-FF5D01?style=for-the-badge&logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

## ✨ Features

### 🎯 **Core Functionality**
- **Event Discovery**: Browse and search events with advanced filtering
- **Event Submission**: Public event submission with moderation workflow
- **Event Pages**: Dynamic event pages with rich content and social sharing
- **Search & Filter**: Full-text search with genre, date, location, and tag filters
- **Responsive Design**: Beautiful, modern UI optimized for all devices

### 🚀 **Advanced Features**
- **Web Scraping**: Automated event collection from venue websites and social media
- **Moderation System**: Admin workflow for reviewing and approving events
- **Festival Support**: Multi-day events with sub-events and complex scheduling
- **User Management**: Role-based access control (admin, moderator, editor, user)
- **Duplicate Detection**: AI-powered duplicate event identification
- **Change Tracking**: Complete audit logs for all event modifications

### 📊 **Database & Performance**
- **PostgreSQL Database**: Scalable relational database with optimized queries
- **Full-Text Search**: Advanced search capabilities with indexing
- **Connection Pooling**: Optimized database connections for performance
- **Data Migration**: Tools to convert existing JSON data to database

## 🏗️ Architecture

### **Frontend**
- **Astro 5.10.0**: Static site generation with dynamic capabilities
- **TypeScript**: Type-safe development
- **Vanilla CSS**: Custom styling with CSS variables and modern features
- **Progressive Enhancement**: Works without JavaScript, enhanced with it

### **Backend**
- **API Routes**: Server-side functionality with Astro API routes
- **PostgreSQL**: Robust database with 14+ interconnected tables
- **Node.js**: Server-side runtime for scraping and processing

### **Database Schema**
```
events ──┬── venues (many-to-one)
         ├── event_artists ── artists (many-to-many)
         ├── event_tags ── tags (many-to-many)
         ├── sub_events (one-to-many)
         └── event_sources (many-to-one)
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **PostgreSQL 14+**
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/artist-events.git
   cd artist-events
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb artist_events
   
   # Run schema
   psql -d artist_events -f database/schema.sql
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Migrate existing data (optional)**
   ```bash
   node database/migrate-from-json.js
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:4321` to see the application.

## 📁 Project Structure

```
artist-events/
├── src/
│   ├── pages/
│   │   ├── index.astro          # Homepage with featured events
│   │   ├── search.astro         # Advanced search page
│   │   ├── submit.astro         # Event submission form
│   │   ├── events/
│   │   │   ├── index.astro      # All events listing
│   │   │   └── [slug].astro     # Individual event pages
│   │   └── api/
│   │       └── save-event.ts    # Event submission API
│   ├── components/              # Reusable components
│   └── styles/                  # CSS stylesheets
├── database/
│   ├── schema.sql              # Complete database schema
│   ├── migrate-from-json.js    # Migration script
│   └── README.md               # Database setup guide
├── lib/
│   └── database.js             # Database utility functions
├── data/
│   └── events.json             # Legacy JSON data
└── public/                     # Static assets
```

## 🗄️ Database Features

### **Core Tables**
- `users` - Authentication and user management
- `venues` - Event locations with geographic data
- `artists` - Performer database with social links
- `events` - Enhanced events with scheduling and metadata
- `tags` - Flexible categorization system

### **Advanced Tables**
- `event_sources` - Websites/APIs to monitor
- `scrape_jobs` - Background scraping queue
- `scraped_events_raw` - Raw data before processing
- `event_submissions` - Public submissions workflow
- `event_history` - Complete change tracking

### **Performance Features**
- Full-text search indexes on events, venues, and artists
- Optimized queries for filtering and pagination
- Connection pooling for scalability
- Automated timestamp updates

## 🔧 API Usage

### **Get Published Events**
```javascript
import { getPublishedEvents } from './lib/database.js';

const events = await getPublishedEvents();
```

### **Search Events**
```javascript
import { searchEvents } from './lib/database.js';

const results = await searchEvents({
  query: 'jazz',
  genre: 'Jazz',
  date_from: '2024-01-01'
});
```

### **Create Event**
```javascript
import { createEvent } from './lib/database.js';

const eventId = await createEvent({
  title: 'Amazing Jazz Night',
  start_date: '2024-03-15',
  venue_id: 1,
  artists: [{ name: 'Miles Davis Tribute' }],
  status: 'published'
});
```

## 🌐 Deployment

### **Vercel (Recommended)**
```bash
npm install -g vercel
vercel --prod
```

### **Netlify**
```bash
npm run build
# Deploy dist/ folder to Netlify
```

### **Self-hosted**
```bash
npm run build
# Serve dist/ folder with any static file server
```

## 🛠️ Development

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run astro        # Run Astro CLI commands
```

### **Database Commands**
```bash
# Backup database
pg_dump artist_events > backup.sql

# Restore database
psql artist_events < backup.sql

# Run migrations
node database/migrate-from-json.js
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

## 📚 Documentation

- [Database Setup Guide](database/README.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## 🔮 Roadmap

### **Phase 1: Web Scraping** (Current)
- [ ] Venue website scrapers
- [ ] Social media integration
- [ ] AI-powered data normalization
- [ ] Source management dashboard

### **Phase 2: Enhanced Features**
- [ ] User authentication system
- [ ] Event recommendations
- [ ] Social media automation
- [ ] Mobile app development

### **Phase 3: Analytics & Insights**
- [ ] Event analytics dashboard
- [ ] Attendance tracking
- [ ] Venue performance metrics
- [ ] Artist popularity insights

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Astro](https://astro.build/)
- Database powered by [PostgreSQL](https://www.postgresql.org/)
- Styled with modern CSS and design inspiration from contemporary music platforms

---

**Made with ❤️ for the music community**

For questions, issues, or feature requests, please open an issue on GitHub.
