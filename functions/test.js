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

  // Teste de email - verifica se credenciais do Gmail estão configuradas
  if (request.url.includes('/api/test-email')) {
    const env = context.env;
    const gmailClientEmail = env.GMAIL_CLIENT_EMAIL;
    const gmailPrivateKey = env.GMAIL_PRIVATE_KEY;

    console.log('🧪 [TEST-EMAIL] Verificando credenciais do Gmail...');
    console.log('🧪 [TEST-EMAIL] GMAIL_CLIENT_EMAIL existe?', !!gmailClientEmail);
    console.log('🧪 [TEST-EMAIL] GMAIL_PRIVATE_KEY existe?', !!gmailPrivateKey);

    if (gmailClientEmail) {
      console.log('🧪 [TEST-EMAIL] Service Account:', gmailClientEmail);
    }
    if (gmailPrivateKey) {
      console.log('🧪 [TEST-EMAIL] Private Key (primeiros 50 chars):', gmailPrivateKey.substring(0, 50) + '...');
    }

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Teste de configuração Gmail API',
      gmailClientEmailExists: !!gmailClientEmail,
      gmailPrivateKeyExists: !!gmailPrivateKey,
      gmailClientEmail: gmailClientEmail || 'NOT SET',
      gmailPrivateKeyPreview: gmailPrivateKey ? gmailPrivateKey.substring(0, 50) + '...' : 'NOT SET',
      configurationStatus: (gmailClientEmail && gmailPrivateKey) ? 'CONFIGURADO' : 'INCOMPLETO',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers
    });
  }

  // Se não é /api/test, passa para next
  return context.next();
}

