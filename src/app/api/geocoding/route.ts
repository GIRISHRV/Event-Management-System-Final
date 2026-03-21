import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter (per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Proxy for Nominatim (OpenStreetMap) API to bypass CORS/403 restrictions.
 * OSM requires a valid User-Agent, which browsers restrict.
 * Includes rate limiting to prevent abuse.
 */
export async function GET(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
        );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const format = searchParams.get('format') || 'json';
    const limit = searchParams.get('limit') || '5';
    const addressdetails = searchParams.get('addressdetails') || '1';

    let url = '';
    if (q) {
        // Search Mode
        url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=${format}&limit=${limit}&addressdetails=${addressdetails}`;
    } else if (lat && lon) {
        // Reverse Mode
        url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=${format}&addressdetails=${addressdetails}&zoom=18`;
    } else {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'EventMS/1.0 (Event Management Platform)',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: `Nominatim API error: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Geocoding Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
