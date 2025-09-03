/**
 * ArbitrageX Pro 2025 - Integration Tests Setup
 * Configuración para integration tests con base de datos real
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

// Mock para evitar conexiones blockchain reales durante integration tests
jest.mock('@arbitragex/blockchain-connectors', () => ({
  BlockchainManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getNetworkStatus: jest.fn().mockResolvedValue({
      networkId: 'ethereum',
      isHealthy: true,
      blockNumber: 18500000,
      gasPrice: '20000000000'
    }),
    scanForOpportunities: jest.fn().mockResolvedValue([]),
    executeArbitrage: jest.fn().mockResolvedValue({
      success: true,
      transactionHash: '0x1234567890abcdef',
      actualProfit: '0.025'
    })
  })),
  getNetworkConfigs: jest.fn().mockReturnValue({
    ethereum: {
      name: 'Ethereum Mainnet',
      chainId: 1,
      rpcUrl: 'https://eth-mainnet.example.com',
      enabled: true
    }
  })
}));

// Mock de Stripe para evitar llamadas reales
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test_customer' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_test_customer' })
    },
    subscriptions: {
      create: jest.fn().mockResolvedValue({ id: 'sub_test_subscription' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'sub_test_subscription' })
    },
    prices: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'price_starter', unit_amount: 2999 },
          { id: 'price_professional', unit_amount: 9999 }
        ]
      })
    }
  }));
});

console.log('🧪 Integration test mocks configured');