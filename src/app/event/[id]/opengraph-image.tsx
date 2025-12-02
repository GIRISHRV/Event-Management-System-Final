import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const alt = 'Event Details';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// Create Supabase client for server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch event data
  const { data: event } = await supabase
    .from('events')
    .select('event_name, event_description, start_date, venue_city, event_banner_url')
    .eq('id', id)
    .single();

  const eventName = event?.event_name || 'Event';
  const eventDate = event?.start_date 
    ? new Date(event.start_date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : '';
  const venueCity = event?.venue_city || '';
  const bannerUrl = event?.event_banner_url || '';

  // Check if banner URL is valid, accessible, and a supported format
  // ImageResponse only supports: PNG, JPEG, GIF (NOT WebP)
  let useBanner = false;
  if (bannerUrl) {
    try {
      const response = await fetch(bannerUrl, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || '';
      const supportedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
      const isSupported = supportedFormats.some(format => contentType.includes(format));
      useBanner = response.ok && isSupported;
    } catch {
      useBanner = false;
    }
  }

  // If there's a valid banner image, use it as background
  if (useBanner) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            position: 'relative',
          }}
        >
          {/* Background Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          
          {/* Dark overlay gradient */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.3) 100%)',
            }}
          />
          
          {/* Green accent bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: 'linear-gradient(to right, #16a34a, #22c55e)',
            }}
          />
          
          {/* Content at bottom */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '48px 60px',
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Event Name */}
            <div
              style={{
                fontSize: 56,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '16px',
                maxWidth: '900px',
                lineHeight: 1.2,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              {eventName}
            </div>
            
            {/* Event Details */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                fontSize: 24,
                color: '#e4e4e7',
              }}
            >
              {eventDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📅 {eventDate}
                </div>
              )}
              {venueCity && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📍 {venueCity}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                <span style={{ color: '#22c55e', fontWeight: 'bold' }}>EMS</span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  }

  // Fallback: Plain design without banner

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#18181b',
          backgroundImage: 'linear-gradient(to bottom right, #18181b, #09090b)',
        }}
      >
        {/* Green accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: 'linear-gradient(to right, #16a34a, #22c55e)',
          }}
        />
        
        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
            textAlign: 'center',
          }}
        >
          {/* Event Name */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '24px',
              maxWidth: '1000px',
              lineHeight: 1.2,
            }}
          >
            {eventName}
          </div>
          
          {/* Event Details */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
              fontSize: 28,
              color: '#a1a1aa',
            }}
          >
            {eventDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                📅 {eventDate}
              </div>
            )}
            {venueCity && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                📍 {venueCity}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: 24,
            color: '#71717a',
          }}
        >
          <span style={{ color: '#22c55e', fontWeight: 'bold' }}>EMS</span>
          <span>Event Management System</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
