import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  
  // Fetch event data
  const { data: event } = await supabase
    .from('events')
    .select('event_name, event_description, start_date, venue_city, event_banner_url')
    .eq('id', id)
    .single();

  if (!event) {
    return {
      title: 'Event Not Found | EMS',
      description: 'This event could not be found.',
    };
  }

  const eventDate = event.start_date 
    ? new Date(event.start_date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : '';

  const title = `${event.event_name}${eventDate ? ` | ${eventDate}` : ''}${event.venue_city ? ` | ${event.venue_city}` : ''}`;
  const description = event.event_description 
    ? event.event_description.slice(0, 160) + (event.event_description.length > 160 ? '...' : '')
    : `Join us for ${event.event_name}${event.venue_city ? ` in ${event.venue_city}` : ''}`;

  return {
    title: `${title} | EMS`,
    description,
    openGraph: {
      title: event.event_name,
      description,
      type: 'website',
      siteName: 'EMS - Event Management System',
      images: event.event_banner_url ? [
        {
          url: event.event_banner_url,
          width: 1200,
          height: 630,
          alt: event.event_name,
        }
      ] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: event.event_name,
      description,
      images: event.event_banner_url ? [event.event_banner_url] : undefined,
    },
  };
}

export default function EventLayout({ children }: Props) {
  return children;
}
