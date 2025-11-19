import { useState, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { X, Upload, Plus, MapPin, Clock, FileText, HelpCircle, Trash2, ImageIcon, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Event, CreateEventInput, EventScheduleData, EventPerformerData, EventFAQData } from "@/lib/supabase-types";
import { useToast } from "@/components/Toast";

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

interface AIEventData {
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

interface EventFormData {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const performerImageInputRef = useRef<HTMLInputElement>(null);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);
  const galleryVideoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [isEditMode] = useState(!!event);
  const { error: toastError, success: toastSuccess, Toast } = useToast();

  // UI State
  const [uiState, setUiState] = useState({
    isUploading: false,
    uploadingPerformerIndex: null as number | null,
    uploadingGalleryType: null as 'image' | 'video' | null,
    showAIInput: false,
    aiInstructions: "",
    isParsingAI: false,
    conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
    aiQuestion: null as string | null,
    allRequiredComplete: false,
    showConfirmation: false,
    pendingChanges: null as {
      data: AIEventData;
      conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
      completionMessage?: string;
    } | null,
    changeApprovals: {} as Record<string, boolean>,
    expandedChanges: {} as Record<string, boolean>,
  });

  // Form Data State
  const [formData, setFormData] = useState<EventFormData>({
    eventName: event?.event_name || "",
    eventDescription: event?.event_description || "",
    startDate: event?.start_date || "",
    startTime: event?.start_time || "",
    endDate: event?.end_date || "",
    endTime: event?.end_time || "",
    timezone: event?.timezone || "UTC",
    eventBannerUrl: event?.event_banner_url || "",
    visibilityType: event?.visibility_type || 'public',
    maxAttendees: event?.max_attendees?.toString() || "",
    organizerName: event?.organizer_name || "",
    organizerContact: event?.organizer_contact || "",
    eventStatus: event?.event_status || 'upcoming',
    venueName: event?.venue_name || "",
    venueAddress: event?.venue_address || "",
    venueCity: event?.venue_city || "",
    venueLandmark: event?.venue_landmark || "",
    venueType: event?.venue_type || 'indoor',
    latitude: event?.venue_latitude || null,
    longitude: event?.venue_longitude || null,
    googleMapsUrl: event?.google_maps_url || "",
    galleryImages: event?.gallery_images || [],
    galleryVideos: event?.gallery_videos || [],
    schedules: event?.schedules || [],
    performers: event?.performers || [],
    faqs: event?.faqs || [],
  });

  const updateFormData = (updates: Partial<EventFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateUiState = (updates: Partial<typeof uiState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
  };

  // Helper to normalize text for comparison (removes extra spaces, trailing dots, etc.)
  const normalizeText = (text: string) => {
    if (!text) return '';
    return text.trim().replace(/\.+$/g, '.').replace(/\s+/g, ' ');
  };

  // Detect what fields will change
  const detectChanges = (aiData: AIEventData) => {
    const changes: Record<string, { old: string | number | null | undefined; new: string | number | null | undefined }> = {};
    
    if (aiData.basicInfo) {
      // Only detect real changes, ignore trivial differences
      if (aiData.basicInfo.eventName && normalizeText(aiData.basicInfo.eventName) !== normalizeText(formData.eventName)) {
        changes.eventName = { old: formData.eventName, new: aiData.basicInfo.eventName };
      }
      if (aiData.basicInfo.eventDescription && normalizeText(aiData.basicInfo.eventDescription) !== normalizeText(formData.eventDescription)) {
        changes.eventDescription = { old: formData.eventDescription, new: aiData.basicInfo.eventDescription };
      }
      if (aiData.basicInfo.startDate && aiData.basicInfo.startDate !== formData.startDate) {
        changes.startDate = { old: formData.startDate, new: aiData.basicInfo.startDate };
      }
      if (aiData.basicInfo.startTime && aiData.basicInfo.startTime !== formData.startTime) {
        changes.startTime = { old: formData.startTime, new: aiData.basicInfo.startTime };
      }
      if (aiData.basicInfo.endDate && aiData.basicInfo.endDate !== formData.endDate) {
        changes.endDate = { old: formData.endDate, new: aiData.basicInfo.endDate };
      }
      if (aiData.basicInfo.endTime && aiData.basicInfo.endTime !== formData.endTime) {
        changes.endTime = { old: formData.endTime, new: aiData.basicInfo.endTime };
      }
      if (aiData.basicInfo.organizerName && normalizeText(aiData.basicInfo.organizerName) !== normalizeText(formData.organizerName)) {
        changes.organizerName = { old: formData.organizerName, new: aiData.basicInfo.organizerName };
      }
      if (aiData.basicInfo.maxAttendees && aiData.basicInfo.maxAttendees?.toString() !== formData.maxAttendees) {
        changes.maxAttendees = { old: formData.maxAttendees, new: aiData.basicInfo.maxAttendees };
      }
    }

    if (aiData.venue) {
      if (aiData.venue.venueName && normalizeText(aiData.venue.venueName) !== normalizeText(formData.venueName)) {
        changes.venueName = { old: formData.venueName, new: aiData.venue.venueName };
      }
      if (aiData.venue.venueCity && normalizeText(aiData.venue.venueCity) !== normalizeText(formData.venueCity)) {
        changes.venueCity = { old: formData.venueCity, new: aiData.venue.venueCity };
      }
    }

    // For schedules, check both length AND content
    if (aiData.schedules) {
      const schedulesChanged = aiData.schedules.length !== formData.schedules.length || 
        JSON.stringify(aiData.schedules) !== JSON.stringify(formData.schedules);
      if (schedulesChanged) {
        changes.schedules = { old: formData.schedules.length, new: aiData.schedules.length };
      }
    }
    
    if (aiData.performers) {
      const performersChanged = aiData.performers.length !== formData.performers.length ||
        JSON.stringify(aiData.performers) !== JSON.stringify(formData.performers);
      if (performersChanged) {
        changes.performers = { old: formData.performers.length, new: aiData.performers.length };
      }
    }
    
    if (aiData.faqs) {
      const faqsChanged = aiData.faqs.length !== formData.faqs.length ||
        JSON.stringify(aiData.faqs) !== JSON.stringify(formData.faqs);
      if (faqsChanged) {
        changes.faqs = { old: formData.faqs.length, new: aiData.faqs.length };
      }
    }

    return changes;
  };

  const applyApprovedChanges = () => {
    if (!uiState.pendingChanges) return;

    const updates: Partial<EventFormData> = {};
    const { data } = uiState.pendingChanges;

    // Directly apply approved changes to form fields
    if (uiState.changeApprovals.eventName && data.basicInfo?.eventName) {
      updates.eventName = data.basicInfo.eventName;
    }
    if (uiState.changeApprovals.eventDescription && data.basicInfo?.eventDescription) {
      updates.eventDescription = data.basicInfo.eventDescription;
    }
    if (uiState.changeApprovals.startDate && data.basicInfo?.startDate) {
      updates.startDate = data.basicInfo.startDate;
    }
    if (uiState.changeApprovals.startTime && data.basicInfo?.startTime) {
      updates.startTime = data.basicInfo.startTime;
    }
    if (uiState.changeApprovals.endDate && data.basicInfo?.endDate) {
      updates.endDate = data.basicInfo.endDate;
    }
    if (uiState.changeApprovals.endTime && data.basicInfo?.endTime) {
      updates.endTime = data.basicInfo.endTime;
    }
    if (uiState.changeApprovals.organizerName && data.basicInfo?.organizerName) {
      updates.organizerName = data.basicInfo.organizerName;
    }
    if (uiState.changeApprovals.maxAttendees && data.basicInfo?.maxAttendees) {
      updates.maxAttendees = data.basicInfo.maxAttendees.toString();
    }
    if (uiState.changeApprovals.venueName && data.venue?.venueName) {
      updates.venueName = data.venue.venueName;
    }
    if (uiState.changeApprovals.venueAddress && data.venue?.venueAddress) {
      updates.venueAddress = data.venue.venueAddress;
    }
    if (uiState.changeApprovals.venueCity && data.venue?.venueCity) {
      updates.venueCity = data.venue.venueCity;
    }
    if (uiState.changeApprovals.venueLandmark && data.venue?.venueLandmark) {
      updates.venueLandmark = data.venue.venueLandmark;
    }
    if (uiState.changeApprovals.latitude && data.venue?.latitude !== undefined) {
      updates.latitude = data.venue.latitude;
    }
    if (uiState.changeApprovals.longitude && data.venue?.longitude !== undefined) {
      updates.longitude = data.venue.longitude;
    }
    if (uiState.changeApprovals.schedules && data.schedules) {
      updates.schedules = data.schedules.map((s) => ({
        day_number: s.day_number || 1,
        start_time: s.start_time || '',
        end_time: s.end_time || '',
        title: s.title || '',
        description: s.description || '',
        location: s.location || '',
      }));
    }
    if (uiState.changeApprovals.performers && data.performers) {
      updates.performers = data.performers.map((p) => ({
        name: p.name || '',
        bio: p.bio || '',
        image_url: p.image_url || '',
        performer_type: p.performer_type || 'other',
        social_links: p.social_links || {},
      }));
    }
    if (uiState.changeApprovals.faqs && data.faqs) {
      updates.faqs = data.faqs.map((faq, index) => ({
        question: faq.question || '',
        answer: faq.answer || '',
        display_order: faq.display_order ?? index,
      }));
    }

    updateFormData(updates);
    updateUiState({
      conversationHistory: uiState.pendingChanges.conversation,
      allRequiredComplete: true,
      aiInstructions: '',
      showConfirmation: false,
      pendingChanges: null,
      changeApprovals: {},
      expandedChanges: {},
    });
  };

  // Helper function to apply partial/complete data to form
  const applyDataToForm = (data: AIEventData) => {
    const updates: Partial<EventFormData> = {};

    if (data.basicInfo) {
      if (data.basicInfo.eventName) updates.eventName = data.basicInfo.eventName;
      if (data.basicInfo.eventDescription) updates.eventDescription = data.basicInfo.eventDescription;
      if (data.basicInfo.startDate) updates.startDate = data.basicInfo.startDate;
      if (data.basicInfo.startTime) updates.startTime = data.basicInfo.startTime;
      if (data.basicInfo.endDate) updates.endDate = data.basicInfo.endDate;
      if (data.basicInfo.endTime) updates.endTime = data.basicInfo.endTime;
      if (data.basicInfo.organizerName) updates.organizerName = data.basicInfo.organizerName;
      if (data.basicInfo.organizerContact) updates.organizerContact = data.basicInfo.organizerContact;
      if (data.basicInfo.maxAttendees) updates.maxAttendees = data.basicInfo.maxAttendees.toString();
      if (data.basicInfo.venueType) updates.venueType = data.basicInfo.venueType;
    }

    if (data.venue) {
      if (data.venue.venueName) updates.venueName = data.venue.venueName;
      if (data.venue.venueAddress) updates.venueAddress = data.venue.venueAddress;
      if (data.venue.venueCity) updates.venueCity = data.venue.venueCity;
      if (data.venue.venueLandmark) updates.venueLandmark = data.venue.venueLandmark;
      if (data.venue.latitude !== undefined) updates.latitude = data.venue.latitude;
      if (data.venue.longitude !== undefined) updates.longitude = data.venue.longitude;
      if (data.venue.googleMapsUrl) updates.googleMapsUrl = data.venue.googleMapsUrl;
    }

    // Only update arrays if they have actual data
    // In edit mode, don't overwrite existing arrays with empty ones
    if (data.schedules && Array.isArray(data.schedules)) {
      // Only apply if there's data OR we're in create mode (not editing)
      if (data.schedules.length > 0 || !isEditMode) {
        updates.schedules = data.schedules.map((s) => ({
          day_number: s.day_number || 1,
          start_time: s.start_time || '',
          end_time: s.end_time || '',
          title: s.title || '',
          description: s.description || '',
          location: s.location || '',
        }));
      }
    }

    if (data.performers && Array.isArray(data.performers)) {
      // Only apply if there's data OR we're in create mode (not editing)
      if (data.performers.length > 0 || !isEditMode) {
        updates.performers = data.performers.map((p) => ({
          name: p.name || '',
          bio: p.bio || '',
          image_url: '',
          performer_type: p.performer_type || 'other',
          social_links: {},
        }));
      }
    }

    if (data.faqs && Array.isArray(data.faqs)) {
      // Only apply if there's data OR we're in create mode (not editing)
      if (data.faqs.length > 0 || !isEditMode) {
        updates.faqs = data.faqs.map((faq, index) => ({
          question: faq.question || '',
          answer: faq.answer || '',
          display_order: index,
        }));
      }
    }

    updateFormData(updates);
  };

  // Generic upload handler
  const handleFileUpload = async (file: File, bucket: string = 'event-banners'): Promise<string | null> => {
    if (!file) return null;

    try {
      updateUiState({ isUploading: true });
      const fileName = `${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) {
        throw error;
      }

      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicData.publicUrl;
    } catch {
      return null;
    } finally {
      updateUiState({ isUploading: false });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      updateFormData({ eventBannerUrl: url });
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
    const updates: Partial<EventFormData> = {
      latitude: location.lat,
      longitude: location.lng,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
    };

    if (location.address) updates.venueAddress = location.address;
    if (location.venue_name) updates.venueName = location.venue_name;
    if (location.venue_city) updates.venueCity = location.venue_city;
    if (location.venue_landmark) updates.venueLandmark = location.venue_landmark;
    
    updateFormData(updates);
  };

  const handleAIParseInstructions = async () => {
    if (!uiState.aiInstructions.trim()) {
      toastError("Please enter event instructions");
      return;
    }

    updateUiState({ isParsingAI: true });
    
    // Scroll to bottom of conversation
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    
    try {
      // Gather current form data to provide context to AI
      const currentEventData = {
        eventName: formData.eventName,
        eventDescription: formData.eventDescription,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate,
        endTime: formData.endTime,
        organizerName: formData.organizerName,
        organizerContact: formData.organizerContact,
        maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : undefined,
        venueType: formData.venueType,
        venueName: formData.venueName,
        venueAddress: formData.venueAddress,
        venueCity: formData.venueCity,
        venueLandmark: formData.venueLandmark,
        latitude: formData.latitude,
        longitude: formData.longitude,
        googleMapsUrl: formData.googleMapsUrl,
        schedules: formData.schedules.length > 0 ? formData.schedules : undefined,
        performers: formData.performers.length > 0 ? formData.performers : undefined,
        faqs: formData.faqs.length > 0 ? formData.faqs : undefined,
      };

      const response = await fetch('/api/parse-event-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instructions: uiState.aiInstructions,
          conversationHistory: uiState.conversationHistory,
          currentEventData,
          isEditMode 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse instructions');
      }

      const result = await response.json();

      // Add user message to conversation
      const newConversation = [...uiState.conversationHistory, { role: 'user' as const, content: uiState.aiInstructions }];

      // Check if AI needs more info
      if (result.needsMoreInfo && !result.allRequiredFieldsComplete) {
        // Apply partial data without confirmation
        if (result.partialData) {
          applyDataToForm(result.partialData);
        }
        // Add AI's question to conversation
        updateUiState({
          conversationHistory: [...newConversation, { role: 'assistant' as const, content: result.question }],
          aiQuestion: result.question,
          aiInstructions: ''
        });
      } else if (result.allRequiredFieldsComplete || result.data) {
        // Show confirmation dialog for final changes
        const dataToApply = result.data || result.partialData;
        const changes = detectChanges(dataToApply);
        
        if (Object.keys(changes).length === 0) {
          // No changes detected, just update conversation
          updateUiState({
            conversationHistory: [
              ...newConversation,
              { role: 'assistant' as const, content: result.completionMessage || "No changes needed!" }
            ],
            aiInstructions: ''
          });
        } else {
          // Filter data to only include changed fields
          const filteredData: AIEventData = {};
          
          // Only include basicInfo if any field in it changed
          const basicInfoChanged = Object.keys(changes).some(key => 
            ['eventName', 'eventDescription', 'startDate', 'startTime', 'endDate', 'endTime', 'organizerName', 'maxAttendees'].includes(key)
          );
          if (basicInfoChanged && dataToApply.basicInfo) {
            filteredData.basicInfo = {};
            if (changes.eventName) filteredData.basicInfo.eventName = dataToApply.basicInfo.eventName;
            if (changes.eventDescription) filteredData.basicInfo.eventDescription = dataToApply.basicInfo.eventDescription;
            if (changes.startDate) filteredData.basicInfo.startDate = dataToApply.basicInfo.startDate;
            if (changes.startTime) filteredData.basicInfo.startTime = dataToApply.basicInfo.startTime;
            if (changes.endDate) filteredData.basicInfo.endDate = dataToApply.basicInfo.endDate;
            if (changes.endTime) filteredData.basicInfo.endTime = dataToApply.basicInfo.endTime;
            if (changes.organizerName) filteredData.basicInfo.organizerName = dataToApply.basicInfo.organizerName;
            if (changes.maxAttendees) filteredData.basicInfo.maxAttendees = dataToApply.basicInfo.maxAttendees;
          }
          
          // Only include venue if any field in it changed
          const venueChanged = Object.keys(changes).some(key => 
            ['venueName', 'venueAddress', 'venueCity', 'venueLandmark', 'latitude', 'longitude'].includes(key)
          );
          if (venueChanged && dataToApply.venue) {
            filteredData.venue = {};
            if (changes.venueName) filteredData.venue.venueName = dataToApply.venue.venueName;
            if (changes.venueAddress) filteredData.venue.venueAddress = dataToApply.venue.venueAddress;
            if (changes.venueCity) filteredData.venue.venueCity = dataToApply.venue.venueCity;
            if (changes.venueLandmark) filteredData.venue.venueLandmark = dataToApply.venue.venueLandmark;
            if (changes.latitude) filteredData.venue.latitude = dataToApply.venue.latitude;
            if (changes.longitude) filteredData.venue.longitude = dataToApply.venue.longitude;
          }
          
          // Only include arrays if they changed
          if (changes.schedules) filteredData.schedules = dataToApply.schedules;
          if (changes.performers) filteredData.performers = dataToApply.performers;
          if (changes.faqs) filteredData.faqs = dataToApply.faqs;
          
          // Initialize all changes as approved by default
          const initialApprovals: Record<string, boolean> = {};
          Object.keys(changes).forEach(key => {
            initialApprovals[key] = true;
          });

          updateUiState({
            pendingChanges: {
              data: filteredData,
              conversation: [
                ...newConversation,
                { role: 'assistant' as const, content: result.completionMessage || "✨ Changes ready! Please review and approve." }
              ],
              completionMessage: result.completionMessage
            },
            changeApprovals: initialApprovals,
            showConfirmation: true,
            aiInstructions: ''
          });
        }
      } else {
        // Fallback: old format
        updateUiState({
          showAIInput: false,
          conversationHistory: [],
          aiQuestion: null
        });
        toastSuccess('✨ Event details auto-filled! Please review and add location on the Venue & Location tab.');
      }
    } catch {
      toastError('Failed to parse instructions. Please try again or fill the form manually.');
    } finally {
      updateUiState({ isParsingAI: false });
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const addScheduleItem = () => {
    updateFormData({
      schedules: [...formData.schedules, {
        day_number: 1,
        start_time: "09:00",
        end_time: "10:00",
        title: "",
        description: "",
        location: "",
      }]
    });
  };

  const addPerformer = () => {
    updateFormData({
      performers: [...formData.performers, {
        name: "",
        bio: "",
        image_url: "",
        performer_type: 'artist',
        social_links: {},
      }]
    });
  };

  const addFAQ = () => {
    updateFormData({
      faqs: [...formData.faqs, {
        question: "",
        answer: "",
        display_order: formData.faqs.length,
      }]
    });
  };

  // Handler for performer image upload
  const handlePerformerImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, performerIndex: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateUiState({ uploadingPerformerIndex: performerIndex });
    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      const updatedPerformers = [...formData.performers];
      updatedPerformers[performerIndex].image_url = url;
      updateFormData({ performers: updatedPerformers });
    }
    updateUiState({ uploadingPerformerIndex: null });
  };

  // Handler for gallery image upload
  const handleGalleryImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateUiState({ uploadingGalleryType: 'image' });
    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      updateFormData({ galleryImages: [...formData.galleryImages, url] });
    }
    updateUiState({ uploadingGalleryType: null });
  };

  // Handler for gallery video upload
  const handleGalleryVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateUiState({ uploadingGalleryType: 'video' });
    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      updateFormData({ galleryVideos: [...formData.galleryVideos, url] });
    }
    updateUiState({ uploadingGalleryType: null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.eventName.trim() || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      toastError("Please fill in all required fields");
      return;
    }

    // Validate location is selected
    if (!formData.latitude || !formData.longitude) {
      toastError("Please select a location on the map in the Venue & Location tab");
      setCurrentTab('venue');
      return;
    }

    try {
      // Create complete event data using all database fields
      const eventData = {
        // Required core fields
        user_email: userEmail || '',
        event_name: formData.eventName,
        event_description: formData.eventDescription || undefined,
        start_date: formData.startDate,
        start_time: formData.startTime,
        end_date: formData.endDate,
        end_time: formData.endTime,
        timezone: formData.timezone,
        
        // Media and display
        event_banner_url: formData.eventBannerUrl || undefined,
        
        // Event settings and configuration
        visibility_type: formData.visibilityType,
        event_status: formData.eventStatus,
        max_attendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : undefined,
        
        // Venue and location information
        venue_name: formData.venueName || undefined,
        venue_address: formData.venueAddress || undefined,
        venue_city: formData.venueCity || undefined,
        venue_landmark: formData.venueLandmark || undefined,
        venue_type: formData.venueType || undefined,
        venue_latitude: formData.latitude || undefined,
        venue_longitude: formData.longitude || undefined,
        google_maps_url: formData.googleMapsUrl || undefined,
        
        // Organizer information
        organizer_name: formData.organizerName || undefined,
        organizer_contact: formData.organizerContact || undefined,
        organizer_email: userEmail || undefined, // Use user email as organizer email by default
        
        // JSON data arrays (only include if not empty)
        schedules: formData.schedules.length > 0 ? formData.schedules : [],
        performers: formData.performers.length > 0 ? formData.performers : [],
        gallery_images: formData.galleryImages.length > 0 ? formData.galleryImages : [],
        gallery_videos: formData.galleryVideos.length > 0 ? formData.galleryVideos : [],
        faqs: formData.faqs.length > 0 ? formData.faqs : [],
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
      const errorMessage = error && typeof error === 'object' && 'message' in error 
        ? (error as { message: string }).message 
        : 'Unknown error occurred';
      
      // Show user-friendly error message
      toastError(`Failed to submit form: ${errorMessage}`);
      
      // Re-throw to let parent handle the error UI
      throw error;
    }
  };

  const tabs = [
    { id: 'basic' as FormTab, label: 'Basic Info', icon: FileText },
    { id: 'venue' as FormTab, label: 'Venue & Location *', icon: MapPin },
    { id: 'schedule-lineup' as FormTab, label: 'Schedule & Performers', icon: Clock },
    { id: 'gallery' as FormTab, label: 'Gallery', icon: ImageIcon },
    { id: 'faqs' as FormTab, label: 'FAQs', icon: HelpCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          {event ? 'Edit Event' : 'Create New Event'}
        </h2>
        <div className="flex items-center gap-3">
          {!uiState.showAIInput && (
            <button
              type="button"
              onClick={() => updateUiState({ showAIInput: true })}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              <Sparkles size={16} />
              {event ? 'AI Edit Mode' : 'AI Create Mode'}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* AI Instructions Input (for both create and edit) */}
      {uiState.showAIInput && (
        <div className="bg-linear-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400">
              <Sparkles size={20} />
              <h3 className="font-semibold">
                {isEditMode ? 'AI Event Editor' : 'AI Event Creator'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                updateUiState({
                  showAIInput: false,
                  conversationHistory: [],
                  aiQuestion: null,
                  aiInstructions: '',
                  allRequiredComplete: false
                });
              }}
              className="text-gray-400 hover:text-gray-300"
            >
              <X size={18} />
            </button>
          </div>
          
          {uiState.conversationHistory.length === 0 ? (
            <p className="text-sm text-gray-400">
              {isEditMode 
                ? "Tell me what you'd like to change about this event. I'll update the fields for you!"
                : "Describe your event in plain English and I'll help you create it! I'll ask follow-up questions if I need more details."}
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto bg-zinc-900/50 rounded-lg p-4">
              {uiState.conversationHistory.map((msg, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-blue-900/30 border border-blue-500/30 ml-8' 
                      : 'bg-green-900/30 border border-green-500/30 mr-8'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1">
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <div className="text-sm text-white whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          <textarea
            value={uiState.aiInstructions}
            onChange={(e) => updateUiState({ aiInstructions: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAIParseInstructions();
              }
            }}
            placeholder={
              uiState.conversationHistory.length === 0
                ? (isEditMode 
                    ? "Example: Change the event date to next Friday and add a new performer named John Doe..."
                    : "Example: I want to create a music festival called 'Summer Beats' happening next month...")
                : uiState.aiQuestion || "Type your response..."
            }
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 min-h-24 resize-none"
            disabled={uiState.isParsingAI}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleAIParseInstructions}
              disabled={uiState.isParsingAI || !uiState.aiInstructions.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {uiState.isParsingAI ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {uiState.conversationHistory.length === 0 ? 'Start Conversation' : 'Send'}
                </>
              )}
            </button>
            {uiState.allRequiredComplete && (
              <button
                type="button"
                onClick={() => {
                  updateUiState({
                    showAIInput: false,
                    conversationHistory: [],
                    aiQuestion: null,
                    aiInstructions: '',
                    allRequiredComplete: false
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Done with AI - Review Form
              </button>
            )}
            {uiState.conversationHistory.length === 0 && !uiState.allRequiredComplete && (
              <button
                type="button"
                onClick={() => updateUiState({ showAIInput: false })}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
              >
                Fill Manually
              </button>
            )}
            {uiState.conversationHistory.length > 0 && !uiState.allRequiredComplete && (
              <button
                type="button"
                onClick={() => {
                  updateUiState({
                    conversationHistory: [],
                    aiQuestion: null,
                    aiInstructions: '',
                    allRequiredComplete: false
                  });
                }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
              >
                Start Over
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      )}

      {/* AI Changes Confirmation Dialog */}
      {uiState.showConfirmation && uiState.pendingChanges && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="text-green-400" size={24} />
                Review AI Changes
              </h3>
              <button
                onClick={() => {
                  updateUiState({
                    showConfirmation: false,
                    pendingChanges: null,
                    changeApprovals: {}
                  });
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-6">
              The AI wants to make the following changes. Check the boxes to approve individual changes:
            </p>

            <div className="space-y-3 mb-6">
              {Object.entries(detectChanges(uiState.pendingChanges.data)).map(([field, change]) => {
                const isExpanded = uiState.expandedChanges[field] || false;
                const isArray = typeof change.old === 'number' && typeof change.new === 'number';
                
                return (
                  <div key={field} className="bg-zinc-800 rounded-lg border border-zinc-700">
                    <div
                      className="flex items-start gap-3 p-3 hover:border-green-500/50 cursor-pointer transition"
                      onClick={() => {
                        updateUiState({
                          expandedChanges: {
                            ...uiState.expandedChanges,
                            [field]: !isExpanded
                          }
                        });
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={uiState.changeApprovals[field] || false}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateUiState({
                            changeApprovals: {
                              ...uiState.changeApprovals,
                              [field]: e.target.checked
                            }
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 w-4 h-4 text-green-600 bg-zinc-700 border-zinc-600 rounded focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white capitalize flex items-center gap-2">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {isArray ? (
                            <>
                              <span className="text-red-400">{change.old} items</span>
                              {' → '}
                              <span className="text-green-400">{change.new} items</span>
                            </>
                          ) : (
                            <>
                              <span className="text-gray-500">Click to see details</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t border-zinc-700 p-3 space-y-2">
                        {isArray ? (
                          <>
                            <div className="text-xs text-gray-500 mb-2">Array change detected:</div>
                            <div className="bg-zinc-900 rounded p-2">
                              <div className="text-red-400 text-xs mb-2">Old ({change.old} items):</div>
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {JSON.stringify(
                                  field === 'schedules' ? formData.schedules :
                                  field === 'performers' ? formData.performers :
                                  field === 'faqs' ? formData.faqs : [],
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                            <div className="bg-zinc-900 rounded p-2">
                              <div className="text-green-400 text-xs mb-2">New ({change.new} items):</div>
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {JSON.stringify(
                                  // @ts-expect-error - Dynamic access to potentially undefined property
                                  uiState.pendingChanges?.data[field] || [],
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-zinc-900 rounded p-2">
                              <div className="text-red-400 text-xs mb-1">Old:</div>
                              <div className="text-gray-300 text-sm whitespace-pre-wrap">
                                {change.old || '(empty)'}
                              </div>
                            </div>
                            <div className="bg-zinc-900 rounded p-2">
                              <div className="text-green-400 text-xs mb-1">New:</div>
                              <div className="text-gray-300 text-sm whitespace-pre-wrap">
                                {change.new}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={applyApprovedChanges}
                disabled={!Object.values(uiState.changeApprovals).some(v => v)}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                Apply Selected Changes
              </button>
              <button
                onClick={() => {
                  updateUiState({
                    showConfirmation: false,
                    pendingChanges: null,
                    changeApprovals: {}
                  });
                }}
                className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
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
                type="button"
                onClick={() => {
                  setCurrentTab(tab.id);
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
                value={formData.eventName}
                onChange={(e) => updateFormData({ eventName: e.target.value })}
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
                {formData.eventBannerUrl && (
                  <div className="relative w-full h-40">
                    <Image
                      src={formData.eventBannerUrl}
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
                    value={formData.eventBannerUrl}
                    onChange={(e) => updateFormData({ eventBannerUrl: e.target.value })}
                    className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uiState.isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors shrink-0"
                  >
                    {uiState.isUploading ? (
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
                value={formData.eventDescription}
                onChange={(e) => updateFormData({ eventDescription: e.target.value })}
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
                  value={formData.startDate}
                  onChange={(e) => updateFormData({ startDate: e.target.value })}
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
                  value={formData.startTime}
                  onChange={(e) => updateFormData({ startTime: e.target.value })}
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
                  value={formData.endDate}
                  onChange={(e) => updateFormData({ endDate: e.target.value })}
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
                  value={formData.endTime}
                  onChange={(e) => updateFormData({ endTime: e.target.value })}
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
                  value={formData.organizerName}
                  onChange={(e) => updateFormData({ organizerName: e.target.value })}
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
                  value={formData.organizerContact}
                  onChange={(e) => updateFormData({ organizerContact: e.target.value })}
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
                  value={formData.visibilityType}
                  onChange={(e) => updateFormData({ visibilityType: e.target.value as 'public' | 'private' | 'whitelist' })}
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
                  value={formData.maxAttendees}
                  onChange={(e) => updateFormData({ maxAttendees: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  placeholder="Leave empty for unlimited"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Event Status
                </label>
                <select
                  value={formData.eventStatus}
                  onChange={(e) => updateFormData({ eventStatus: e.target.value as 'upcoming' | 'ongoing' | 'completed' | 'cancelled' })}
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
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm text-yellow-400 flex items-center gap-2">
                <MapPin size={16} />
                <span><strong>Required:</strong> Please select a location on the map below</span>
              </p>
            </div>
            
            <OpenMapLocationPicker
              onLocationSelect={handleLocationSelect}
              initialLocation={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : undefined}
            />

            {formData.latitude && formData.longitude && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                <p className="text-sm text-green-400">
                  ✓ Location selected: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Venue Type
              </label>
              <select
                value={formData.venueType}
                onChange={(e) => updateFormData({ venueType: e.target.value as 'indoor' | 'outdoor' | 'hybrid' })}
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
              {formData.performers.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No performers added yet. Click &quot;Add Performer&quot; to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.performers.map((performer, index) => (
                    <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-white font-medium">Performer {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => updateFormData({ performers: formData.performers.filter((_, i) => i !== index) })}
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
                              const newPerformers = [...formData.performers];
                              newPerformers[index].name = e.target.value;
                              updateFormData({ performers: newPerformers });
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
                              const newPerformers = [...formData.performers];
                              newPerformers[index].performer_type = e.target.value as 'artist' | 'speaker' | 'chef' | 'performer' | 'other';
                              updateFormData({ performers: newPerformers });
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
                              const newPerformers = [...formData.performers];
                              newPerformers[index].bio = e.target.value;
                              updateFormData({ performers: newPerformers });
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
                                  const newPerformers = [...formData.performers];
                                  newPerformers[index].image_url = e.target.value;
                                  updateFormData({ performers: newPerformers });
                                }}
                                placeholder="https://example.com/performer-photo.jpg"
                                className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                              />
                              <button
                                type="button"
                                onClick={() => performerImageInputRef.current?.click()}
                                disabled={uiState.uploadingPerformerIndex === index}
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
              {formData.schedules.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No schedule items added yet. Click &quot;Add Schedule Item&quot; to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.schedules.map((schedule, index) => (
                    <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-white font-medium">Schedule Item {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => updateFormData({ schedules: formData.schedules.filter((_, i) => i !== index) })}
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
                              const newSchedules = [...formData.schedules];
                              newSchedules[index].day_number = parseInt(e.target.value);
                              updateFormData({ schedules: newSchedules });
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
                              const newSchedules = [...formData.schedules];
                              newSchedules[index].location = e.target.value;
                              updateFormData({ schedules: newSchedules });
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
                              const newSchedules = [...formData.schedules];
                              newSchedules[index].start_time = e.target.value;
                              updateFormData({ schedules: newSchedules });
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
                              const newSchedules = [...formData.schedules];
                              newSchedules[index].end_time = e.target.value;
                              updateFormData({ schedules: newSchedules });
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
                              const newSchedules = [...formData.schedules];
                              newSchedules[index].title = e.target.value;
                              updateFormData({ schedules: newSchedules });
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
                              const newSchedules = [...formData.schedules];
                              newSchedules[index].description = e.target.value;
                              updateFormData({ schedules: newSchedules });
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
                          updateFormData({ galleryImages: [...formData.galleryImages, input.value.trim()] });
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
                        updateFormData({ galleryImages: [...formData.galleryImages, input.value.trim()] });
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
                    disabled={uiState.uploadingGalleryType === 'image'}
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
                {formData.galleryImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {formData.galleryImages.map((image, index) => {
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
                            onClick={() => updateFormData({ galleryImages: formData.galleryImages.filter((_, i) => i !== index) })}
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
                          updateFormData({ galleryVideos: [...formData.galleryVideos, input.value.trim()] });
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
                        updateFormData({ galleryVideos: [...formData.galleryVideos, input.value.trim()] });
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
                    disabled={uiState.uploadingGalleryType === 'video'}
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
                {formData.galleryVideos.length > 0 && (
                  <div className="space-y-2">
                    {formData.galleryVideos.map((video, index) => (
                      <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded-lg">
                        <span className="text-white truncate text-sm">{video}</span>
                        <button
                          type="button"
                          onClick={() => updateFormData({ galleryVideos: formData.galleryVideos.filter((_, i) => i !== index) })}
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
            {formData.faqs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No FAQs added yet. Click &quot;Add FAQ&quot; to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.faqs.map((faq, index) => (
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
                              const newFaqs = [...formData.faqs];
                              newFaqs[index].display_order = parseInt(e.target.value);
                              updateFormData({ faqs: newFaqs });
                            }}
                            className="w-16 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => updateFormData({ faqs: formData.faqs.filter((_, i) => i !== index) })}
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
                            const newFaqs = [...formData.faqs];
                            newFaqs[index].question = e.target.value;
                            updateFormData({ faqs: newFaqs });
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
                            const newFaqs = [...formData.faqs];
                            newFaqs[index].answer = e.target.value;
                            updateFormData({ faqs: newFaqs });
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
      <Toast />
    </div>
  );
}