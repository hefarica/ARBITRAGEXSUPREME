/**
 * ArbitrageX Supreme - Test Setup
 * Ingenio Pichichi S.A. - Configuración global para tests
 * 
 * Implementación metodica y disciplinada para:
 * - Setup de @testing-library/jest-dom
 * - Mocks globales
 * - Configuración de entorno de test
 */

import '@testing-library/jest-dom'

// Mock de Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
      isLocaleDomain: true,
      isReady: true,
      defaultLocale: 'en',
      domainLocales: [],
      isPreview: false,
    }
  },
}))

// Mock de Next.js navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock de ethers.js
jest.mock('ethers', () => ({
  ethers: {
    isAddress: jest.fn().mockReturnValue(true),
    verifyTypedData: jest.fn().mockReturnValue('0x123...'),
    formatEther: jest.fn().mockReturnValue('1.0'),
    parseEther: jest.fn().mockReturnValue('1000000000000000000'),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1, name: 'homestead' }),
      getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
      getGasPrice: jest.fn().mockResolvedValue('20000000000'),
    })),
  },
}))

// Mock de Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    blockchain: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    protocol: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    arbitrageOpportunity: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: {}, _avg: {} }),
    },
    liquidityPool: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    securityAlert: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    systemMetric: {
      create: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}))

// Mock de crypto (Web Crypto API)
const mockCrypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
  getRandomValues: jest.fn().mockImplementation((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256)
    }
    return arr
  }),
}

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
})

// Mock de fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
) as jest.Mock

// Mock de localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock de sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

// Mock de window.ethereum (MetaMask)
Object.defineProperty(window, 'ethereum', {
  value: {
    isMetaMask: true,
    request: jest.fn().mockResolvedValue(['0x123456789']),
    on: jest.fn(),
    removeListener: jest.fn(),
    selectedAddress: '0x123456789',
    chainId: '0x1',
  },
  writable: true,
})

// Setup de timezone para tests consistentes
process.env.TZ = 'UTC'

// Increase timeout for async operations
jest.setTimeout(10000)

// Suppress console errors in tests (optional)
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})