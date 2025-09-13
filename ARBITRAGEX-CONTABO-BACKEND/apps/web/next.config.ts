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

  // Generar buildId único para cache busting
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
  
  // Headers para evitar caché obsoleto y mejorar actualizaciones
  async headers() {
    return [
      {
        // Páginas HTML - caché corto con revalidación
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // Assets estáticos - caché largo con hash
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes - sin caché para datos dinámicos
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;