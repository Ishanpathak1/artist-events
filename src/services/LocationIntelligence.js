import { Pool } from 'pg';

/**
 * Location Intelligence Service
 * Provides advanced location-based filtering and geocoding capabilities
 */
export class LocationIntelligence {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });

        // Cache for geocoding results
        this.geocodingCache = new Map();
        this.venueCache = new Map();
        
        // API keys and configuration
        this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.mapboxApiKey = process.env.MAPBOX_API_KEY;
        this.useMapbox = !!this.mapboxApiKey;
    }

    /**
     * Find or create location record with intelligent matching
     */
    async findOrCreateLocation(venueName, address, city = null, state = null) {
        const client = await this.pool.connect();
        try {
            // Try to find existing location first
            let location = await this.findExistingLocation(venueName, address, city, state);
            
            if (location) {
                return location;
            }

            // Geocode the address
            const geoData = await this.geocodeAddress(address, city, state);
            
            if (!geoData.latitude || !geoData.longitude) {
                console.warn(`Failed to geocode address: ${address}`);
                return null;
            }

            // Check for nearby venues (within 100m)
            const nearbyVenues = await this.findNearbyVenues(
                geoData.latitude, 
                geoData.longitude, 
                0.1 // 100m
            );

            // Try to match with existing venue
            for (const venue of nearbyVenues) {
                const similarity = this.calculateVenueSimilarity(venueName, venue.name);
                if (similarity > 0.8) {
                    // Update existing venue with new information
                    await this.updateLocationWithGeoData(venue.id, geoData);
                    return venue;
                }
            }

            // Create new location
            const result = await client.query(`
                INSERT INTO locations (
                    name, address, city, state, country, postal_code,
                    latitude, longitude, timezone, venue_type, external_ids
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                venueName,
                geoData.formatted_address || address,
                geoData.city,
                geoData.state,
                geoData.country,
                geoData.postal_code,
                geoData.latitude,
                geoData.longitude,
                geoData.timezone,
                await this.classifyVenueType(venueName, address),
                JSON.stringify(geoData.external_ids || {})
            ]);

            location = result.rows[0];
            
            // Cache the result
            this.venueCache.set(`${venueName}_${address}`, location);
            
            return location;
            
        } finally {
            client.release();
        }
    }

    /**
     * Advanced geocoding with multiple providers
     */
    async geocodeAddress(address, city = null, state = null) {
        // Create cache key
        const fullAddress = [address, city, state].filter(Boolean).join(', ');
        const cacheKey = fullAddress.toLowerCase();
        
        if (this.geocodingCache.has(cacheKey)) {
            return this.geocodingCache.get(cacheKey);
        }

        try {
            let geoData;
            
            if (this.useMapbox) {
                geoData = await this.geocodeWithMapbox(fullAddress);
            } else if (this.googleMapsApiKey) {
                geoData = await this.geocodeWithGoogle(fullAddress);
            } else {
                // Fallback to free service (with rate limiting)
                geoData = await this.geocodeWithOpenStreetMap(fullAddress);
            }

            // Cache the result
            this.geocodingCache.set(cacheKey, geoData);
            
            return geoData;
            
        } catch (error) {
            console.error('Geocoding error:', error);
            return { latitude: null, longitude: null };
        }
    }

    /**
     * Mapbox geocoding (recommended for production)
     */
    async geocodeWithMapbox(address) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${this.mapboxApiKey}&types=address,poi&limit=1`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const [longitude, latitude] = feature.center;
            
            return {
                latitude,
                longitude,
                formatted_address: feature.place_name,
                city: this.extractPlaceComponent(feature.context, 'place'),
                state: this.extractPlaceComponent(feature.context, 'region'),
                country: this.extractPlaceComponent(feature.context, 'country'),
                postal_code: this.extractPlaceComponent(feature.context, 'postcode'),
                timezone: await this.getTimezone(latitude, longitude),
                external_ids: {
                    mapbox_id: feature.id
                }
            };
        }
        
        throw new Error('No results found');
    }

    /**
     * Google Maps geocoding
     */
    async geocodeWithGoogle(address) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.googleMapsApiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results.length > 0) {
            const result = data.results[0];
            const location = result.geometry.location;
            
            return {
                latitude: location.lat,
                longitude: location.lng,
                formatted_address: result.formatted_address,
                city: this.extractGoogleComponent(result.address_components, 'locality'),
                state: this.extractGoogleComponent(result.address_components, 'administrative_area_level_1'),
                country: this.extractGoogleComponent(result.address_components, 'country'),
                postal_code: this.extractGoogleComponent(result.address_components, 'postal_code'),
                timezone: await this.getTimezone(location.lat, location.lng),
                external_ids: {
                    google_place_id: result.place_id
                }
            };
        }
        
        throw new Error('Geocoding failed');
    }

    /**
     * OpenStreetMap/Nominatim geocoding (free fallback)
     */
    async geocodeWithOpenStreetMap(address) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Artist-Events-Platform/1.0'
            }
        });
        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            
            return {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                formatted_address: result.display_name,
                city: result.address?.city || result.address?.town || result.address?.village,
                state: result.address?.state,
                country: result.address?.country,
                postal_code: result.address?.postcode,
                timezone: await this.getTimezone(parseFloat(result.lat), parseFloat(result.lon)),
                external_ids: {
                    osm_id: result.osm_id
                }
            };
        }
        
        throw new Error('No results found');
    }

    /**
     * Location-based event filtering with intelligent radius
     */
    async findEventsNearLocation(latitude, longitude, radiusKm = 50, filters = {}) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT e.*, l.name as location_name, l.latitude, l.longitude,
                       ST_Distance(
                           ST_Point($1, $2)::geography,
                           ST_Point(l.longitude, l.latitude)::geography
                       ) / 1000 as distance_km
                FROM events e
                LEFT JOIN locations l ON e.location_id = l.id
                WHERE ST_DWithin(
                    ST_Point($1, $2)::geography,
                    ST_Point(l.longitude, l.latitude)::geography,
                    $3 * 1000  -- Convert km to meters
                )
            `;
            
            const params = [longitude, latitude, radiusKm];
            let paramIndex = 4;

            // Add filters
            if (filters.startDate) {
                query += ` AND e.start_date >= $${paramIndex}`;
                params.push(filters.startDate);
                paramIndex++;
            }

            if (filters.endDate) {
                query += ` AND e.start_date <= $${paramIndex}`;
                params.push(filters.endDate);
                paramIndex++;
            }

            if (filters.category) {
                query += ` AND e.category = $${paramIndex}`;
                params.push(filters.category);
                paramIndex++;
            }

            if (filters.venueType) {
                query += ` AND l.venue_type = $${paramIndex}`;
                params.push(filters.venueType);
                paramIndex++;
            }

            if (filters.minConfidence) {
                query += ` AND e.confidence_score >= $${paramIndex}`;
                params.push(filters.minConfidence);
                paramIndex++;
            }

            query += ` ORDER BY distance_km ASC, e.start_date ASC LIMIT $${paramIndex}`;
            params.push(filters.limit || 100);

            const result = await client.query(query, params);
            return result.rows;
            
        } finally {
            client.release();
        }
    }

    /**
     * Intelligent venue type classification
     */
    async classifyVenueType(venueName, address) {
        const text = `${venueName} ${address}`.toLowerCase();
        
        // Define venue type patterns
        const patterns = {
            'theater': ['theater', 'theatre', 'playhouse', 'opera house', 'concert hall'],
            'arena': ['arena', 'stadium', 'coliseum', 'center', 'centre'],
            'club': ['club', 'bar', 'lounge', 'pub', 'tavern'],
            'restaurant': ['restaurant', 'cafe', 'bistro', 'eatery', 'diner'],
            'gallery': ['gallery', 'museum', 'art', 'exhibition'],
            'outdoor': ['park', 'beach', 'outdoor', 'garden', 'field'],
            'hotel': ['hotel', 'resort', 'inn', 'lodge'],
            'church': ['church', 'cathedral', 'chapel', 'temple'],
            'school': ['school', 'university', 'college', 'academy'],
            'library': ['library', 'bookstore'],
            'conference': ['conference', 'convention', 'meeting']
        };

        for (const [type, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return type;
            }
        }

        return 'venue'; // Default type
    }

    /**
     * Smart radius calculation based on location density
     */
    async getSmartRadius(latitude, longitude, baseRadius = 50) {
        const client = await this.pool.connect();
        try {
            // Count venues within base radius
            const result = await client.query(`
                SELECT COUNT(*) as venue_count
                FROM locations
                WHERE ST_DWithin(
                    ST_Point($1, $2)::geography,
                    ST_Point(longitude, latitude)::geography,
                    $3 * 1000
                )
            `, [longitude, latitude, baseRadius]);

            const venueCount = parseInt(result.rows[0].venue_count);
            
            // Adjust radius based on density
            if (venueCount > 100) {
                return Math.max(baseRadius * 0.5, 10); // Dense area, smaller radius
            } else if (venueCount < 10) {
                return Math.min(baseRadius * 2, 200); // Sparse area, larger radius
            }
            
            return baseRadius; // Normal density
            
        } finally {
            client.release();
        }
    }

    /**
     * Generate location-based recommendations
     */
    async getLocationRecommendations(userId, latitude, longitude, preferences = {}) {
        const client = await this.pool.connect();
        try {
            // Get user's past event preferences
            const userHistory = await client.query(`
                SELECT e.category, l.venue_type, COUNT(*) as frequency
                FROM events e
                JOIN event_registrations er ON e.id = er.event_id
                LEFT JOIN locations l ON e.location_id = l.id
                WHERE er.user_id = $1
                GROUP BY e.category, l.venue_type
                ORDER BY frequency DESC
            `, [userId]);

            // Calculate smart radius
            const smartRadius = await this.getSmartRadius(latitude, longitude, preferences.radius || 50);
            
            // Find events with personalized scoring
            const events = await this.findEventsNearLocation(latitude, longitude, smartRadius, {
                startDate: preferences.startDate || new Date().toISOString(),
                category: preferences.category,
                venueType: preferences.venueType,
                minConfidence: preferences.minConfidence || 0.7,
                limit: preferences.limit || 50
            });

            // Score events based on user preferences
            const scoredEvents = events.map(event => {
                let personalizedScore = event.confidence_score || 0.5;
                
                // Boost based on user history
                const categoryMatch = userHistory.rows.find(h => h.category === event.category);
                if (categoryMatch) {
                    personalizedScore += 0.2 * Math.min(categoryMatch.frequency / 10, 1);
                }
                
                const venueMatch = userHistory.rows.find(h => h.venue_type === event.venue_type);
                if (venueMatch) {
                    personalizedScore += 0.1 * Math.min(venueMatch.frequency / 5, 1);
                }
                
                // Distance penalty (closer is better)
                const distancePenalty = Math.min(event.distance_km / smartRadius, 1) * 0.2;
                personalizedScore -= distancePenalty;
                
                return {
                    ...event,
                    personalized_score: Math.max(0, Math.min(1, personalizedScore))
                };
            });

            // Sort by personalized score
            scoredEvents.sort((a, b) => b.personalized_score - a.personalized_score);
            
            return scoredEvents;
            
        } finally {
            client.release();
        }
    }

    /**
     * Utility functions
     */
    
    async findExistingLocation(venueName, address, city, state) {
        const client = await this.pool.connect();
        try {
            // Try exact match first
            let result = await client.query(`
                SELECT * FROM locations 
                WHERE LOWER(name) = LOWER($1) 
                AND LOWER(address) LIKE LOWER($2)
            `, [venueName, `%${address}%`]);

            if (result.rows.length > 0) {
                return result.rows[0];
            }

            // Try fuzzy match with city/state
            if (city && state) {
                result = await client.query(`
                    SELECT * FROM locations 
                    WHERE LOWER(name) = LOWER($1) 
                    AND LOWER(city) = LOWER($2)
                    AND LOWER(state) = LOWER($3)
                `, [venueName, city, state]);

                if (result.rows.length > 0) {
                    return result.rows[0];
                }
            }

            return null;
        } finally {
            client.release();
        }
    }

    async findNearbyVenues(latitude, longitude, radiusKm) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT *, 
                       ST_Distance(
                           ST_Point($1, $2)::geography,
                           ST_Point(longitude, latitude)::geography
                       ) / 1000 as distance_km
                FROM locations
                WHERE ST_DWithin(
                    ST_Point($1, $2)::geography,
                    ST_Point(longitude, latitude)::geography,
                    $3 * 1000
                )
                ORDER BY distance_km ASC
            `, [longitude, latitude, radiusKm]);

            return result.rows;
        } finally {
            client.release();
        }
    }

    calculateVenueSimilarity(name1, name2) {
        const cleanName1 = name1.toLowerCase().replace(/[^\w\s]/g, '');
        const cleanName2 = name2.toLowerCase().replace(/[^\w\s]/g, '');
        
        // Levenshtein distance based similarity
        const distance = this.levenshteinDistance(cleanName1, cleanName2);
        const maxLength = Math.max(cleanName1.length, cleanName2.length);
        
        return 1 - (distance / maxLength);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    async getTimezone(latitude, longitude) {
        try {
            // Use a timezone API or calculate based on longitude
            // For now, return a basic calculation
            const timezoneOffset = Math.round(longitude / 15);
            return `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;
        } catch (error) {
            return 'UTC';
        }
    }

    extractPlaceComponent(context, type) {
        if (!context) return null;
        const component = context.find(c => c.id && c.id.includes(type));
        return component ? component.text : null;
    }

    extractGoogleComponent(components, type) {
        const component = components.find(c => c.types.includes(type));
        return component ? component.long_name : null;
    }

    async updateLocationWithGeoData(locationId, geoData) {
        const client = await this.pool.connect();
        try {
            await client.query(`
                UPDATE locations 
                SET latitude = $1, longitude = $2, timezone = $3,
                    external_ids = COALESCE(external_ids, '{}') || $4,
                    updated_at = NOW()
                WHERE id = $5
            `, [
                geoData.latitude,
                geoData.longitude,
                geoData.timezone,
                JSON.stringify(geoData.external_ids || {}),
                locationId
            ]);
        } finally {
            client.release();
        }
    }
}

export default LocationIntelligence; 