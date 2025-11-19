import { supabase } from "./supabase";
import type { Event, EventInvitationData } from "./supabase-types";

// Event discovery functions
export const getPublicEvents = async (): Promise<Event[]> => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("visibility_type", "public")
      .order("start_date", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    // console.error("Error fetching public events:", error);
    // Return empty array on any error
    return [];
  }
};

export const getMyAccessibleEvents = async (userEmail: string): Promise<Event[]> => {
  try {
    // Get events where user is owner or public events
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .or(`user_email.eq.${userEmail},visibility_type.eq.public`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    // console.error("Error fetching accessible events:", error);
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
    // console.error("Error sending invitation:", error);
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
    // console.error("Error responding to invitation:", error);
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
    // console.error("Error fetching invitations:", error);
    throw error;
  }
};