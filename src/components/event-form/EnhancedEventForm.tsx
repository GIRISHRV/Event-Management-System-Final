import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm, SubmitHandler, Path, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventSchema, EventFormSchema } from "@/lib/schemas";
import { X, FileText, MapPin, Clock, ImageIcon, HelpCircle, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Event, CreateEventInput } from "@/lib/supabase-types";
import { useToast } from "@/components/ui/Toast";
import { AIEventData, EventFormData, FormTab } from "@/types/events";
import { BasicInfoTab } from "./BasicInfoTab";
import { VenueTab } from "./VenueTab";
import { ScheduleTab } from "./ScheduleTab";
import { GalleryTab } from "./GalleryTab";
import { FaqsTab } from "./FaqsTab";
import { AIChatInterface } from "@/components/ui/AIChatInterface";
import { Button } from "@/components/ui/button";
import { UnifiedModal } from "@/components/ui/UnifiedModal";

interface EnhancedEventFormProps {
  event?: Event;
  onSubmit: (data: CreateEventInput) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
  userEmail?: string;
  onAIStateChange?: (isOpen: boolean) => void;
}

export function EnhancedEventForm({
  event,
  onSubmit,
  onClose,
  isLoading = false,
  userEmail,
  onAIStateChange,
}: EnhancedEventFormProps) {
  const [currentTab, setCurrentTab] = useState<FormTab>('basic');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  
  useEffect(() => {
    setPortalTarget(document.getElementById('ai-panel-slot'));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const performerImageInputRef = useRef<HTMLInputElement>(null);
  const galleryImageInputRef = useRef<HTMLInputElement>(null);
  const galleryVideoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [isEditMode] = useState(!!event);
  const { error: toastError, success: toastSuccess, Toast } = useToast();

  // React Hook Form Setup
  // Note: Type cast needed due to react-hook-form + @hookform/resolvers type mismatch
  // See: https://github.com/react-hook-form/resolvers/issues/271
  const form = useForm<EventFormSchema>({
    resolver: zodResolver(eventSchema) as unknown as Resolver<EventFormSchema>,
    defaultValues: {
      eventName: event?.event_name || "",
      eventDescription: event?.event_description || "",
      startDate: event?.start_date || "",
      startTime: event?.start_time || "",
      endDate: event?.end_date || "",
      endTime: event?.end_time || "",
      timezone: event?.timezone || "UTC",
      eventBannerUrl: event?.event_banner_url || "",
      visibilityType: (event?.visibility_type as 'public' | 'private' | 'whitelist') || 'public',
      maxAttendees: event?.max_attendees?.toString() || "",
      organizerName: event?.organizer_name || "",
      organizerContact: event?.organizer_contact || "",
      eventStatus: (event?.event_status as 'upcoming' | 'ongoing' | 'completed' | 'cancelled') || 'upcoming',
      venueName: event?.venue_name || "",
      venueAddress: event?.venue_address || "",
      venueCity: event?.venue_city || "",
      venueLandmark: event?.venue_landmark || "",
      venueType: (event?.venue_type as 'indoor' | 'outdoor' | 'hybrid') || 'indoor',
      latitude: event?.venue_latitude || null,
      longitude: event?.venue_longitude || null,
      googleMapsUrl: event?.google_maps_url || "",
      galleryImages: event?.gallery_images || [],
      galleryVideos: event?.gallery_videos || [],
      schedules: event?.schedules || [],
      performers: event?.performers || [],
      faqs: event?.faqs || [],
    }
  });

  const { 
    register, 
    control, 
    handleSubmit, 
    setValue, 
    getValues,
    watch, 
    formState: { errors } 
  } = form;

  // Watch form data for AI detection logic
  const formData = watch();

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

  const updateUiState = useCallback((updates: Partial<typeof uiState>) => {
    setUiState(prev => ({ ...prev, ...updates }));
    
    // Handle side effects outside the state setter
    if (updates.showAIInput !== undefined && onAIStateChange) {
      onAIStateChange(updates.showAIInput);
    }
  }, [onAIStateChange]);

  // Helper to normalize text for comparison (removes extra spaces, trailing dots, etc.)
  const normalizeText = (text: string | undefined | null) => {
    if (!text) return '';
    return text.trim().replace(/\.+$/g, '.').replace(/\s+/g, ' ');
  };

  // Detect what fields will change
  const detectChanges = (aiData: AIEventData) => {
    const currentValues = getValues();
    const changes: Record<string, { old: string | number | null | undefined; new: string | number | null | undefined }> = {};
    
    if (aiData.basicInfo) {
      // Only detect real changes, ignore trivial differences
      if (aiData.basicInfo.eventName && normalizeText(aiData.basicInfo.eventName) !== normalizeText(currentValues.eventName)) {
        changes.eventName = { old: currentValues.eventName, new: aiData.basicInfo.eventName };
      }
      if (aiData.basicInfo.eventDescription && normalizeText(aiData.basicInfo.eventDescription) !== normalizeText(currentValues.eventDescription)) {
        changes.eventDescription = { old: currentValues.eventDescription, new: aiData.basicInfo.eventDescription };
      }
      if (aiData.basicInfo.startDate && aiData.basicInfo.startDate !== currentValues.startDate) {
        changes.startDate = { old: currentValues.startDate, new: aiData.basicInfo.startDate };
      }
      if (aiData.basicInfo.startTime && aiData.basicInfo.startTime !== currentValues.startTime) {
        changes.startTime = { old: currentValues.startTime, new: aiData.basicInfo.startTime };
      }
      if (aiData.basicInfo.endDate && aiData.basicInfo.endDate !== currentValues.endDate) {
        changes.endDate = { old: currentValues.endDate, new: aiData.basicInfo.endDate };
      }
      if (aiData.basicInfo.endTime && aiData.basicInfo.endTime !== currentValues.endTime) {
        changes.endTime = { old: currentValues.endTime, new: aiData.basicInfo.endTime };
      }
      if (aiData.basicInfo.organizerName && normalizeText(aiData.basicInfo.organizerName) !== normalizeText(currentValues.organizerName)) {
        changes.organizerName = { old: currentValues.organizerName, new: aiData.basicInfo.organizerName };
      }
      if (aiData.basicInfo.maxAttendees && aiData.basicInfo.maxAttendees?.toString() !== currentValues.maxAttendees) {
        changes.maxAttendees = { old: currentValues.maxAttendees, new: aiData.basicInfo.maxAttendees };
      }
    }

    if (aiData.venue) {
      if (aiData.venue.venueName && normalizeText(aiData.venue.venueName) !== normalizeText(currentValues.venueName)) {
        changes.venueName = { old: currentValues.venueName, new: aiData.venue.venueName };
      }
      if (aiData.venue.venueCity && normalizeText(aiData.venue.venueCity) !== normalizeText(currentValues.venueCity)) {
        changes.venueCity = { old: currentValues.venueCity, new: aiData.venue.venueCity };
      }
    }

    // For schedules, check both length AND content
    if (aiData.schedules) {
      const schedulesChanged = aiData.schedules.length !== currentValues.schedules.length || 
        JSON.stringify(aiData.schedules) !== JSON.stringify(currentValues.schedules);
      if (schedulesChanged) {
        changes.schedules = { old: currentValues.schedules.length, new: aiData.schedules.length };
      }
    }
    
    if (aiData.performers) {
      const performersChanged = aiData.performers.length !== currentValues.performers.length ||
        JSON.stringify(aiData.performers) !== JSON.stringify(currentValues.performers);
      if (performersChanged) {
        changes.performers = { old: currentValues.performers.length, new: aiData.performers.length };
      }
    }
    
    if (aiData.faqs) {
      const faqsChanged = aiData.faqs.length !== currentValues.faqs.length ||
        JSON.stringify(aiData.faqs) !== JSON.stringify(currentValues.faqs);
      if (faqsChanged) {
        changes.faqs = { old: currentValues.faqs.length, new: aiData.faqs.length };
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

    Object.entries(updates).forEach(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue(key as Path<EventFormSchema>, value as any, { shouldValidate: true, shouldDirty: true });
    });

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

    Object.entries(updates).forEach(([key, value]) => {
      setValue(key as Path<EventFormSchema>, value as EventFormSchema[keyof EventFormSchema], { shouldValidate: true, shouldDirty: true });
    });
  };

  // Generic upload handler - memoized for performance
  const handleFileUpload = useCallback(async (file: File, bucket: string = 'event-banners'): Promise<string | null> => {
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
  }, [updateUiState]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      setValue('eventBannerUrl', url, { shouldValidate: true, shouldDirty: true });
    }
  }, [handleFileUpload, setValue]);

  const handleLocationSelect = useCallback((location: {
    lat: number;
    lng: number;
    address?: string;
    venue_name?: string;
    venue_city?: string;
    venue_landmark?: string;
    display_name?: string;
  }) => {
    setValue('latitude', location.lat, { shouldValidate: true, shouldDirty: true });
    setValue('longitude', location.lng, { shouldValidate: true, shouldDirty: true });
    setValue('googleMapsUrl', `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`, { shouldValidate: true, shouldDirty: true });

    if (location.address) setValue('venueAddress', location.address, { shouldValidate: true, shouldDirty: true });
    if (location.venue_name) setValue('venueName', location.venue_name, { shouldValidate: true, shouldDirty: true });
    if (location.venue_city) setValue('venueCity', location.venue_city, { shouldValidate: true, shouldDirty: true });
    if (location.venue_landmark) setValue('venueLandmark', location.venue_landmark, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

  const handleAIParseInstructions = async (message?: string) => {
    const instructionsToProcess = message || uiState.aiInstructions;

    if (!instructionsToProcess.trim()) {
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
          instructions: instructionsToProcess,
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
      const newConversation = [...uiState.conversationHistory, { role: 'user' as const, content: instructionsToProcess }];

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

  // Handler for performer image upload
  const handlePerformerImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, performerIndex: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateUiState({ uploadingPerformerIndex: performerIndex });
    const url = await handleFileUpload(file, 'event-banners');
    if (url) {
      setValue(`performers.${performerIndex}.image_url`, url, { shouldValidate: true, shouldDirty: true });
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
      const currentImages = getValues('galleryImages') || [];
      setValue('galleryImages', [...currentImages, url], { shouldValidate: true, shouldDirty: true });
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
      const currentVideos = getValues('galleryVideos') || [];
      setValue('galleryVideos', [...currentVideos, url], { shouldValidate: true, shouldDirty: true });
    }
    updateUiState({ uploadingGalleryType: null });
  };

  const onFormSubmit: SubmitHandler<EventFormSchema> = async (data) => {
    // Validate location is selected
    if (!data.latitude || !data.longitude) {
      toastError("Please select a location on the map in the Venue & Location tab");
      setCurrentTab('venue');
      return;
    }

    try {
      // Create complete event data using all database fields
      const eventData: CreateEventInput = {
        // Required core fields
        user_email: userEmail || '',
        event_name: data.eventName,
        event_description: data.eventDescription || undefined,
        start_date: data.startDate,
        start_time: data.startTime,
        end_date: data.endDate,
        end_time: data.endTime,
        timezone: data.timezone,
        
        // Media and display
        event_banner_url: data.eventBannerUrl || undefined,
        
        // Event settings and configuration
        visibility_type: data.visibilityType,
        event_status: data.eventStatus,
        max_attendees: data.maxAttendees ? parseInt(data.maxAttendees) : undefined,
        
        // Venue and location information
        venue_name: data.venueName || undefined,
        venue_address: data.venueAddress || undefined,
        venue_city: data.venueCity || undefined,
        venue_landmark: data.venueLandmark || undefined,
        venue_type: data.venueType || undefined,
        venue_latitude: data.latitude || undefined,
        venue_longitude: data.longitude || undefined,
        google_maps_url: data.googleMapsUrl || undefined,
        
        // Organizer information
        organizer_name: data.organizerName || undefined,
        organizer_contact: data.organizerContact || undefined,
        organizer_email: userEmail || undefined, // Use user email as organizer email by default
        
        // JSON data arrays (only include if not empty)
        schedules: data.schedules.length > 0 ? data.schedules : [],
        performers: data.performers.length > 0 ? data.performers.map(p => ({
          ...p,
          social_links: p.social_links || undefined
        })) : [],
        gallery_images: data.galleryImages.length > 0 ? data.galleryImages : [],
        gallery_videos: data.galleryVideos.length > 0 ? data.galleryVideos : [],
        faqs: data.faqs.length > 0 ? data.faqs : [],
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

  // Memoized tabs configuration to prevent unnecessary re-renders
  const tabs = useMemo(() => [
    { id: 'basic' as FormTab, label: 'Basic Info', icon: FileText },
    { id: 'venue' as FormTab, label: 'Venue & Location *', icon: MapPin },
    { id: 'schedule-lineup' as FormTab, label: 'Schedule & Performers', icon: Clock },
    { id: 'gallery' as FormTab, label: 'Gallery', icon: ImageIcon },
    { id: 'faqs' as FormTab, label: 'FAQs', icon: HelpCircle },
  ], []);

  const aiInterface = (
    <AIChatInterface
      messages={uiState.conversationHistory}
      isThinking={uiState.isParsingAI}
      isDone={uiState.allRequiredComplete}
      onSendMessage={handleAIParseInstructions}
      onClose={() => {
        updateUiState({
          showAIInput: false,
          conversationHistory: [],
          aiQuestion: null,
          aiInstructions: '',
          allRequiredComplete: false
        });
      }}
      title={isEditMode ? 'AI Event Editor' : 'AI Event Creator'}
      fullHeight={!!portalTarget}
      placeholder={
        uiState.conversationHistory.length === 0
          ? (isEditMode 
              ? "Example: Change the event date to next Friday and add a new performer named John Doe..."
              : "Example: I want to create a music festival called 'Summer Beats' happening next month...")
          : uiState.aiQuestion || "Type your response..."
      }
    />
  );

  return (
    <div className="space-y-6">

      {/* AI Instructions Input (for both create and edit) */}
      {uiState.showAIInput && (
        portalTarget 
          ? createPortal(aiInterface, portalTarget)
          : aiInterface
      )}

      {/* AI Changes Confirmation Dialog */}
      <UnifiedModal
        isOpen={uiState.showConfirmation && !!uiState.pendingChanges}
        onClose={() => {
          updateUiState({
            showConfirmation: false,
            pendingChanges: null,
            changeApprovals: {}
          });
        }}
        title="Review AI Changes"
        size="lg"
      >
        {uiState.pendingChanges && (
          <div className="space-y-6">
            <p className="text-gray-400 text-sm">
              The AI wants to make the following changes. Check the boxes to approve individual changes:
            </p>

            <div className="space-y-3 mb-6">
              {Object.entries(detectChanges(uiState.pendingChanges.data)).map(([field, change]) => {
                const isExpanded = uiState.expandedChanges[field] || false;
                const isArray = typeof change.old === 'number' && typeof change.new === 'number';
                
                return (
                  <div key={field} className="bg-zinc-800 rounded-lg border border-zinc-700">
                    <div
                      className="flex items-start gap-3 p-3 hover:border-primary/50 cursor-pointer transition"
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
                        className="mt-1 w-4 h-4 text-primary bg-zinc-700 border-zinc-600 rounded focus:ring-primary"
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
                              <span className="text-destructive">{change.old} items</span>
                              {' → '}
                              <span className="text-primary">{change.new} items</span>
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
                              <div className="text-destructive text-xs mb-2">Old ({change.old} items):</div>
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
                              <div className="text-primary text-xs mb-2">New ({change.new} items):</div>
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {JSON.stringify(
                                  (uiState.pendingChanges?.data as Record<string, unknown>)?.[field] || [],
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-zinc-900 rounded p-2">
                              <div className="text-destructive text-xs mb-1">Old:</div>
                              <div className="text-gray-300 text-sm whitespace-pre-wrap">
                                {change.old || '(empty)'}
                              </div>
                            </div>
                            <div className="bg-zinc-900 rounded p-2">
                              <div className="text-primary text-xs mb-1">New:</div>
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
                className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
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
        )}
      </UnifiedModal>

      {/* Tab Navigation */}
      <div className="border-b border-zinc-800/50 mb-6">
        <nav className="-mb-px flex items-center justify-between overflow-x-auto scrollbar-hide">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCurrentTab(tab.id);
                  }}
                  className={`
                    group relative min-w-[100px] py-3 px-3 font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200
                    ${isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}
                  `}
                >
                  <Icon size={16} className={`transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-to-r from-emerald-500 to-teal-500 rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* AI Mode Button */}
          {!uiState.showAIInput && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => updateUiState({ showAIInput: true })}
              className="mb-2 ml-4 text-primary hover:text-primary/80 hover:bg-primary/10 gap-2"
            >
              <Sparkles size={14} />
              {event ? 'Use AI Assistant' : 'Use AI Assistant'}
            </Button>
          )}
        </nav>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Basic Information Tab */}
        {currentTab === 'basic' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <BasicInfoTab
              register={register}
              errors={errors}
              watch={watch}
              isUploading={uiState.isUploading}
              onImageUpload={handleImageUpload}
              fileInputRef={fileInputRef}
            />
          </div>
        )}

        {/* Venue & Location Tab */}
        {currentTab === 'venue' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <VenueTab
              register={register}
              errors={errors}
              watch={watch}
              onLocationSelect={handleLocationSelect}
            />
          </div>
        )}

        {/* Schedule & Performers Tab */}
        {currentTab === 'schedule-lineup' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <ScheduleTab
              register={register}
              control={control}
              uploadingPerformerIndex={uiState.uploadingPerformerIndex}
              onPerformerImageUpload={handlePerformerImageUpload}
              performerImageInputRef={performerImageInputRef}
            />
          </div>
        )}

        {/* Gallery Tab */}
        {currentTab === 'gallery' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <GalleryTab
              watch={watch}
              setValue={setValue}
              uploadingGalleryType={uiState.uploadingGalleryType}
              onGalleryImageUpload={handleGalleryImageUpload}
              onGalleryVideoUpload={handleGalleryVideoUpload}
              galleryImageInputRef={galleryImageInputRef}
              galleryVideoInputRef={galleryVideoInputRef}
            />
          </div>
        )}

        {/* FAQs Tab */}
        {currentTab === 'faqs' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300">
            <FaqsTab
              register={register}
              control={control}
              errors={errors}
            />
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
            className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white rounded-lg font-medium transition-colors"
          >
            {isLoading ? "Saving..." : (event ? "Update Event" : "Create Event")}
          </button>
        </div>
      </form>
      <Toast />
    </div>
  );
}
// End of component