import { supabase } from "./supabase";
import type { EventWithAttendeeInfo, Event, EventInvitationData, EventRSVPData } from "./supabase-types";

// Event discovery functions
export const getPublicEvents = async (): Promise<EventWithAttendeeInfo[]> => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("visibility_type", "public")
      .gte("start_date", new Date().toISOString().split('T')[0])
      .order("start_date", { ascending: true });

    if (error) throw error;

    return data?.map(event => {
      // Count RSVPs from JSON array
      const rsvpCount = event.event_rsvps ? 
        (Array.isArray(event.event_rsvps) ? event.event_rsvps.filter((rsvp: { rsvp_status: string }) => rsvp.rsvp_status === 'going').length : 0) : 0;
      
      return {
        ...event,
        attendee_count: rsvpCount,
        is_full: event.max_attendees ? rsvpCount >= event.max_attendees : false
      };
    }) || [];
  } catch (error) {
    console.error("Error fetching public events:", error);
    // Return empty array on any error
    return [];
  }
};

export const getMyAccessibleEvents = async (userEmail: string): Promise<EventWithAttendeeInfo[]> => {
  try {
    // Get events where user is owner or public events
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .or(`user_email.eq.${userEmail},visibility_type.eq.public`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data?.map(event => {
      // Count RSVPs from JSON array
      const rsvpCount = event.event_rsvps ? 
        (Array.isArray(event.event_rsvps) ? event.event_rsvps.filter((rsvp: { rsvp_status: string }) => rsvp.rsvp_status === 'going').length : 0) : 0;
      
      return {
        ...event,
        attendee_count: rsvpCount,
        is_full: event.max_attendees ? rsvpCount >= event.max_attendees : false
      };
    }) || [];
  } catch (error) {
    console.error("Error fetching accessible events:", error);
    return [];
  }
};

// Invitation functions
export const sendEventInvitation = async (eventId: string, email: string, invitedBy: string) => {
  try {
    // Get the current event
    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("invitations")
      .eq("id", eventId)
      .single();

    if (fetchError) throw fetchError;

    // Create new invitation object
    const newInvitation = {
      invited_email: email,
      invitation_status: 'pending',
      invited_by: invitedBy,
      invited_at: new Date().toISOString()
    };

    // Add to existing invitations array
    const currentInvitations = event?.invitations || [];
    const updatedInvitations = [...currentInvitations, newInvitation];

    const { error } = await supabase
      .from("events")
      .update({ invitations: updatedInvitations })
      .eq("id", eventId);

    if (error) throw error;
    return newInvitation;
  } catch (error) {
    console.error("Error sending invitation:", error);
    throw error;
  }
};

export const respondToInvitation = async (eventId: string, email: string, status: 'accepted' | 'declined') => {
  try {
    // Get the current event
    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("invitations")
      .eq("id", eventId)
      .single();

    if (fetchError) throw fetchError;

    // Update the invitation status in the JSON array
    const currentInvitations = event?.invitations || [];
    const updatedInvitations = currentInvitations.map((inv: EventInvitationData) => 
      inv.invited_email === email ? { ...inv, invitation_status: status } : inv
    );

    const { error } = await supabase
      .from("events")
      .update({ invitations: updatedInvitations })
      .eq("id", eventId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error responding to invitation:", error);
    throw error;
  }
};

export const getMyInvitations = async (userEmail: string): Promise<Event[]> => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .not("invitations", "is", null);

    if (error) throw error;

    // Filter events where user is invited
    const invitedEvents = data?.filter(event => {
      const invitations = event.invitations || [];
      return Array.isArray(invitations) && invitations.some((inv: EventInvitationData) => inv.invited_email === userEmail);
    }) || [];

    return invitedEvents;
  } catch (error) {
    console.error("Error fetching invitations:", error);
    throw error;
  }
};

// RSVP functions
export const respondToRSVP = async (eventId: string, userEmail: string, status: 'going' | 'not_going' | 'maybe', notes?: string) => {
  try {
    // Get the current event
    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("rsvps")
      .eq("id", eventId)
      .single();

    if (fetchError) throw fetchError;

    // Create new RSVP object
    const newRsvp = {
      user_email: userEmail,
      status: status,
      timestamp: new Date().toISOString(),
      notes: notes || null
    };

    // Update existing RSVP or add new one
    const currentRsvps = event?.rsvps || [];
    const existingRsvpIndex = currentRsvps.findIndex((rsvp: EventRSVPData) => rsvp.user_email === userEmail);
    
    let updatedRsvps;
    if (existingRsvpIndex >= 0) {
      // Update existing RSVP
      updatedRsvps = [...currentRsvps];
      updatedRsvps[existingRsvpIndex] = newRsvp;
    } else {
      // Add new RSVP
      updatedRsvps = [...currentRsvps, newRsvp];
    }

    const { error } = await supabase
      .from("events")
      .update({ rsvps: updatedRsvps })
      .eq("id", eventId);

    if (error) throw error;
    return newRsvp;
  } catch (error) {
    console.error("Error responding to RSVP:", error);
    throw error;
  }
};

export const getEventRSVPs = async (eventId: string): Promise<EventRSVPData[]> => {
  try {
    const { data: event, error } = await supabase
      .from("events")
      .select("rsvps")
      .eq("id", eventId)
      .single();

    if (error) throw error;
    return event?.rsvps || [];
  } catch (error) {
    console.error("Error fetching event RSVPs:", error);
    return [];
  }
};

export const getUserRSVPStatus = async (eventId: string, userEmail: string): Promise<string | null> => {
  try {
    // Get the event with its RSVP JSON data
    const { data: event, error } = await supabase
      .from("events")
      .select("rsvps")
      .eq("id", eventId)
      .single();

    if (error) throw error;

    // Search for user's RSVP in the JSON array
    const rsvps = event?.rsvps || [];
    const userRsvp = Array.isArray(rsvps) ? 
      rsvps.find((rsvp: EventRSVPData) => rsvp.user_email === userEmail) : 
      null;

    return userRsvp?.status || null;
  } catch (error) {
    console.error("Error fetching user RSVP status:", error);
    return null;
  }
};