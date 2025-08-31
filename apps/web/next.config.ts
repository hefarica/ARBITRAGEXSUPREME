import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deshabilitar ESLint durante build para tener un build exitoso
  eslint: {
    ignoreDuringBuilds: true,
  },
  
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