import { NextRequest, NextResponse } from 'next/server';

const getNetworkStatus = async () => {
  // Simular variaciones en tiempo real
  const baseNetworks = [
    { id: '1', name: 'Ethereum', baseConnected: true, baseRpc: 'ACTIVE' },
    { id: '2', name: 'Polygon', baseConnected: true, baseRpc: 'ACTIVE' },
    { id: '3', name: 'BSC', baseConnected: true, baseRpc: 'ACTIVE' },
    { id: '4', name: 'Arbitrum', baseConnected: true, baseRpc: 'ACTIVE' },
    { id: '5', name: 'Optimism', baseConnected: true, baseRpc: 'ACTIVE' },
    { id: '6', name: 'Avalanche', baseConnected: false, baseRpc: 'ERROR' },
    { id: '7', name: 'Base', baseConnected: Math.random() > 0.2, baseRpc: 'ACTIVE' },
    { id: '8', name: 'Solana', baseConnected: Math.random() > 0.3, baseRpc: 'ACTIVE' }
  ];

  return baseNetworks.map(network => ({
    ...network,
    connected: network.baseConnected && Math.random() > 0.05, // 5% chance de desconexión temporal
    blockNumber: network.baseConnected ? 
      Math.floor(10000000 + Math.random() * 100000000) : 0,
    rpcStatus: network.baseConnected && Math.random() > 0.1 ? 
      (Math.random() > 0.9 ? 'SLOW' : 'ACTIVE') : 'ERROR',
    gasPrice: network.baseConnected ? 
      `${(Math.random() * 50 + 1).toFixed(1)} gwei` : 'N/A',
    lastBlock: network.baseConnected ? 
      `0x${Math.floor(Math.random() * 0xffffff).toString(16)}` : null
  }));
};

export async function GET(request: NextRequest) {
  try {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    const networks = await getNetworkStatus();
    
    return NextResponse.json({
      networks,
      timestamp: new Date().toISOString(),
      status: 'success'
    });

  } catch (error) {
    console.error('Error fetching network status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch network status',
        status: 'error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}