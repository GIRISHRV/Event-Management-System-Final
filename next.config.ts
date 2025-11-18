import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rxuthwwaelrnlmcwflfw.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https", 
        hostname: "example.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos", // For placeholder images
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com", // For placeholder images
      }
    ],
  },
};

export default nextConfig;
