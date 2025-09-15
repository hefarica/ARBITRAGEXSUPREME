export function handleError(error: any, context: string): Response {
  console.error(`Error in ${context}:`, error);
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  return new Response(JSON.stringify({
    error: 'Internal Server Error',
    message: errorMessage,
    context,
    timestamp: new Date().toISOString()
  }), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
