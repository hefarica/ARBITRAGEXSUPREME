/**
 * ArbitrageX Pro 2025 - Prisma Configuration
 * Modern Prisma configuration replacing deprecated package.json setup
 */

export default {
  generator: {
    client: {
      provider: 'prisma-client-js',
      output: './generated/client',
      previewFeatures: ['relationJoins', 'omitApi']
    }
  },
  
  datasource: {
    db: {
      provider: 'postgresql',
      url: process.env.DATABASE_URL
    }
  },

  // Migration settings
  migrate: {
    createOnly: false,
    skipGenerate: false,
    skipSeed: false
  },

  // Seed configuration
  seed: {
    file: './scripts/seed.ts'
  },

  // Development settings
  dev: {
    watchIgnore: ['node_modules', 'dist', 'build'],
    watchExtensions: ['prisma', 'ts', 'js']
  }
};