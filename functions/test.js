// Cloudflare Pages Function - DEBUG
export async function onRequest(context) {
  const { request } = context;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Endpoint de teste
  if (request.url.includes('/api/test')) {
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'API funcionando',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers
    });
  }

  // Se não é /api/test, passa para next
  return context.next();
}
