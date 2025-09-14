export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    server.accept();
    
    setInterval(() => {
      server.send(JSON.stringify({
        type: 'opportunity:new',
        payload: { profit: Math.random() * 100 }
      }));
    }, 5000);

    return new Response(client, { status: 101 });
  }
};
