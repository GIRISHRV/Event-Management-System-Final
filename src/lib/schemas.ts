import { z } from 'zod';

export const eventSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  eventDescription: z.string().min(10, "Description must be at least 10 characters"),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().min(1, "End time is required"),
  timezone: z.string().default("UTC"),
  eventBannerUrl: z.string().optional().or(z.literal('')),
  visibilityType: z.enum(['public', 'private', 'whitelist']),
  maxAttendees: z.string().optional(),
  organizerName: z.string().min(1, "Organizer name is required"),
  organizerContact: z.string().min(1, "Contact info is required"),
  eventStatus: z.enum(['upcoming', 'ongoing', 'completed', 'cancelled']),
  
  // Venue
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  venueCity: z.string().optional(),
  venueLandmark: z.string().optional(),
  venueType: z.enum(['indoor', 'outdoor', 'hybrid']),
  latitude: z.number().nullable().refine((val) => val !== null, {
    message: "Please select a location on the map",
  }),
  longitude: z.number().nullable(),
  googleMapsUrl: z.string().optional(),

  // Arrays
  galleryImages: z.array(z.string()),
  galleryVideos: z.array(z.string()),
  
  schedules: z.array(z.object({
    day_number: z.number(),
    start_time: z.string(),
    end_time: z.string(),
    title: z.string(),
    description: z.string(),
    location: z.string(),
  })),
  
  performers: z.array(z.object({
    name: z.string(),
    bio: z.string().optional(),
    image_url: z.string().optional(),
    performer_type: z.enum(['artist', 'speaker', 'chef', 'performer', 'other']),
    social_links: z.record(z.string(), z.string()).optional(),
  })),
  
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    display_order: z.number(),
  })),
}).refine((data) => {
  if (!data.startDate || !data.startTime || !data.endDate || !data.endTime) return true;
  const start = new Date(`${data.startDate}T${data.startTime}`);
  const end = new Date(`${data.endDate}T${data.endTime}`);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

export type EventFormSchema = z.infer<typeof eventSchema>;
