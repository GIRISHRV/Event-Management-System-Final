# Venue Coordinates Implementation

## Overview
Added latitude and longitude initialization to events for map visualization. The system uses city-based geocoding to automatically populate coordinates based on venue cities.

## Changes Made

### 1. **Seed Script Update**
**File:** `supabase/migrations/seed_full_demo.sql`

**Changes:**
- Added `get_city_latitude()` and `get_city_longitude()` helper functions
- Modified event INSERT to include `venue_latitude` and `venue_longitude` columns
- Coordinates are automatically set based on the event's `venue_city` using city center coordinates
- Covers all 50+ Indian cities in the system

**Benefits:**
- All new events from seed script have map-ready coordinates
- Uses city centers as fallback when specific venue coordinates are unavailable
- No manual geocoding required during seeding

### 2. **Backfill Migration**
**File:** `supabase/migrations/20250506_backfill_event_coordinates.sql`

**Purpose:**
- Updates all existing events in the database with coordinates
- Adds the same helper functions (idempotent - won't fail if they already exist)
- Only updates events that have `venue_city` set but missing `venue_latitude`/`venue_longitude`

**How to Run:**
```bash
supabase migration up
# or manually in Supabase SQL editor:
# SELECT * FROM postgres_migrations WHERE name = '20250506_backfill_event_coordinates';
```

## City Coordinates Covered

The system includes coordinates for 50+ Indian cities:
- **Major metros:** Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata
- **Tier 2 cities:** Pune, Ahmedabad, Jaipur, Surat, Lucknow, Kanpur, etc.
- **Tier 3 cities:** Nashik, Rajkot, Varanasi, Coimbatore, Kochi, etc.
- **Fallback:** Uses India center coordinates (20.5937°N, 78.9629°E)

## Implementation Details

### Helper Functions
```sql
get_city_latitude(city TEXT) RETURNS FLOAT
get_city_longitude(city TEXT) RETURNS FLOAT
```

These functions:
- Accept a city name as input
- Return the latitude/longitude of that city's center
- Use IMMUTABLE tag for query optimization
- Fallback to India center if city not found

### Database Schema
Events table now includes:
```sql
venue_latitude  FLOAT   -- NULL for events without location
venue_longitude FLOAT   -- NULL for events without location
```

## Usage in Frontend

### Individual Event Page
```typescript
<EventMap event={event} />
// Shows map if venue_latitude && venue_longitude are set
// Otherwise displays "No location set" message
```

### Dashboard Map View
```typescript
{viewMode === "map" && (
  <EventMap 
    event={primaryEvent}
    nearbyEvents={allEvents}
  />
)}
// Aggregates all events with coordinates
// Auto-fits view to show all markers
```

## Quality Assurance

### Verify Coordinates After Backfill
```sql
-- Check how many events now have coordinates
SELECT COUNT(*) as events_with_coords
FROM events
WHERE venue_latitude IS NOT NULL
  AND venue_longitude IS NOT NULL;

-- See which cities don't have coordinates
SELECT DISTINCT venue_city, COUNT(*) as count
FROM events
WHERE venue_latitude IS NULL OR venue_longitude IS NULL
ORDER BY count DESC;
```

### Sample Events to Test
```sql
-- Find an event with coordinates
SELECT id, event_name, venue_city, venue_latitude, venue_longitude
FROM events
WHERE venue_latitude IS NOT NULL
LIMIT 5;
```

## Future Enhancements

### 1. **Precise Venue Geocoding**
- Replace city centers with actual venue addresses
- Integrate with Google Maps API or OpenStreetMap Nominatim
- Store `venue_address` and geocode it via API

### 2. **UI for Setting Coordinates**
- Add address input field in event form
- Real-time geocoding as user types
- Visual map picker to set exact location

### 3. **Nearby Events Search**
- Use PostGIS for geographic queries
- Find events within X km radius
- Distance-based recommendations

### 4. **Map Customization**
- Add custom markers for event categories
- Event clustering for density visualization
- Heat maps showing popular event areas

## Files Modified

```
supabase/migrations/
  ├─ seed_full_demo.sql (updated: added functions and coordinates)
  └─ 20250506_backfill_event_coordinates.sql (new: backfill script)

src/components/events/
  └─ EventMap.tsx (updated: handles multiple events better)

src/app/event/[id]/
  └─ page.tsx (updated: added EventMap display)
```

## Troubleshooting

### Map Not Showing
1. Verify `venue_latitude` and `venue_longitude` are not NULL
   ```sql
   SELECT venue_latitude, venue_longitude FROM events WHERE id = 'xxx';
   ```
2. Check browser console for errors
3. Verify Leaflet CSS is loading (check Network tab)

### Events Not Displaying on Map
1. Ensure multiple events have coordinates
2. Check if coordinates are within expected ranges (India: ~8°N-35°N, 68°E-97°E)
3. Verify `nearbyEvents` array is being populated

### Backfill Didn't Update Events
1. Check if the migration ran successfully
   ```sql
   SELECT * FROM postgres_migrations;
   ```
2. Verify events have `venue_city` set
3. Run backfill manually in SQL editor if needed

## Related Documentation

- [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) - Full schema reference
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture overview
- [EventMap Component](src/components/events/EventMap.tsx) - Component implementation
