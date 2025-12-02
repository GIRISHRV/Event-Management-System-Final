import type { Event } from "./supabase-types";

/**
 * Generate an ICS file content for an event
 */
export function generateICS(event: Event): string {
  const formatDate = (date: string, time?: string): string => {
    const d = new Date(date);
    if (time) {
      const [hours, minutes] = time.split(":");
      d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    }
    // Format: YYYYMMDDTHHMMSSZ
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  const startDateTime = formatDate(event.start_date, event.start_time);
  const endDateTime = event.end_date
    ? formatDate(event.end_date, event.end_time)
    : formatDate(event.start_date, event.end_time || event.start_time);

  const location = [
    event.venue_name,
    event.venue_address,
    event.venue_city,
  ]
    .filter(Boolean)
    .join(", ");

  const description = [
    event.event_description,
    event.google_maps_url ? `\n\nMap: ${event.google_maps_url}` : "",
    event.organizer_name ? `\n\nOrganizer: ${event.organizer_name}` : "",
    event.organizer_contact ? `\nContact: ${event.organizer_contact}` : "",
  ]
    .filter(Boolean)
    .join("");

  const uid = `${event.id}@eventmanagement.app`;
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Management System//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${startDateTime}`,
    `DTEND:${endDateTime}`,
    `SUMMARY:${escapeText(event.event_name)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : "",
    location ? `LOCATION:${escapeText(location)}` : "",
    event.google_maps_url ? `URL:${event.google_maps_url}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return icsContent;
}

/**
 * Download an ICS file for an event
 */
export function downloadICS(event: Event): void {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.event_name.replace(/[^a-z0-9]/gi, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Add event to Google Calendar (opens in new tab)
 */
export function addToGoogleCalendar(event: Event): void {
  const formatGoogleDate = (date: string, time?: string): string => {
    const d = new Date(date);
    if (time) {
      const [hours, minutes] = time.split(":");
      d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    }
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const startDate = formatGoogleDate(event.start_date, event.start_time);
  const endDate = event.end_date
    ? formatGoogleDate(event.end_date, event.end_time)
    : formatGoogleDate(event.start_date, event.end_time || event.start_time);

  const location = [
    event.venue_name,
    event.venue_address,
    event.venue_city,
  ]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.event_name,
    dates: `${startDate}/${endDate}`,
    details: event.event_description || "",
    location: location,
  });

  window.open(
    `https://calendar.google.com/calendar/render?${params.toString()}`,
    "_blank"
  );
}
