"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import PillNav from "@/components/PillNav";
import { RSVPButton } from "@/components/RSVPButton";
import { InviteManager } from "@/components/InviteManager";
import type { Event } from "@/lib/supabase-types";
import { ArrowLeft, Calendar, MapPin, Users, Globe, Lock, Eye, Edit2, Trash2, User, Settings, Star, X } from "lucide-react";
import Image from "next/image";
import { EventForm } from "@/components/EventForm";

export default function EventDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { session, userProfile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        console.error("Error fetching event:", error);
        setError("Event not found");
        return;
      }

      // For private events, check if user has access
      if (data.visibility_type === 'private' && (!session || data.user_email !== session.user.email)) {
        setError("This is a private event");
        return;
      }

      setEvent(data);
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to load event");
    } finally {
      setEventLoading(false);
    }
  }, [eventId, session]);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId, fetchEvent]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (!event || !confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) {
        console.error('Error deleting event:', error);
        alert('Failed to delete event. Please try again.');
        return;
      }

      router.push(userProfile?.role === 'vendor' ? '/vendor-dashboard' : '/customer-dashboard');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    } finally {
      setIsDeleting(false);
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

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-white">Loading event...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950">
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
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const navItems = session 
    ? [
        { label: "Home", href: "/" },
        { label: "Dashboard", href: userProfile?.role === "customer" ? "/customer-dashboard" : "/vendor-dashboard" }
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Sign In", href: "/signin" },
        { label: "Sign Up", href: "/signup" }
      ];

  const isOwner = session?.user?.email === event.user_email;

  return (
    <div className="min-h-screen bg-zinc-950">
      <PillNav
        items={navItems}
        activeHref="/event"
        userEmail={session?.user?.email}
        onSignOut={handleSignOut}
        showAuth={!!session}
      />
      
      <div className="relative z-20 max-w-4xl mx-auto px-6 py-12 pt-24">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl">
          {/* Event Banner */}
          {event.event_banner_url && (
            <div className="relative h-64 md:h-80">
              <Image
                src={event.event_banner_url}
                alt={event.event_name}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
            </div>
          )}

          {/* Event Content */}
          <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-3xl font-bold text-white">{event.event_name}</h1>
                  
                  {/* Visibility Badge */}
                  <div className="flex items-center gap-1">
                    {event.visibility_type === 'public' && (
                      <div className="bg-green-600/20 border border-green-600/30 rounded-full px-3 py-1 flex items-center gap-1">
                        <Globe size={14} className="text-green-400" />
                        <span className="text-xs font-medium text-green-400">PUBLIC</span>
                      </div>
                    )}
                    {event.visibility_type === 'private' && (
                      <div className="bg-gray-600/20 border border-gray-600/30 rounded-full px-3 py-1 flex items-center gap-1">
                        <Lock size={14} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-400">PRIVATE</span>
                      </div>
                    )}
                    {event.visibility_type === 'whitelist' && (
                      <div className="bg-blue-600/20 border border-blue-600/30 rounded-full px-3 py-1 flex items-center gap-1">
                        <Users size={14} className="text-blue-400" />
                        <span className="text-xs font-medium text-blue-400">INVITE ONLY</span>
                      </div>
                    )}
                  </div>
                </div>

                {event.event_description && (
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    {event.event_description}
                  </p>
                )}
              </div>

              {/* Edit/Delete Buttons - Only show to event owner */}
              {session?.user?.email === event.user_email && (
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={handleEdit}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors border border-zinc-600"
                    title="Edit Event"
                  >
                    <Edit2 size={20} />
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-2 bg-zinc-800 hover:bg-red-600 text-zinc-300 hover:text-white rounded-lg transition-colors border border-zinc-600 disabled:opacity-50"
                    title="Delete Event"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              )}
            </div>

            {/* Event Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Date & Time */}
              <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="text-green-400" size={20} />
                  <h3 className="text-white font-semibold">Date & Time</h3>
                </div>
                <div className="space-y-2 text-gray-300">
                  <p><span className="font-medium">Start:</span> {event.start_date} at {event.start_time || 'TBD'}</p>
                  <p><span className="font-medium">End:</span> {event.end_date} at {event.end_time || 'TBD'}</p>
                  {event.timezone && (
                    <p><span className="font-medium">Timezone:</span> {event.timezone}</p>
                  )}
                </div>
              </div>

              {/* Venue Information */}
              {(event.venue_name || event.venue_address) && (
                <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    <MapPin className="text-orange-400" size={20} />
                    <h3 className="text-white font-semibold">Venue</h3>
                  </div>
                  <div className="space-y-2 text-gray-300">
                    {event.venue_name && <p className="font-medium text-white">{event.venue_name}</p>}
                    {event.venue_address && <p>{event.venue_address}</p>}
                    {event.venue_city && <p>{event.venue_city}</p>}
                    {event.venue_landmark && <p><span className="font-medium">Near:</span> {event.venue_landmark}</p>}
                    {event.venue_type && <p><span className="font-medium">Type:</span> {event.venue_type}</p>}
                    {event.google_maps_url && (
                      <a href={event.google_maps_url} target="_blank" rel="noopener noreferrer" 
                         className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                        <MapPin size={14} />
                        View on Google Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* RSVP Information */}
              {event.rsvp_required && (
                <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="text-blue-400" size={20} />
                    <h3 className="text-white font-semibold">RSVP Required</h3>
                  </div>
                  <div className="space-y-2 text-gray-300">
                    {event.max_attendees && (
                      <p><span className="font-medium">Max Attendees:</span> {event.max_attendees}</p>
                    )}
                    {event.rsvp_deadline && (
                      <p><span className="font-medium">RSVP Deadline:</span> {
                        event.rsvp_deadline ? new Date(event.rsvp_deadline).toLocaleDateString() : 'Not set'
                      }</p>
                    )}
                  </div>
                </div>
              )}

              {/* Organizer Information */}
              {(event.organizer_name || event.organizer_contact) && (
                <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    <User className="text-purple-400" size={20} />
                    <h3 className="text-white font-semibold">Organizer</h3>
                  </div>
                  <div className="space-y-2 text-gray-300">
                    {event.organizer_name && <p className="font-medium text-white">{event.organizer_name}</p>}
                    {event.organizer_contact && <p>{event.organizer_contact}</p>}
                  </div>
                </div>
              )}

              {/* Event Type & Status */}
              <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <Eye className="text-purple-400" size={20} />
                  <h3 className="text-white font-semibold">Event Info</h3>
                </div>
                <div className="space-y-2 text-gray-300">
                  <p><span className="font-medium">Type:</span> {event.visibility_type === 'whitelist' ? 'Invite Only' : event.visibility_type} Event</p>
                  <p><span className="font-medium">Status:</span> <span className="capitalize">{event.event_status}</span></p>
                  {event.age_restrictions && <p><span className="font-medium">Age Restrictions:</span> {event.age_restrictions}</p>}
                </div>
              </div>

              {/* Facilities & Amenities */}
              {(event.parking_available || event.food_stalls || event.alcohol_available || event.wheelchair_access || event.kids_allowed !== undefined || event.pets_allowed !== undefined) && (
                <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                  <div className="flex items-center gap-3 mb-3">
                    <Settings className="text-yellow-400" size={20} />
                    <h3 className="text-white font-semibold">Facilities</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className={`flex items-center gap-2 ${event.parking_available ? 'text-green-400' : 'text-gray-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${event.parking_available ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      Parking
                    </div>
                    <div className={`flex items-center gap-2 ${event.food_stalls ? 'text-green-400' : 'text-gray-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${event.food_stalls ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      Food Stalls
                    </div>
                    <div className={`flex items-center gap-2 ${event.alcohol_available ? 'text-green-400' : 'text-gray-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${event.alcohol_available ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      Alcohol
                    </div>
                    <div className={`flex items-center gap-2 ${event.wheelchair_access ? 'text-green-400' : 'text-gray-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${event.wheelchair_access ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      Wheelchair Access
                    </div>
                    <div className={`flex items-center gap-2 ${event.kids_allowed ? 'text-green-400' : 'text-gray-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${event.kids_allowed ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      Kids Allowed
                    </div>
                    <div className={`flex items-center gap-2 ${event.pets_allowed ? 'text-green-400' : 'text-gray-500'}`}>
                      <div className={`w-2 h-2 rounded-full ${event.pets_allowed ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      Pets Allowed
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Event Highlights & Attractions */}
            {(event.event_highlights?.length || event.key_attractions?.length) && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Highlights & Attractions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {event.event_highlights?.length && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Event Highlights</h3>
                      <ul className="space-y-2">
                        {event.event_highlights.map((highlight, index) => (
                          <li key={index} className="text-gray-300 flex items-center gap-2">
                            <Star size={14} className="text-yellow-400" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.key_attractions?.length && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Key Attractions</h3>
                      <ul className="space-y-2">
                        {event.key_attractions.map((attraction, index) => (
                          <li key={index} className="text-gray-300 flex items-center gap-2">
                            <MapPin size={14} className="text-orange-400" />
                            {attraction}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Event Schedule */}
            {event.schedules?.length && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Event Schedule</h2>
                <div className="space-y-4">
                  {event.schedules.map((schedule, index) => (
                    <div key={index} className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
                        <h3 className="text-white font-semibold">{schedule.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>Day {schedule.day_number}</span>
                          <span>{schedule.start_time || 'TBD'} - {schedule.end_time || 'TBD'}</span>
                          {schedule.location && <span>{schedule.location}</span>}
                        </div>
                      </div>
                      {schedule.description && (
                        <p className="text-gray-300">{schedule.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performers & Lineup */}
            {event.performers?.length && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Performers & Lineup</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {event.performers.map((performer, index) => (
                    <div key={index} className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      {performer.image_url && (
                        <div className="w-16 h-16 rounded-full overflow-hidden mb-4">
                          <Image src={performer.image_url} alt={performer.name} fill className="object-cover" />
                        </div>
                      )}
                      <h3 className="text-white font-semibold mb-2">{performer.name}</h3>
                      <p className="text-sm text-gray-400 mb-2 capitalize">{performer.performer_type}</p>
                      {performer.bio && <p className="text-gray-300 text-sm">{performer.bio}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendors & Food */}
            {event.vendors?.length && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Food & Vendors</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {event.vendors.map((vendor, index) => (
                    <div key={index} className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold">{vendor.vendor_name}</h3>
                          {vendor.food_category && <p className="text-sm text-gray-400">{vendor.food_category}</p>}
                          {vendor.stall_location && <p className="text-sm text-gray-400">Location: {vendor.stall_location}</p>}
                        </div>
                      </div>
                      {vendor.vendor_description && (
                        <p className="text-gray-300 text-sm mb-3">{vendor.vendor_description}</p>
                      )}
                      {vendor.vendor_contact && (
                        <p className="text-sm text-blue-400">{vendor.vendor_contact}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safety & Guidelines */}
            {((Array.isArray(event.safety_guidelines) && event.safety_guidelines.length > 0) || 
              (typeof event.safety_guidelines === 'string' && (event.safety_guidelines as string).trim().length > 0) ||
              (event.entry_guidelines?.trim()) || 
              (event.prohibited_items?.length) || 
              (event.weather_advisory?.trim()) ||
              (event.security_measures?.trim()) ||
              (event.medical_assistance_info?.trim())) && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Safety & Guidelines</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {((Array.isArray(event.safety_guidelines) && event.safety_guidelines.length > 0) || 
                    (typeof event.safety_guidelines === 'string' && (event.safety_guidelines as string).trim().length > 0)) && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Safety Guidelines</h3>
                      <p className="text-gray-300 whitespace-pre-line">
                        {Array.isArray(event.safety_guidelines) ? event.safety_guidelines.join('\n') : event.safety_guidelines}
                      </p>
                    </div>
                  )}
                  {event.entry_guidelines?.trim() && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Entry Guidelines</h3>
                      <p className="text-gray-300 whitespace-pre-line">{event.entry_guidelines}</p>
                    </div>
                  )}
                  {event.security_measures?.trim() && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Security Measures</h3>
                      <p className="text-gray-300 whitespace-pre-line">{event.security_measures}</p>
                    </div>
                  )}
                  {event.medical_assistance_info?.trim() && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Medical Assistance</h3>
                      <p className="text-gray-300 whitespace-pre-line">{event.medical_assistance_info}</p>
                    </div>
                  )}
                  {event.prohibited_items?.length && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Prohibited Items</h3>
                      <ul className="space-y-1">
                        {event.prohibited_items.map((item, index) => (
                          <li key={index} className="text-gray-300 flex items-center gap-2">
                            <X size={14} className="text-red-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.weather_advisory?.trim() && (
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">Weather Advisory</h3>
                      <p className="text-gray-300 whitespace-pre-line">{event.weather_advisory}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FAQs */}
            {event.faqs?.length && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {event.faqs.map((faq, index) => (
                    <div key={index} className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                      <h3 className="text-white font-semibold mb-3">{faq.question}</h3>
                      <p className="text-gray-300">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {event.tags?.length && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, index) => (
                    <span key={index} className="bg-blue-600/20 border border-blue-600/30 rounded-full px-3 py-1 text-sm text-blue-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isOwner && session && (
              <div className="flex gap-4 pt-6 border-t border-zinc-700">
                <RSVPButton 
                  event={event} 
                  userEmail={session.user.email || ''}
                />
                
                {event.visibility_type === 'whitelist' && (
                  <InviteManager
                    eventId={event.id}
                    eventName={event.event_name}
                    userEmail={session.user.email || ''}
                  />
                )}
              </div>
            )}

            {!session && (
              <div className="pt-6 border-t border-zinc-700">
                <p className="text-gray-400 text-center mb-4">
                  Sign in to RSVP for this event
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => router.push('/signin')}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => router.push('/signup')}
                    className="px-6 py-2 border border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg font-medium transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && event && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-700">
              <h2 className="text-2xl font-bold text-white">Edit Event</h2>
            </div>
            <div className="p-6">
              <EventForm
                event={event}
                onSubmit={async (data) => {
                  try {
                    const { data: updatedEvent, error } = await supabase
                      .from('events')
                      .update(data)
                      .eq('id', event.id)
                      .select()
                      .single();

                    if (error) throw error;
                    
                    handleEventUpdate(updatedEvent);
                  } catch (error) {
                    const errorMessage = error && typeof error === 'object' && 'message' in error 
                      ? (error as { message: string }).message 
                      : 'Unknown error occurred';
                    const errorDetails = error && typeof error === 'object' && 'details' in error 
                      ? (error as { details: string }).details 
                      : 'No additional details';
                    
                    console.error('Error updating event:', {
                      message: errorMessage,
                      details: errorDetails,
                      fullError: JSON.stringify(error, null, 2)
                    });
                    
                    alert(`Failed to update event: ${errorMessage}`);
                    throw error;
                  }
                }}
                onClose={() => setIsEditing(false)}
                userEmail={session?.user?.email}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}