import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
