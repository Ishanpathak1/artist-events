# Advanced Event Aggregation System

A sophisticated multi-source event aggregation platform with ML-based deduplication, real-time sync, and intelligent location filtering.

## 🎯 Features

### Core Capabilities
- **Multi-Source Integration**: Support for API, webhook, and scraper-based sources
- **ML-Based Deduplication**: Advanced machine learning algorithms to identify and merge duplicate events
- **Real-Time Sync**: Webhook-based real-time updates from event platforms
- **Location Intelligence**: Smart geocoding and location-based filtering
- **Admin Dashboard**: Comprehensive management interface

### Supported Event Sources
- **Eventbrite**: Full API integration with real-time webhooks
- **Meetup**: API-based event discovery and synchronization
- **Facebook Events**: Webhook integration for page events
- **Custom Sources**: Extensible framework for adding new sources

### ML & Intelligence Features
- **Duplicate Detection**: Semantic similarity analysis using NLP
- **Event Categorization**: Automatic categorization based on content analysis
- **Location Matching**: Intelligent venue matching and geocoding
- **Confidence Scoring**: ML confidence metrics for all processed events

## 🛠️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin UI      │    │   Webhook       │    │   Scheduler     │
│   Dashboard     │    │   Server        │    │   (Cron Jobs)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────────┐
         │              Event Aggregator                       │
         │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
         │  │     ML      │  │  Location   │  │   Source    │ │
         │  │  Pipeline   │  │Intelligence │  │  Adapters   │ │
         │  └─────────────┘  └─────────────┘  └─────────────┘ │
         └─────────────────────────────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────────┐
         │                  Database                           │
         │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
         │  │   Events    │  │  Locations  │  │ Event       │ │
         │  │             │  │             │  │ Sources     │ │
         │  └─────────────┘  └─────────────┘  └─────────────┘ │
         └─────────────────────────────────────────────────────┘
```

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (Neon recommended)
- API keys for event sources (optional)

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Database
   NEON_DATABASE_URL=postgresql://user:pass@host/db
   
   # API Keys (optional)
   EVENTBRITE_API_KEY=your_eventbrite_key
   MEETUP_API_KEY=your_meetup_key
   FACEBOOK_VERIFY_TOKEN=your_facebook_token
   
   # Geocoding (choose one)
   GOOGLE_MAPS_API_KEY=your_google_key
   MAPBOX_API_KEY=your_mapbox_key
   
   # Webhook Server
   WEBHOOK_PORT=3001
   ```

3. **Database Schema**
   The system will automatically initialize the database schema on first run.

4. **Start the System**
   ```bash
   npm run start:aggregation
   ```

## 🚀 Usage

### Starting the System
```bash
# Start the complete aggregation system
npm run start:aggregation

# Check system status
npm run aggregation:status

# Run manual sync
npm run aggregation:sync

# Train ML models
npm run aggregation:train
```

### Admin Dashboard
Access the admin dashboard at: `http://localhost:3000/admin/aggregation`

#### Dashboard Features
- **Overview Stats**: Total events, active sources, duplicates detected
- **Source Management**: Add, edit, enable/disable event sources
- **Sync Jobs**: Monitor scheduled and manual synchronization tasks
- **Duplicate Review**: Review and manage detected duplicates
- **ML Models**: Monitor model performance and trigger retraining
- **Webhook Events**: Monitor real-time webhook processing

### API Endpoints

#### Webhook Endpoints
```bash
# Health check
GET /health

# Event source webhooks
POST /webhook/eventbrite
POST /webhook/facebook  
POST /webhook/meetup
POST /webhook/:sourceId

# Management endpoints
GET /webhook/stats
GET /webhook/events/unprocessed
POST /webhook/events/:eventId/retry
```

#### Admin API Endpoints
```bash
# Aggregation stats
GET /api/admin/aggregation/stats

# Source management
GET /api/admin/aggregation/sources
POST /api/admin/aggregation/sources
PUT /api/admin/aggregation/sources/:id
DELETE /api/admin/aggregation/sources/:id

# Manual sync
POST /api/admin/aggregation/sync
POST /api/admin/aggregation/sync/:sourceId

# Duplicate management
GET /api/admin/aggregation/duplicates
POST /api/admin/aggregation/duplicates/:id/confirm
POST /api/admin/aggregation/duplicates/:id/reject
```

## 🤖 Machine Learning

### Deduplication Pipeline
1. **Text Preprocessing**: Clean and normalize event titles/descriptions
2. **Feature Extraction**: TF-IDF vectorization and semantic embeddings
3. **Similarity Calculation**: Cosine similarity and Levenshtein distance
4. **Classification**: ML model predicts duplicate probability
5. **Threshold Filtering**: Configurable confidence thresholds

### Location Intelligence
1. **Geocoding**: Multi-provider geocoding (Google, Mapbox, OpenStreetMap)
2. **Venue Matching**: Fuzzy matching for similar venue names
3. **Radius Calculation**: Dynamic radius based on area density
4. **Smart Filtering**: Location-based event recommendations

### Model Training
```bash
# Train all models
npm run aggregation:train

# Models are automatically retrained:
# - Deduplication: Daily at 2 AM
# - Categorization: Weekly on Sunday at 3 AM
```

## 🔧 Configuration

### Adding Event Sources

#### API Sources
```javascript
{
  "name": "Custom API Source",
  "type": "api",
  "base_url": "https://api.example.com",
  "sync_frequency": 60,
  "config": {
    "endpoints": {
      "events": "/events",
      "venues": "/venues"
    },
    "rate_limit": 1000,
    "api_key_header": "X-API-Key"
  }
}
```

#### Webhook Sources
```javascript
{
  "name": "Custom Webhook Source", 
  "type": "webhook",
  "webhook_secret": "your_secret_key",
  "config": {
    "verify_signature": true,
    "signature_header": "X-Webhook-Signature"
  }
}
```

### Sync Frequencies
- **5-15 minutes**: High-priority sources
- **30-60 minutes**: Standard sources  
- **2-6 hours**: Low-priority sources

### ML Model Configuration
```javascript
{
  "deduplication": {
    "similarity_threshold": 0.85,
    "features": ["title", "description", "location", "date"],
    "algorithms": ["tfidf", "cosine", "levenshtein"]
  },
  "categorization": {
    "categories": ["music", "arts", "business", "food", "sports"],
    "min_confidence": 0.7
  }
}
```

## 📊 Monitoring

### System Metrics
- **Event Processing Rate**: Events processed per hour
- **Duplicate Detection Rate**: Percentage of duplicates detected
- **ML Confidence Scores**: Average confidence across models
- **Sync Success Rate**: Percentage of successful syncs
- **Webhook Processing**: Real-time webhook metrics

### Logs and Alerts
- **Application Logs**: Structured logging with timestamps
- **Error Tracking**: Automatic error capture and reporting
- **Performance Metrics**: Response times and throughput
- **Health Checks**: Automated system health monitoring

## 🔒 Security

### Webhook Security
- **Signature Verification**: HMAC signature validation
- **Rate Limiting**: Configurable rate limits per source
- **IP Allowlisting**: Restrict webhook sources by IP
- **SSL/TLS**: Encrypted webhook endpoints

### Data Protection
- **API Key Encryption**: Encrypted storage of API credentials
- **Access Control**: Admin-only access to sensitive endpoints
- **Data Sanitization**: Input validation and sanitization
- **GDPR Compliance**: User data protection and deletion

## 🚨 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check database connectivity
psql $NEON_DATABASE_URL -c "SELECT 1"
```

#### Webhook Issues
```bash
# Check webhook server health
curl http://localhost:3001/health

# View unprocessed webhooks
curl http://localhost:3001/webhook/events/unprocessed
```

#### ML Model Issues
```bash
# Check model status
npm run aggregation:status

# Retrain models
npm run aggregation:train
```

### Performance Optimization

#### Database Optimization
- **Indexing**: Ensure proper indexes on frequently queried columns
- **Connection Pooling**: Configure optimal pool size
- **Query Optimization**: Monitor slow queries

#### Memory Management
- **Cache Management**: Clear old cache entries regularly
- **Memory Monitoring**: Monitor Node.js memory usage
- **Process Limits**: Configure appropriate process limits

## 📈 Scaling

### Horizontal Scaling
- **Multiple Workers**: Run multiple aggregation processes
- **Load Balancing**: Distribute webhook processing
- **Database Sharding**: Shard events by date or region

### Vertical Scaling
- **Memory Allocation**: Increase Node.js memory limit
- **CPU Optimization**: Optimize CPU-intensive ML operations
- **Database Resources**: Scale database compute and storage

## 🤝 Contributing

### Development Setup
```bash
# Clone repository
git clone <repository>

# Install dependencies
npm install

# Start development server
npm run dev

# Start aggregation system
npm run start:aggregation
```

### Adding New Sources
1. Create source adapter in `src/services/adapters/`
2. Add normalization logic
3. Configure webhook endpoints (if applicable)
4. Add tests and documentation

### ML Model Improvements
1. Experiment with new algorithms
2. Tune hyperparameters
3. Add feature engineering
4. Validate performance improvements

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs and feature requests
- **Community**: Join our Discord server for discussions

---

## 🎉 Success! 

Your advanced event aggregation system is now ready to discover, deduplicate, and intelligently organize events from across the web! 

### Next Steps:
1. **Add API Keys**: Configure your preferred event source APIs
2. **Set Up Webhooks**: Register webhook endpoints with event platforms  
3. **Train Models**: Let the ML models learn from your event data
4. **Monitor Performance**: Use the admin dashboard to track system health
5. **Scale Up**: Add more sources and fine-tune the algorithms

Happy event aggregating! 🎯✨ 