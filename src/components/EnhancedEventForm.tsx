import { useState, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { X, Upload, Plus, MapPin, Settings, Clock, FileText, HelpCircle, Star, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Event, CreateEventInput, EventScheduleData, EventPerformerData, EventVendorData, EventFAQData } from "@/lib/supabase-types";

// Dynamically import the map component to avoid SSR issues
const OpenMapLocationPicker = dynamic(
  () => import('./OpenMapLocationPicker').then(mod => ({ default: mod.OpenMapLocationPicker })),
  { 
    ssr: false,
    loading: () => (
      <div className="h-64 bg-zinc-800 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-zinc-400">Loading map...</span>
      </div>
    )
  }
);

interface EnhancedEventFormProps {
  event?: Event;
  onSubmit: (data: CreateEventInput) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  userEmail?: string;
}

type FormTab = 'basic' | 'venue' | 'schedule' | 'lineup' | 'policies' | 'faqs';

export function EnhancedEventForm({
  event,
  onSubmit,
  onClose,
  isLoading = false,
  userEmail,
}: EnhancedEventFormProps) {
  const [currentTab, setCurrentTab] = useState<FormTab>('basic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Basic Information State
  const [eventName, setEventName] = useState(event?.event_name || "");
  const [eventDescription, setEventDescription] = useState(event?.event_description || "");
  const [startDate, setStartDate] = useState(event?.start_date || "");
  const [startTime, setStartTime] = useState(event?.start_time || "");
  const [endDate, setEndDate] = useState(event?.end_date || "");
  const [endTime, setEndTime] = useState(event?.end_time || "");
  const [timezone, setTimezone] = useState(event?.timezone || "UTC");
  const [eventBannerUrl, setEventBannerUrl] = useState(event?.event_banner_url || "");
  const [visibilityType, setVisibilityType] = useState<'public' | 'private' | 'whitelist'>(event?.visibility_type || 'public');
  const [maxAttendees, setMaxAttendees] = useState(event?.max_attendees?.toString() || "");
  const [rsvpRequired, setRsvpRequired] = useState(event?.rsvp_required || false);
  const [rsvpDeadline, setRsvpDeadline] = useState(event?.rsvp_deadline || "");
  const [organizerName, setOrganizerName] = useState(event?.organizer_name || "");
  const [organizerContact, setOrganizerContact] = useState(event?.organizer_contact || "");
  const [eventStatus, setEventStatus] = useState<'upcoming' | 'ongoing' | 'completed' | 'cancelled'>(event?.event_status || 'upcoming');

  // Description Enhancements State
  const [eventHighlights, setEventHighlights] = useState<string[]>(event?.event_highlights || []);
  const [keyAttractions, setKeyAttractions] = useState<string[]>(event?.key_attractions || []);
  const [ageRestrictions, setAgeRestrictions] = useState(event?.age_restrictions || "");
  const [tags, setTags] = useState<string[]>(event?.tags || []);

  // Venue State
  const [venueName, setVenueName] = useState(event?.venue_name || "");
  const [venueAddress, setVenueAddress] = useState(event?.venue_address || "");
  const [venueCity, setVenueCity] = useState(event?.venue_city || "");
  const [venueLandmark, setVenueLandmark] = useState(event?.venue_landmark || "");
  const [venueType, setVenueType] = useState<'indoor' | 'outdoor' | 'hybrid'>(event?.venue_type || 'indoor');
  const [latitude, setLatitude] = useState(event?.latitude || null);
  const [longitude, setLongitude] = useState(event?.longitude || null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(event?.google_maps_url || "");

  // Facilities State
  const [parkingAvailable, setParkingAvailable] = useState(event?.parking_available || false);
  const [foodStalls, setFoodStalls] = useState(event?.food_stalls || false);
  const [alcoholAvailable, setAlcoholAvailable] = useState(event?.alcohol_available || false);
  const [wheelchairAccess, setWheelchairAccess] = useState(event?.wheelchair_access || false);
  const [kidsAllowed, setKidsAllowed] = useState(event?.kids_allowed ?? true);
  const [petsAllowed, setPetsAllowed] = useState(event?.pets_allowed || false);
  const [prohibitedItems, setProhibitedItems] = useState<string[]>(event?.prohibited_items || []);

  // Policies State
  const [safetyGuidelines, setSafetyGuidelines] = useState(
    Array.isArray(event?.safety_guidelines) 
      ? event.safety_guidelines.join('\n') 
      : (event?.safety_guidelines || "")
  );
  const [entryGuidelines, setEntryGuidelines] = useState(event?.entry_guidelines || "");
  const [securityMeasures, setSecurityMeasures] = useState(event?.security_measures || "");
  const [medicalAssistanceInfo, setMedicalAssistanceInfo] = useState(event?.medical_assistance_info || "");
  const [weatherAdvisory, setWeatherAdvisory] = useState(event?.weather_advisory || "");

  // Gallery State
  const [galleryImages, setGalleryImages] = useState<string[]>(event?.gallery_images || []);
  const [galleryVideos, setGalleryVideos] = useState<string[]>(event?.gallery_videos || []);

  // Schedule State
  const [schedules, setSchedules] = useState<EventScheduleData[]>(event?.schedules || []);

  // Performers State
  const [performers, setPerformers] = useState<EventPerformerData[]>(event?.performers || []);

  // Vendors State
  const [vendors, setVendors] = useState<EventVendorData[]>(event?.vendors || []);

  // FAQs State
  const [faqs, setFaqs] = useState<EventFAQData[]>(event?.faqs || []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileName = `${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('event-banners')
        .upload(fileName, file);

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      const { data: publicData } = supabase.storage
        .from('event-banners')
        .getPublicUrl(data.path);

      setEventBannerUrl(publicData.publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLocationSelect = (location: {
    lat: number;
    lng: number;
    address?: string;
    venue_name?: string;
    venue_city?: string;
    venue_landmark?: string;
    display_name?: string;
  }) => {
    setLatitude(location.lat);
    setLongitude(location.lng);
    if (location.address) setVenueAddress(location.address);
    if (location.venue_name) setVenueName(location.venue_name);
    if (location.venue_city) setVenueCity(location.venue_city);
    if (location.venue_landmark) setVenueLandmark(location.venue_landmark);
    
    // Generate Google Maps URL
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    setGoogleMapsUrl(mapsUrl);
  };

  const addArrayItem = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (item.trim()) {
      setArray([...array, item.trim()]);
    }
  };

  const removeArrayItem = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setArray(array.filter((_, i) => i !== index));
  };

  const addScheduleItem = () => {
    setSchedules([...schedules, {
      day_number: 1,
      start_time: "09:00",
      end_time: "10:00",
      title: "",
      description: "",
      location: "",
    }]);
  };

  const addPerformer = () => {
    setPerformers([...performers, {
      name: "",
      bio: "",
      image_url: "",
      performer_type: 'artist',
      social_links: {},
    }]);
  };

  const addVendor = () => {
    setVendors([...vendors, {
      vendor_name: "",
      vendor_description: "",
      food_category: "",
      menu_preview: [],
      vendor_contact: "",
      stall_location: "",
      image_url: "",
    }]);
  };

  const addFAQ = () => {
    setFaqs([...faqs, {
      question: "",
      answer: "",
      display_order: faqs.length,
    }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !startDate || !startTime || !endDate || !endTime) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      // Create complete event data using all database fields
      const eventData = {
        // Required core fields
        user_email: userEmail || '',
        event_name: eventName,
        event_description: eventDescription || undefined,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        timezone,
        
        // Media and display
        event_banner_url: eventBannerUrl || undefined,
        
        // Event settings and configuration
        visibility_type: visibilityType,
        event_status: eventStatus,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : undefined,
        rsvp_required: rsvpRequired,
        rsvp_deadline: rsvpDeadline || undefined,
        age_restrictions: ageRestrictions || undefined,
        
        // Venue and location information
        venue_name: venueName || undefined,
        venue_address: venueAddress || undefined,
        venue_city: venueCity || undefined,
        venue_landmark: venueLandmark || undefined,
        venue_type: venueType || undefined,
        venue_latitude: latitude || undefined,
        venue_longitude: longitude || undefined,
        google_maps_url: googleMapsUrl || undefined,
        
        // Organizer information
        organizer_name: organizerName || undefined,
        organizer_contact: organizerContact || undefined,
        organizer_email: userEmail || undefined, // Use user email as organizer email by default
        
        // Facility boolean flags
        parking_available: parkingAvailable,
        food_stalls: foodStalls,
        alcohol_available: alcoholAvailable,
        wheelchair_access: wheelchairAccess,
        kids_allowed: kidsAllowed,
        pets_allowed: petsAllowed,
        
        // JSON data arrays (only include if not empty)
        schedules: schedules.length > 0 ? schedules : [],
        performers: performers.length > 0 ? performers : [],
        vendors: vendors.length > 0 ? vendors : [],
        faqs: faqs.length > 0 ? faqs : [],
        safety_guidelines: safetyGuidelines ? safetyGuidelines.split('\n').filter(line => line.trim()) : [],
        tags: tags.length > 0 ? tags : [],
      };

      // Remove undefined values to avoid database errors
      Object.keys(eventData).forEach(key => {
        if (eventData[key as keyof typeof eventData] === undefined) {
          delete eventData[key as keyof typeof eventData];
        }
      });

      await onSubmit(eventData);
    } catch (error) {
      const errorMessage = error && typeof error === 'object' && 'message' in error 
        ? (error as { message: string }).message 
        : 'Unknown error occurred';
      const errorDetails = error && typeof error === 'object' && 'details' in error 
        ? (error as { details: string }).details 
        : 'No additional details';
      
      console.error('Error submitting form:', {
        message: errorMessage,
        details: errorDetails,
        fullError: JSON.stringify(error, null, 2)
      });
      
      // Show user-friendly error message
      alert(`Failed to submit form: ${errorMessage}`);
      
      // Re-throw to let parent handle the error UI
      throw error;
    }
  };

  const tabs = [
    { id: 'basic' as FormTab, label: 'Basic Info', icon: FileText },
    { id: 'venue' as FormTab, label: 'Venue & Location', icon: MapPin },
    { id: 'schedule' as FormTab, label: 'Schedule', icon: Clock },
    { id: 'lineup' as FormTab, label: 'Performers', icon: Star },
    { id: 'policies' as FormTab, label: 'Policies', icon: Settings },
    { id: 'faqs' as FormTab, label: 'FAQs', icon: HelpCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          {event ? "Edit Event" : "Create New Event"}
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-zinc-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  currentTab === tab.id
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information Tab */}
        {currentTab === 'basic' && (
          <div className="space-y-6">
            {/* Event Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event Name *
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                placeholder="Enter event name"
              />
            </div>

            {/* Event Banner */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event Banner
              </label>
              <div className="flex items-center space-x-4">
                {eventBannerUrl && (
                  <div className="relative w-32 h-20">
                    <Image
                      src={eventBannerUrl}
                      alt="Event banner"
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors"
                >
                  {isUploading ? (
                    <>Loading...</>
                  ) : (
                    <>
                      <Upload size={16} />
                      Upload Banner
                    </>
                  )}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                placeholder="Describe your event in detail..."
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>
            </div>

            {/* Organizer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Organizer Name
                </label>
                <input
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  placeholder="Event organizer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Organizer Contact
                </label>
                <input
                  type="text"
                  value={organizerContact}
                  onChange={(e) => setOrganizerContact(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  placeholder="Contact email or phone"
                />
              </div>
            </div>

            {/* Event Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Visibility
                </label>
                <select
                  value={visibilityType}
                  onChange={(e) => setVisibilityType(e.target.value as 'public' | 'private' | 'whitelist')}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="whitelist">Invite Only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Attendees
                </label>
                <input
                  type="number"
                  value={maxAttendees}
                  onChange={(e) => setMaxAttendees(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event Status
                </label>
                <select
                  value={eventStatus}
                  onChange={(e) => setEventStatus(e.target.value as 'upcoming' | 'ongoing' | 'completed' | 'cancelled')}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* RSVP Settings */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rsvpRequired}
                  onChange={(e) => setRsvpRequired(e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                />
                <span className="ml-2 text-sm text-gray-300">RSVP Required</span>
              </label>
              {rsvpRequired && (
                <div className="flex-1">
                  <input
                    type="datetime-local"
                    value={rsvpDeadline}
                    onChange={(e) => setRsvpDeadline(e.target.value)}
                    className="px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Venue & Location Tab */}
        {currentTab === 'venue' && (
          <div className="space-y-6">
            <OpenMapLocationPicker
              onLocationSelect={handleLocationSelect}
              initialLocation={latitude && longitude ? { lat: latitude, lng: longitude } : undefined}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Venue Type
              </label>
              <select
                value={venueType}
                onChange={(e) => setVenueType(e.target.value as 'indoor' | 'outdoor' | 'hybrid')}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="hybrid">Hybrid (Indoor & Outdoor)</option>
              </select>
            </div>

            {/* Facilities */}
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Facilities & Amenities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={parkingAvailable}
                    onChange={(e) => setParkingAvailable(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Parking Available</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={foodStalls}
                    onChange={(e) => setFoodStalls(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Food Stalls</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={alcoholAvailable}
                    onChange={(e) => setAlcoholAvailable(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Alcohol Available</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={wheelchairAccess}
                    onChange={(e) => setWheelchairAccess(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Wheelchair Access</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={kidsAllowed}
                    onChange={(e) => setKidsAllowed(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Kids Allowed</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={petsAllowed}
                    onChange={(e) => setPetsAllowed(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Pets Allowed</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Performers/Lineup Tab */}
        {currentTab === 'lineup' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Performers & Artists</h3>
              <button
                type="button"
                onClick={addPerformer}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Performer
              </button>
            </div>
            {performers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No performers added yet. Click &quot;Add Performer&quot; to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {performers.map((performer, index) => (
                  <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-medium">Performer {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => setPerformers(performers.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Performer Name
                        </label>
                        <input
                          type="text"
                          value={performer.name}
                          onChange={(e) => {
                            const newPerformers = [...performers];
                            newPerformers[index].name = e.target.value;
                            setPerformers(newPerformers);
                          }}
                          placeholder="Artist or band name"
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Performer Type
                        </label>
                        <select
                          value={performer.performer_type}
                          onChange={(e) => {
                            const newPerformers = [...performers];
                            newPerformers[index].performer_type = e.target.value as 'artist' | 'speaker' | 'chef' | 'performer' | 'other';
                            setPerformers(newPerformers);
                          }}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                        >
                          <option value="artist">Artist</option>
                          <option value="performer">Performer</option>
                          <option value="speaker">Speaker</option>
                          <option value="chef">Chef</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Bio/Description
                        </label>
                        <textarea
                          value={performer.bio || ''}
                          onChange={(e) => {
                            const newPerformers = [...performers];
                            newPerformers[index].bio = e.target.value;
                            setPerformers(newPerformers);
                          }}
                          placeholder="Brief biography or description of the performer..."
                          rows={3}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Image URL
                        </label>
                        <input
                          type="url"
                          value={performer.image_url || ''}
                          onChange={(e) => {
                            const newPerformers = [...performers];
                            newPerformers[index].image_url = e.target.value;
                            setPerformers(newPerformers);
                          }}
                          placeholder="https://example.com/performer-photo.jpg"
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Social Links (JSON format)
                        </label>
                        <input
                          type="text"
                          value={performer.social_links ? JSON.stringify(performer.social_links) : '{}'}
                          onChange={(e) => {
                            const newPerformers = [...performers];
                            try {
                              newPerformers[index].social_links = JSON.parse(e.target.value);
                            } catch {
                              // Invalid JSON, keep previous value
                            }
                            setPerformers(newPerformers);
                          }}
                          placeholder='{"instagram": "username", "twitter": "username"}'
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Policies Tab */}
        {currentTab === 'policies' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white">Event Policies & Guidelines</h3>
            
            {/* Safety Guidelines */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Safety Guidelines
              </label>
              <textarea
                value={safetyGuidelines}
                onChange={(e) => setSafetyGuidelines(e.target.value)}
                placeholder="Describe safety measures, emergency procedures, and safety requirements..."
                rows={4}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Entry Guidelines */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entry Guidelines
              </label>
              <textarea
                value={entryGuidelines}
                onChange={(e) => setEntryGuidelines(e.target.value)}
                placeholder="Describe entry requirements, dress code, ID requirements, etc..."
                rows={4}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Security Measures */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Security Measures
              </label>
              <textarea
                value={securityMeasures}
                onChange={(e) => setSecurityMeasures(e.target.value)}
                placeholder="Describe security protocols, bag checks, metal detectors, etc..."
                rows={4}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Medical Assistance Info */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Medical Assistance Information
              </label>
              <textarea
                value={medicalAssistanceInfo}
                onChange={(e) => setMedicalAssistanceInfo(e.target.value)}
                placeholder="Information about medical facilities, first aid stations, emergency contacts..."
                rows={3}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Weather Advisory */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Weather Advisory
              </label>
              <textarea
                value={weatherAdvisory}
                onChange={(e) => setWeatherAdvisory(e.target.value)}
                placeholder="Weather-related information, backup plans, recommended clothing..."
                rows={3}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Age Restrictions */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Age Restrictions
              </label>
              <input
                type="text"
                value={ageRestrictions}
                onChange={(e) => setAgeRestrictions(e.target.value)}
                placeholder="e.g., 18+, All ages, 21+ for alcohol areas"
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Prohibited Items */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prohibited Items
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add prohibited item (e.g., weapons, outside food, cameras)"
                    className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          setProhibitedItems([...prohibitedItems, input.value.trim()]);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        setProhibitedItems([...prohibitedItems, input.value.trim()]);
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
                {prohibitedItems.length > 0 && (
                  <div className="space-y-2">
                    {prohibitedItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded-lg">
                        <span className="text-white">{item}</span>
                        <button
                          type="button"
                          onClick={() => setProhibitedItems(prohibitedItems.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Event Highlights */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Event Highlights
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add event highlight (e.g., Celebrity appearance, Free drinks)"
                    className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          setEventHighlights([...eventHighlights, input.value.trim()]);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = (e.target as HTMLButtonElement).parentElement?.querySelector('input') as HTMLInputElement;
                      if (input?.value.trim()) {
                        setEventHighlights([...eventHighlights, input.value.trim()]);
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
                {eventHighlights.length > 0 && (
                  <div className="space-y-2">
                    {eventHighlights.map((highlight, index) => (
                      <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded-lg">
                        <span className="text-white">{highlight}</span>
                        <button
                          type="button"
                          onClick={() => setEventHighlights(eventHighlights.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FAQs Tab */}
        {currentTab === 'faqs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Frequently Asked Questions</h3>
              <button
                type="button"
                onClick={addFAQ}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add FAQ
              </button>
            </div>
            {faqs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No FAQs added yet. Click &quot;Add FAQ&quot; to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-medium">FAQ {index + 1}</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">Order:</span>
                          <input
                            type="number"
                            min="0"
                            value={faq.display_order}
                            onChange={(e) => {
                              const newFaqs = [...faqs];
                              newFaqs[index].display_order = parseInt(e.target.value);
                              setFaqs(newFaqs);
                            }}
                            className="w-16 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setFaqs(faqs.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Question
                        </label>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => {
                            const newFaqs = [...faqs];
                            newFaqs[index].question = e.target.value;
                            setFaqs(newFaqs);
                          }}
                          placeholder="Enter the question..."
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Answer
                        </label>
                        <textarea
                          value={faq.answer}
                          onChange={(e) => {
                            const newFaqs = [...faqs];
                            newFaqs[index].answer = e.target.value;
                            setFaqs(newFaqs);
                          }}
                          placeholder="Enter the answer..."
                          rows={4}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {currentTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Event Schedule</h3>
              <button
                type="button"
                onClick={addScheduleItem}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Schedule Item
              </button>
            </div>
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No schedule items added yet. Click "Add Schedule Item" to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {schedules.map((schedule, index) => (
                  <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-medium">Schedule Item {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => setSchedules(schedules.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Day Number
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={schedule.day_number}
                          onChange={(e) => {
                            const newSchedules = [...schedules];
                            newSchedules[index].day_number = parseInt(e.target.value);
                            setSchedules(newSchedules);
                          }}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Location
                        </label>
                        <input
                          type="text"
                          value={schedule.location}
                          onChange={(e) => {
                            const newSchedules = [...schedules];
                            newSchedules[index].location = e.target.value;
                            setSchedules(newSchedules);
                          }}
                          placeholder="e.g., Main Stage, Conference Room A"
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={schedule.start_time}
                          onChange={(e) => {
                            const newSchedules = [...schedules];
                            newSchedules[index].start_time = e.target.value;
                            setSchedules(newSchedules);
                          }}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={schedule.end_time}
                          onChange={(e) => {
                            const newSchedules = [...schedules];
                            newSchedules[index].end_time = e.target.value;
                            setSchedules(newSchedules);
                          }}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Title
                        </label>
                        <input
                          type="text"
                          value={schedule.title}
                          onChange={(e) => {
                            const newSchedules = [...schedules];
                            newSchedules[index].title = e.target.value;
                            setSchedules(newSchedules);
                          }}
                          placeholder="e.g., Opening Ceremony, Keynote Speech"
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Description
                        </label>
                        <textarea
                          value={schedule.description || ''}
                          onChange={(e) => {
                            const newSchedules = [...schedules];
                            newSchedules[index].description = e.target.value;
                            setSchedules(newSchedules);
                          }}
                          placeholder="Describe this schedule item..."
                          rows={3}
                          className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {isLoading ? "Saving..." : (event ? "Update Event" : "Create Event")}
          </button>
        </div>
      </form>
    </div>
  );
}