import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stack contract: frontend.framework=next, frontend.next_version=15
  reactStrictMode: true,

  // PWA — service worker served from /public
  // No pwa library at preview tier; bare sw.js is sufficient
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Service-Worker-Allowed", value: "/" },
        { key: "Cache-Control", value: "no-cache" },
      ],
    },
    {
      source: "/manifest.json",
      headers: [
        { key: "Content-Type", value: "application/manifest+json" },
      ],
    },
  ],

  // Image optimization — allow GCS bucket
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
    ],
  },

  // Experimental — Server Components are the default in app router
  // No extra config needed for Next.js 15
};

export default nextConfig;
