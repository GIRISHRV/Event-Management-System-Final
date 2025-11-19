import { useState, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { X, Upload, Plus, MapPin, Clock, FileText, HelpCircle, Trash2, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Event, CreateEventInput, EventScheduleData, EventPerformerData, EventFAQData } from "@/lib/supabase-types";

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

type FormTab = 'basic' | 'venue' | 'schedule-lineup' | 'gallery' | 'faqs';

export function EnhancedEventForm({
  event,
  onSubmit,
  onClose,
  isLoading = false,
  userEmail,
}: EnhancedEventFormProps) {
  const [currentTab, setCurrentTab] = useState<FormTab>('basic');
  const currentTabRef = useRef<FormTab>('basic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const performerImageInputRef = useRef<HTMLInputElement>(null);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);
  const galleryVideoInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingPerformerIndex, setUploadingPerformerIndex] = useState<number | null>(null);
  const [uploadingGalleryType, setUploadingGalleryType] = useState<'image' | 'video' | null>(null);

  // Basic Information State
  const [eventName, setEventName] = useState(event?.event_name || "");
  const [eventDescription, setEventDescription] = useState(event?.event_description || "");
  const [startDate, setStartDate] = useState(event?.start_date || "");
  const [startTime, setStartTime] = useState(event?.start_time || "");
  const [endDate, setEndDate] = useState(event?.end_date || "");
  const [endTime, setEndTime] = useState(event?.end_time || "");
  const [timezone] = useState(event?.timezone || "UTC");
  const [eventBannerUrl, setEventBannerUrl] = useState(event?.event_banner_url || "");
  const [visibilityType, setVisibilityType] = useState<'public' | 'private' | 'whitelist'>(event?.visibility_type || 'public');
  const [maxAttendees, setMaxAttendees] = useState(event?.max_attendees?.toString() || "");
  const [organizerName, setOrganizerName] = useState(event?.organizer_name || "");
  const [organizerContact, setOrganizerContact] = useState(event?.organizer_contact || "");
  const [eventStatus, setEventStatus] = useState<'upcoming' | 'ongoing' | 'completed' | 'cancelled'>(event?.event_status || 'upcoming');

  // Description Enhancements State
  // const [eventHighlights, setEventHighlights] = useState<string[]>(event?.event_highlights || []);
  // const [keyAttractions, setKeyAttractions] = useState<string[]>(event?.key_attractions || []);
  // const [tags, setTags] = useState<string[]>(event?.tags || []);

  // Venue State
  const [venueName, setVenueName] = useState(event?.venue_name || "");
  const [venueAddress, setVenueAddress] = useState(event?.venue_address || "");
  const [venueCity, setVenueCity] = useState(event?.venue_city || "");
  const [venueLandmark, setVenueLandmark] = useState(event?.venue_landmark || "");
  const [venueType, setVenueType] = useState<'indoor' | 'outdoor' | 'hybrid'>(event?.venue_type || 'indoor');
  const [latitude, setLatitude] = useState(event?.latitude || null);
  const [longitude, setLongitude] = useState(event?.longitude || null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(event?.google_maps_url || "");

  // Gallery State
  const [galleryImages, setGalleryImages] = useState<string[]>(event?.gallery_images || []);
  const [galleryVideos, setGalleryVideos] = useState<string[]>(event?.gallery_videos || []);

  // Schedule State
  const [schedules, setSchedules] = useState<EventScheduleData[]>(event?.schedules || []);

  // Performers State
  const [performers, setPerformers] = useState<EventPerformerData[]>(event?.performers || []);

  // FAQs State
  const [faqs, setFaqs] = useState<EventFAQData[]>(event?.faqs || []);

  // Generic upload handler
  const handleFileUpload = async (file: File, bucket: string = 'event-banners'): Promise<string | null> => {
    if (!file) return null;

    try {
      setIsUploading(true);
      const fileName = `${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      setEventBannerUrl(url);
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

  const addFAQ = () => {
    setFaqs([...faqs, {
      question: "",
      answer: "",
      display_order: faqs.length,
    }]);
  };

  // Handler for performer image upload
  const handlePerformerImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, performerIndex: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPerformerIndex(performerIndex);
    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      const updatedPerformers = [...performers];
      updatedPerformers[performerIndex].image_url = url;
      setPerformers(updatedPerformers);
    }
    setUploadingPerformerIndex(null);
  };

  // Handler for gallery image upload
  const handleGalleryImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingGalleryType('image');
    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      setGalleryImages([...galleryImages, url]);
    }
    setUploadingGalleryType(null);
  };

  // Handler for gallery video upload
  const handleGalleryVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingGalleryType('video');
    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      setGalleryVideos([...galleryVideos, url]);
    }
    setUploadingGalleryType(null);
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
        
        // JSON data arrays (only include if not empty)
        schedules: schedules.length > 0 ? schedules : [],
        performers: performers.length > 0 ? performers : [],
        gallery_images: galleryImages.length > 0 ? galleryImages : [],
        gallery_videos: galleryVideos.length > 0 ? galleryVideos : [],
        faqs: faqs.length > 0 ? faqs : [],
        tags: [],
      };

      // Remove undefined values to avoid database errors
      Object.keys(eventData).forEach(key => {
        if (eventData[key as keyof typeof eventData] === undefined) {
          delete eventData[key as keyof typeof eventData];
        }
      });

      await onSubmit(eventData);
    } catch (error) {
      console.error('Error submitting form - Full error:', error);
      if (error && typeof error === 'object') {
        console.error('Error keys:', Object.keys(error as Record<string, unknown>));
        const errorObj = error as Record<string, unknown>;
        console.error('Error code:', errorObj.code);
        console.error('Error message:', errorObj.message);
        console.error('Error details:', errorObj.details);
      }
      
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
    { id: 'schedule-lineup' as FormTab, label: 'Schedule & Performers', icon: Clock },
    { id: 'gallery' as FormTab, label: 'Gallery', icon: ImageIcon },
    { id: 'faqs' as FormTab, label: 'FAQs', icon: HelpCircle },
  ];

  return (
    <div className="space-y-6">
      {!event && (
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            Create New Event
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-zinc-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentTab(tab.id);
                  currentTabRef.current = tab.id;
                }}
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
              <div className="space-y-3">
                {eventBannerUrl && (
                  <div className="relative w-full h-40">
                    <Image
                      src={eventBannerUrl}
                      alt="Event banner"
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Or paste banner URL here"
                    value={eventBannerUrl}
                    onChange={(e) => setEventBannerUrl(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors shrink-0"
                  >
                    {isUploading ? (
                      <>Loading...</>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload
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
          </div>
        )}

        {/* Schedule & Performers Tab */}
        {currentTab === 'schedule-lineup' && (
          <div className="space-y-8">
            {/* Performers Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
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
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Image
                          </label>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={performer.image_url || ''}
                                onChange={(e) => {
                                  const newPerformers = [...performers];
                                  newPerformers[index].image_url = e.target.value;
                                  setPerformers(newPerformers);
                                }}
                                placeholder="https://example.com/performer-photo.jpg"
                                className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                              />
                              <button
                                type="button"
                                onClick={() => performerImageInputRef.current?.click()}
                                disabled={uploadingPerformerIndex === index}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
                              >
                                <Upload size={16} />
                                Upload
                              </button>
                              <input
                                ref={performerImageInputRef}
                                type="file"
                                onChange={(e) => handlePerformerImageUpload(e, index)}
                                accept="image/*"
                                className="hidden"
                              />
                            </div>
                            {performer.image_url && (
                              <div className="relative w-24 h-24">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={performer.image_url}
                                  alt={performer.name}
                                  className="w-full h-full object-cover rounded-lg"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect fill="%23333" width="96" height="96"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3EError%3C/text%3E%3C/svg%3E';
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-700 pt-8">
              {/* Event Schedule Section */}
              <div className="flex items-center justify-between mb-4">
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
                  No schedule items added yet. Click &quot;Add Schedule Item&quot; to get started.
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
                            placeholder="Detailed description of this schedule item..."
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
          </div>
        )}

        {/* Gallery Tab */}
        {currentTab === 'gallery' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-white">Event Gallery</h3>
            
            {/* Gallery Images */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gallery Images
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Add image URL (e.g., https://example.com/image.jpg)"
                    className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          setGalleryImages([...galleryImages, input.value.trim()]);
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
                        setGalleryImages([...galleryImages, input.value.trim()]);
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryImageInputRef.current?.click()}
                    disabled={uploadingGalleryType === 'image'}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
                  >
                    <Upload size={16} />
                    Upload
                  </button>
                  <input
                    ref={galleryImageInputRef}
                    type="file"
                    onChange={handleGalleryImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {galleryImages.map((image, index) => {
                      return (
                        <div key={index} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-zinc-600 cursor-pointer hover:opacity-80 transition-opacity"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23333" width="128" height="128"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EImage Error%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setGalleryImages(galleryImages.filter((_, i) => i !== index))}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Gallery Videos */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gallery Videos
              </label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Add video URL (YouTube, Vimeo, etc.)"
                    className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          setGalleryVideos([...galleryVideos, input.value.trim()]);
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
                        setGalleryVideos([...galleryVideos, input.value.trim()]);
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryVideoInputRef.current?.click()}
                    disabled={uploadingGalleryType === 'video'}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center gap-2 shrink-0"
                  >
                    <Upload size={16} />
                    Upload
                  </button>
                  <input
                    ref={galleryVideoInputRef}
                    type="file"
                    onChange={handleGalleryVideoUpload}
                    accept="video/*"
                    className="hidden"
                  />
                </div>
                {galleryVideos.length > 0 && (
                  <div className="space-y-2">
                    {galleryVideos.map((video, index) => (
                      <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded-lg">
                        <span className="text-white truncate text-sm">{video}</span>
                        <button
                          type="button"
                          onClick={() => setGalleryVideos(galleryVideos.filter((_, i) => i !== index))}
                          className="text-red-400 hover:text-red-300 p-1 shrink-0"
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