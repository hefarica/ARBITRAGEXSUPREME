export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    server.accept();
    
    // Simular eventos en producción esto vendría del backend
    const interval = setInterval(() => {
      try {
        server.send(JSON.stringify({
          type: 'opportunity:new',
          payload: {
            chain: 'ethereum',
            tokens: ['WETH', 'USDC'],
            profit: Math.random() * 100 + 50,
            timestamp: Date.now()
          }
        }));
      } catch (e) {
        clearInterval(interval);
        server.close();
      }
    }, 5000);

    server.addEventListener('close', () => {
      clearInterval(interval);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
};

interface Env {
  OPPORTUNITIES_KV: KVNamespace;
}
