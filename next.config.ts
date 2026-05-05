import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.134.1', '127.0.0.1', 'localhost'],

  // Proxy Supabase calls through Vercel to avoid CORS when using a Cloudflare tunnel.
  // Set SUPABASE_TUNNEL_URL in Vercel env vars to the current tunnel URL, e.g.:
  //   https://podcasts-breaks-imported-detroit.trycloudflare.com
  // Then set NEXT_PUBLIC_SUPABASE_URL in Vercel to:
  //   https://my-app-swart-kappa-40.vercel.app/supabase-proxy
  async rewrites() {
    const tunnelUrl = process.env.SUPABASE_TUNNEL_URL;
    if (!tunnelUrl) return [];
    return [
      {
        source: "/supabase-proxy/:path*",
        destination: `${tunnelUrl}/:path*`,
      },
    ];
  },
  images: {
    // Whitelist specific CDNs for security
    // User-provided content (performers, banners, gallery) from trusted sources
    remotePatterns: [
      // Supabase Storage
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // Azure Blob Storage
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
      // Instagram CDN
      {
        protocol: "https",
        hostname: "*.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "*.fbcdn.net",
      },
      // Google services
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleapis.com",
      },
      // Common image CDNs
      {
        protocol: "https",
        hostname: "*.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.imgur.com",
      },
      // Allow all HTTPS image sources for broad compatibility (user-provided content)
      {
        protocol: "https",
        hostname: "**",
      },
      // Allow localhost for development
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
};

export default nextConfig;
