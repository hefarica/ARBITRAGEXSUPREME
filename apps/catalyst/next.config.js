/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15 - Configuraciones movidas de experimental
  typedRoutes: true,
  serverExternalPackages: ['prisma', '@prisma/client'],
  
  experimental: {
    // Solo configuraciones experimentales válidas para Next.js 15
    ppr: false, // Partial Prerendering cuando esté estable
    reactCompiler: true // React Compiler habilitado
  },
  transpilePackages: [
    '@arbitragex/shared',
    '@arbitragex/blockchain-connectors'
  ],
  env: {
    CUSTOM_KEY: 'ArbitrageX_Supreme_Catalyst_2025'
  },
  images: {
    // Next.js 15 usa remotePatterns en lugar de domains (deprecado)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com'
      },
      {
        protocol: 'https', 
        hostname: 'tokens.1inch.io'
      },
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com'
      }
    ]
  },
  // Configuración para optimización de rendimiento
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          }
        ]
      }
    ]
  },
  // Configuración de rewrites para API
  async rewrites() {
    return [
      {
        source: '/api/catalyst/:path*',
        destination: '/api/:path*'
      }
    ]
  }
}

module.exports = nextConfig