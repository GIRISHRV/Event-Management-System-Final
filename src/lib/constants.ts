export const STORAGE_BUCKETS = {
  EVENT_BANNERS: 'event-banners',
} as const;

export const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const VISIBILITY_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  WHITELIST: 'whitelist',
} as const;

export const VENUE_TYPES = {
  INDOOR: 'indoor',
  OUTDOOR: 'outdoor',
  HYBRID: 'hybrid',
} as const;

export const DEFAULT_COORDINATES = {
  // Default to India (central location)
  lat: 20.5937,
  lng: 78.9629,
};
