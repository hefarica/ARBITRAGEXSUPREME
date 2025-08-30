import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimizaciones básicas de rendimiento
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  
  // Headers para mejor caché
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;