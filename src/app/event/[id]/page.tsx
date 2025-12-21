"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import PillNav from "@/components/layout/PillNav";
import { EnhancedEventForm } from "@/components/event-form/EnhancedEventForm";
import { EventChatbot } from "@/components/events/EventChatbot";
import { EventMap } from "@/components/events/EventMap";
import { InlineErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import RSVPButton from "@/components/events/RSVPButton";
import { AttendeeAvatars } from "@/components/events/AttendeeAvatars";
import { EventCountdown } from "@/components/ui/EventCountdown";
import { trackRecentlyViewed } from "@/components/events/RecentlyViewed";
import type { Event, CreateEventInput, EventPerformerData } from "@/lib/supabase-types";
import { ArrowLeft, Calendar, MapPin, Edit2, Trash2, Clock, User, ExternalLink, Zap, X, Share2, LayoutDashboard, Eye, Download } from "lucide-react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import Image from "next/image";
import { EventOrganizerView } from "@/components/event-details/EventOrganizerView";
import { downloadICS, addToGoogleCalendar } from "@/lib/calendar-export";

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/;

export default function EventDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { error: toastError, success: toastSuccess, Toast } = useToast();
  const { session, userProfile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [allGalleryItems, setAllGalleryItems] = useState<Array<{ url: string; type: 'image' | 'video'; isYoutube: boolean }>>([]);
  const [viewMode, setViewMode] = useState<'public' | 'manage'>('public');
  const [isAIOpen, setIsAIOpen] = useState(false);

  const eventId = params?.id as string;

  const fetchEvent = useCallback(async () => {
    try {
      setEventLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (error) {
        setError("Event not found");
        return;
      }

      // Check access using current session at time of fetch
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (data.visibility_type === 'private' && (!currentSession || data.user_email !== currentSession.user.email)) {
        setError("This is a private event");
        return;
      }

      setEvent(data);

      // Build unified gallery - include banner + all images + performer images + all videos
      const items: Array<{ url: string; type: 'image' | 'video'; isYoutube: boolean }> = [];
      
      // Add banner at the beginning if it exists
      if (data.event_banner_url) {
        items.push({ url: data.event_banner_url, type: 'image', isYoutube: false });
      }
      
      // Add gallery images
      if (data.gallery_images && data.gallery_images.length > 0) {
        data.gallery_images.forEach((img: string) => {
          items.push({ url: img, type: 'image', isYoutube: false });
        });
      }
      
      // Add performer images
      if (data.performers && data.performers.length > 0) {
        data.performers.forEach((performer: EventPerformerData) => {
          if (performer.image_url) {
            items.push({ url: performer.image_url, type: 'image', isYoutube: false });
          }
        });
      }
      
      // Add videos and detect YouTube
      if (data.gallery_videos && data.gallery_videos.length > 0) {
        data.gallery_videos.forEach((video: string) => {
          const isYoutube = YOUTUBE_REGEX.test(video);
          items.push({ url: video, type: 'video', isYoutube });
        });
      }
      
      setAllGalleryItems(items);
    } catch {
      setError("Failed to load event");
    } finally {
      setEventLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId, fetchEvent]);

  // Track recently viewed event
  useEffect(() => {
    if (event && session?.user?.id) {
      trackRecentlyViewed(session.user.id, event.id);
    }
  }, [event, session?.user?.id]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = () => {
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!event) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) {
        // console.error('Error deleting event:', error);
        toastError('Failed to delete event. Please try again.');
        return;
      }

      router.push(userProfile?.role === 'vendor' ? '/vendor-dashboard' : '/customer-dashboard');
    } catch {
      // console.error('Error deleting event:', error);
      toastError('Failed to delete event. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const handleEventUpdate = (updatedEvent: Event) => {
    setEvent(updatedEvent);
    setIsEditing(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const isOwner = event ? session?.user?.email === event.user_email : false;
  const formattedDate = event ? new Date(event.start_date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  }) : '';

  const navItems = session 
    ? [
        { label: "Home", href: "/" },
        { label: "Events", href: "/events" },
        { label: "Dashboard", href: userProfile?.role === "customer" ? "/customer-dashboard" : "/vendor-dashboard" }
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Events", href: "/events" },
        { label: "Sign In", href: "/signin" },
        { label: "Sign Up", href: "/signup" }
      ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <LoadingScreen message="Loading event details..." isLoading={eventLoading} />

      {error ? (
        <>
          <PillNav
            items={[
              { label: "Home", href: "/" },
              ...(session ? [{ label: "Dashboard", href: userProfile?.role === "customer" ? "/customer-dashboard" : "/vendor-dashboard" }] : [])
            ]}
            activeHref="/event"
            userEmail={session?.user?.email}
            onSignOut={handleSignOut}
            showAuth={!!session}
          />
          
          <div className="relative z-20 max-w-4xl mx-auto px-6 py-12 pt-24">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-4">Event Not Found</h1>
              <p className="text-red-400 mb-8">{error}</p>
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
                Go Back
              </button>
            </div>
          </div>
        </>
      ) : event && (
        <>
          <PillNav
            items={navItems}
            activeHref="/event"
            userEmail={session?.user?.email}
            onSignOut={handleSignOut}
            showAuth={!!session}
          />

          <div className="pt-20">
        {/* Hero Section with Banner */}
        <div className="relative h-96 bg-zinc-900 overflow-hidden group cursor-pointer" onClick={() => {
          // Open gallery modal at the banner (first image)
          setGalleryIndex(0);
          setSelectedImage(allGalleryItems[0]?.url || null);
        }}>
          {event.event_banner_url ? (
            <Image
              src={event.event_banner_url}
              alt={event.event_name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-green-900 via-zinc-900 to-zinc-950 flex items-center justify-center">
              <Calendar className="w-24 h-24 text-zinc-700" />
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-6 left-6 z-10">
          <button
            onClick={() => router.back()}
            className="p-2 bg-black/40 hover:bg-black/60 rounded-lg backdrop-blur transition-colors"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
        </div>

          {/* Event Title and Status Badge - Positioned on the overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="px-3 py-1 bg-green-600/90 text-white text-sm font-medium rounded-full">
                    {event.event_status}
                  </span>
                  <span className="px-3 py-1 bg-white/10 text-white text-sm font-medium rounded-full backdrop-blur">
                    {event.visibility_type === 'public' ? 'Public' : event.visibility_type === 'private' ? 'Private' : 'Invite Only'}
                  </span>
                  <EventCountdown startDate={event.start_date} startTime={event.start_time} compact={false} />
                </div>
                <h1 className="text-5xl font-bold text-white leading-tight max-w-3xl">{event.event_name}</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="max-w-6xl mx-auto px-6 py-4 flex gap-3 flex-wrap items-center">
          {!isOwner && <RSVPButton eventId={event.id} />}
          
          {/* Attendee Avatars */}
          <AttendeeAvatars eventId={event.id} maxDisplay={5} />
          
          {isOwner && (
            <>
              <button
                onClick={() => setViewMode(viewMode === 'public' ? 'manage' : 'public')}
                className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                  viewMode === 'manage' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
              >
                {viewMode === 'public' ? <LayoutDashboard size={18} /> : <Eye size={18} />}
                {viewMode === 'public' ? 'Manage Event' : 'View Public Page'}
              </button>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                <Edit2 size={18} />
                Edit Event
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={18} />
                Delete Event
              </button>
            </>
          )}

          {/* Share Button - Available for all */}
          <button
            onClick={() => setShowShareModal(!showShareModal)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Share2 size={18} />
            Share Event
          </button>
        </div>

        {/* Share Modal - Below buttons */}
        {showShareModal && (
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-700/50 backdrop-blur p-4 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-3">Share Event Link</h3>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={typeof window !== 'undefined' ? `${window.location.origin}/event/${eventId}` : ''}
                    readOnly
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/event/${eventId}`);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {copySuccess ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-700/50 pt-4">
                <h3 className="text-white font-semibold mb-3">Add to Calendar</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadICS(event)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <Download size={16} />
                    Download .ics
                  </button>
                  <button
                    onClick={() => addToGoogleCalendar(event)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <Calendar size={16} />
                    Google Calendar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {viewMode === 'manage' ? (
          <div className="max-w-6xl mx-auto px-6 py-12">
            <EventOrganizerView eventId={event.id} eventCapacity={event.max_attendees} />
          </div>
        ) : (
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Date and Time */}
            <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50 backdrop-blur">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-600/10 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-1">DATE & TIME</h3>
                  <p className="text-lg font-semibold text-white">{formattedDate}</p>
                  <p className="text-sm text-gray-400">
                    {event.start_time} {event.timezone && `(${event.timezone})`}
                  </p>
                </div>
              </div>
            </div>

            {/* Location */}
            {event.venue_name && (
              <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-600/10 rounded-lg">
                    <MapPin className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">LOCATION</h3>
                    <p className="text-lg font-semibold text-white">{event.venue_name}</p>
                    {event.venue_city && <p className="text-sm text-gray-400">{event.venue_city}</p>}
                    {event.google_maps_url && (
                      <a
                        href={event.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-500 hover:text-green-400 flex items-center gap-1 mt-2"
                      >
                        Open in Maps <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Organizer */}
            {event.organizer_name && (
              <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50 backdrop-blur">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-600/10 rounded-lg">
                    <User className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">ORGANIZER</h3>
                    <p className="text-lg font-semibold text-white">{event.organizer_name}</p>
                    {event.organizer_contact && (
                      <p className="text-sm text-gray-400">{event.organizer_contact}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description Section */}
          {event.event_description && (
            <div className="mb-12">
              <div className="bg-zinc-900/50 rounded-xl p-8 border border-zinc-800/50 backdrop-blur">
                <h2 className="text-2xl font-bold text-white mb-4">About This Event</h2>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {event.event_description}
                </p>
              </div>
            </div>
          )}

          {/* Map Section */}
          {event.venue_latitude && event.venue_longitude && (
            <InlineErrorBoundary name="Map">
              <EventMap event={event} nearbyEvents={[]} />
            </InlineErrorBoundary>
          )}

          {/* Schedule Section */}
          {event.schedules && event.schedules.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Schedule</h2>
              <div className="space-y-4">
                {event.schedules.map((schedule, index) => (
                  <div key={index} className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50 backdrop-blur hover:border-green-500/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-green-600/10 rounded-lg">
                        <Clock className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">{schedule.title}</h3>
                          <span className="text-sm text-gray-400">
                            Day {schedule.day_number}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                          {schedule.start_time} - {schedule.end_time}
                        </p>
                        {schedule.location && (
                          <p className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                            <MapPin size={14} /> {schedule.location}
                          </p>
                        )}
                        {schedule.description && (
                          <p className="text-gray-300 text-sm">{schedule.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performers Section */}
          {event.performers && event.performers.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Performers & Artists</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {event.performers.map((performer, index) => (
                  <div key={index} className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50 backdrop-blur hover:border-green-500/30 transition-colors">
                    <div className="flex gap-4">
                      {performer.image_url && (
                        <div className="shrink-0 cursor-pointer" onClick={() => performer.image_url && setSelectedImage(performer.image_url)}>
                          <Image
                            src={performer.image_url}
                            alt={performer.name}
                            width={80}
                            height={80}
                            className="w-20 h-20 rounded-lg object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">{performer.name}</h3>
                        <p className="text-xs text-green-500 mb-2 capitalize">{performer.performer_type}</p>
                        {performer.bio && (
                          <p className="text-sm text-gray-300">{performer.bio}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gallery Section */}
          {allGalleryItems.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Gallery</h2>
              
              {/* Unified Gallery Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allGalleryItems.map((item, index) => (
                  <div 
                    key={index} 
                    className="relative group overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800/50 cursor-pointer hover:border-green-500/30 transition-colors"
                    onClick={() => {
                      setGalleryIndex(index);
                      if (item.type === 'image') {
                        setSelectedImage(item.url);
                      } else {
                        // For videos, we'll handle it in the modal
                        setSelectedImage(item.url);
                      }
                    }}
                  >
                    {item.type === 'image' ? (
                      <Image
                        src={item.url}
                        alt={`Gallery item ${index + 1}`}
                        width={300}
                        height={300}
                        className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : item.isYoutube ? (
                      <div className="w-full h-40 bg-black flex items-center justify-center relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-40 bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Zap className="w-8 h-8 text-green-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQs Section */}
          {event.faqs && event.faqs.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {event.faqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-zinc-900/50 rounded-xl border border-zinc-800/50 backdrop-blur overflow-hidden hover:border-green-500/30 transition-colors"
                  >
                    <summary className="p-6 cursor-pointer flex items-center justify-between">
                      <h3 className="font-semibold text-white group-open:text-green-500 transition-colors">
                        {faq.question}
                      </h3>
                      <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-6 pb-6 text-gray-300 border-t border-zinc-800">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Gallery Modal */}
      {selectedImage && allGalleryItems.length > 0 && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-2 z-50 backdrop-blur-sm">
          <div className="bg-zinc-950 rounded-2xl w-full max-w-6xl max-h-[96vh] overflow-hidden flex flex-col border border-zinc-800/50 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700/50 bg-linear-to-r from-zinc-900 to-zinc-800">
              <h3 className="text-lg font-semibold text-white">
                {allGalleryItems[galleryIndex]?.type === 'image' ? '📷' : '🎬'} Gallery {galleryIndex + 1} / {allGalleryItems.length}
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Modal Content - Full Height */}
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/50">
              {allGalleryItems[galleryIndex]?.type === 'image' ? (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <Image
                    src={allGalleryItems[galleryIndex].url}
                    alt={`Gallery item ${galleryIndex + 1}`}
                    width={2000}
                    height={1500}
                    className="max-w-full max-h-full object-contain"
                    priority
                  />
                </div>
              ) : allGalleryItems[galleryIndex]?.isYoutube ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  {(() => {
                    const videoUrl = allGalleryItems[galleryIndex].url;
                    const match = videoUrl.match(YOUTUBE_REGEX);
                    const videoId = match ? match[1] : null;
                    return videoId ? (
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${videoId}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded-lg max-w-full max-h-full"
                        style={{ minHeight: '400px', minWidth: '400px' }}
                      />
                    ) : null;
                  })()}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <video
                    src={allGalleryItems[galleryIndex].url}
                    controls
                    className="max-w-full max-h-full rounded-lg"
                    style={{ minHeight: '400px', minWidth: '400px' }}
                  />
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            {allGalleryItems.length > 1 && (
              <div className="flex items-center justify-between gap-4 p-6 border-t border-zinc-700/50 bg-linear-to-r from-zinc-900 to-zinc-800">
                <button
                  onClick={() => setGalleryIndex((galleryIndex - 1 + allGalleryItems.length) % allGalleryItems.length)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  ← Previous
                </button>
                
                {/* Thumbnail Preview */}
                <div className="flex-1 flex gap-2 overflow-x-auto justify-center">
                  {allGalleryItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setGalleryIndex(idx);
                      }}
                      className={`shrink-0 w-16 h-16 rounded-lg border-2 transition-all overflow-hidden ${
                        idx === galleryIndex ? 'border-green-500 scale-110' : 'border-zinc-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {item.type === 'image' ? (
                        <Image
                          src={item.url}
                          alt={`Thumbnail ${idx}`}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : item.isYoutube ? (
                        <div className="w-full h-full bg-red-600 flex items-center justify-center text-white text-xs font-bold">
                          YT
                        </div>
                      ) : (
                        <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          VID
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setGalleryIndex((galleryIndex + 1) % allGalleryItems.length)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && event && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 z-50 backdrop-blur-sm overflow-x-auto">
          <div className={`flex items-stretch gap-6 transition-all duration-500 w-full max-w-[95vw] ${isAIOpen ? '' : 'justify-center'}`}>
            {/* AI Panel Slot */}
            <div 
              id="ai-panel-slot" 
              className={`shrink-0 transition-all duration-500 ease-in-out ${isAIOpen ? 'w-1/2 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-10 hidden'}`} 
            />

            <div className={`bg-zinc-950 rounded-2xl max-h-[92vh] overflow-hidden flex flex-col border border-zinc-800/50 shadow-2xl transition-all duration-500 ease-in-out ${isAIOpen ? 'w-1/2' : 'w-full max-w-5xl'}`}>
              {/* Modal Header */}
              <div className="sticky top-0 bg-linear-to-r from-zinc-900 to-zinc-800 px-8 py-5 border-b border-zinc-700/50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Edit Event</h2>
                  <p className="text-sm text-gray-400 mt-1">{event.event_name}</p>
                </div>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setIsAIOpen(false);
                  }}
                  className="p-2 hover:bg-zinc-700 rounded-lg transition-colors text-gray-400 hover:text-white shrink-0"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-8">
                  <EnhancedEventForm
                    event={event}
                    onSubmit={async (data: CreateEventInput) => {
                      try {
                        const { data: updatedEvent, error } = await supabase
                          .from('events')
                          .update(data)
                          .eq('id', event.id)
                          .select()
                          .single();

                        if (error) throw error;
                        
                        toastSuccess("Event updated successfully!");
                        handleEventUpdate(updatedEvent);
                      } catch (error) {
                        const errorMessage = error && typeof error === 'object' && 'message' in error 
                          ? (error as { message: string }).message 
                          : 'Unknown error occurred';
                        
                        toastError(`Failed to update event: ${errorMessage}`);
                        throw error;
                      }
                    }}
                    onClose={() => {
                      setIsEditing(false);
                      setIsAIOpen(false);
                    }}
                    userEmail={session?.user?.email}
                    onAIStateChange={setIsAIOpen}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Chatbot - appears only for public events */}
      {event && event.visibility_type === "public" && !isEditing && <EventChatbot event={event} />}
      
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
        confirmText="Delete Event"
        isDestructive={true}
        isLoading={isDeleting}
      />
      
      <Toast />
        </>
      )}
    </div>
  );
}
