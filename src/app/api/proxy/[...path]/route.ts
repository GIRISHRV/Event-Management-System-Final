import { NextRequest, NextResponse } from 'next/server';

// Prefer an explicit proxy target, then fall back to the public Supabase URL.
const SUPABASE_URL = process.env.SUPABASE_PROXY_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, params);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    },
  });
}

async function proxyRequest(req: NextRequest, paramsPromise: Promise<{ path: string[] }>) {
  try {
    const { path: pathSegments } = await paramsPromise;
    const path = pathSegments.join('/');
    const search = req.nextUrl.search;

    if (!SUPABASE_URL) {
      return NextResponse.json({
        error: 'Proxy configuration error',
        details: 'Set SUPABASE_PROXY_URL or NEXT_PUBLIC_SUPABASE_URL for the deployed environment.'
      }, { status: 500 });
    }

    const url = `${SUPABASE_URL}/${path}${search}`;

    const headers = new Headers();
    
    // Copy allowed headers from original request
    const blockedHeaders = ['host', 'connection', 'content-length', 'transfer-encoding'];
    req.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    // Bypass ngrok browser warning
    headers.set('ngrok-skip-browser-warning', 'true');
    
    // Ensure the anon key is set correctly for Supabase
    if (!SUPABASE_ANON_KEY) {
      console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
      return NextResponse.json({ 
        error: 'Proxy configuration error',
        details: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing'
      }, { status: 500 });
    }
    
    headers.set('apikey', SUPABASE_ANON_KEY);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    }

    let body: ArrayBuffer | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      try {
        const buffer = await req.arrayBuffer();
        if (buffer.byteLength > 0) {
          body = buffer;
        }
      } catch (e) {
        console.error('Error reading request body:', e);
      }
    }

    console.log(`[Proxy] ${req.method} ${path}${search || ''}`);

    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      // @ts-ignore - Next.js fetch cache options
      cache: 'no-store',
      // @ts-ignore - node-fetch / undici option for body
      duplex: 'half',
      timeout: 30000, // 30 second timeout
    });

    const data = await res.text();
    
    if (!res.ok) {
      console.error(`[Proxy] ${req.method} ${path} returned ${res.status}:`, data.substring(0, 500));
    }

    // Create response with original status and proxied data
    return new NextResponse(data, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Proxy] Error:', errorMsg);
    
    // Check if ngrok tunnel is down
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('getaddrinfo')) {
      return NextResponse.json({ 
        error: 'Supabase proxy unavailable',
        details: 'ngrok tunnel may be down. Ensure ngrok is running: npx ngrok http 54321',
        endpoint: SUPABASE_URL
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Proxy request failed', 
      details: errorMsg,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
