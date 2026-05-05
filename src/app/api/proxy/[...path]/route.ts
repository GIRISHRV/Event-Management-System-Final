import { NextRequest, NextResponse } from 'next/server';

// The local Supabase instance (via ngrok tunnel)
const SUPABASE_URL = 'https://exfoliate-speed-underdog.ngrok-free.dev';
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

    console.log(`Proxying ${req.method} ${url}`);

    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      // @ts-ignore - Next.js fetch cache options
      cache: 'no-store',
      // @ts-ignore - node-fetch / undici option for body
      duplex: 'half',
    });

    const data = await res.text();
    
    if (!res.ok) {
      console.error(`Supabase returned error ${res.status}:`, data);
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
    console.error('Proxy error:', error);
    return NextResponse.json({ 
      error: 'Proxy failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
