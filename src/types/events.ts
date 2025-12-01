import { EventScheduleData, EventPerformerData, EventFAQData } from "@/lib/supabase-types";

export interface AIEventData {
  basicInfo?: {
    eventName?: string;
    eventDescription?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    organizerName?: string;
    organizerContact?: string;
    maxAttendees?: number | string;
    venueType?: 'indoor' | 'outdoor' | 'hybrid';
  };
  venue?: {
    venueName?: string;
    venueAddress?: string;
    venueCity?: string;
    venueLandmark?: string;
    latitude?: number;
    longitude?: number;
    googleMapsUrl?: string;
  };
  schedules?: EventScheduleData[];
  performers?: EventPerformerData[];
  faqs?: EventFAQData[];
}

export interface EventFormData {
  eventName: string;
  eventDescription: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
  eventBannerUrl: string;
  visibilityType: 'public' | 'private' | 'whitelist';
  maxAttendees: string;
  organizerName: string;
  organizerContact: string;
  eventStatus: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  venueName: string;
  venueAddress: string;
  venueCity: string;
  venueLandmark: string;
  venueType: 'indoor' | 'outdoor' | 'hybrid';
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
  galleryImages: string[];
  galleryVideos: string[];
  schedules: EventScheduleData[];
  performers: EventPerformerData[];
  faqs: EventFAQData[];
}

export type FormTab = 'basic' | 'venue' | 'schedule-lineup' | 'gallery' | 'faqs';
