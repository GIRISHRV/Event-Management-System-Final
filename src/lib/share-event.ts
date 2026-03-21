/**
 * shareEvent — centralised share handler (TD-08).
 *
 * Previously duplicated verbatim in:
 *   - PublicEventListWithFavorites.tsx
 *   - EventListWithActions.tsx
 *
 * Usage:
 *   import { shareEvent } from "@/lib/share-event";
 *   await shareEvent(event);
 */

export interface ShareableEvent {
    event_name: string;
    event_description?: string | null;
    id: string;
}

/**
 * Shares an event using the Web Share API when available,
 * falling back to copying the event URL to the clipboard.
 */
export async function shareEvent(event: ShareableEvent): Promise<void> {
    const url = `${window.location.origin}/events/${event.id}`;
    const shareData: ShareData = {
        title: event.event_name,
        text: event.event_description ?? `Check out this event: ${event.event_name}`,
        url,
    };

    if (navigator.share) {
        await navigator.share(shareData);
    } else {
        await navigator.clipboard.writeText(url);
        // Callers can display a toast; this function just performs the action.
    }
}
