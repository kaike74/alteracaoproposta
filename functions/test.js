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
    let gmailPrivateKey = env.GMAIL_PRIVATE_KEY;

    console.log('🧪 [TEST-EMAIL] Verificando credenciais do Gmail...');
    console.log('🧪 [TEST-EMAIL] GMAIL_CLIENT_EMAIL existe?', !!gmailClientEmail);
    console.log('🧪 [TEST-EMAIL] GMAIL_PRIVATE_KEY existe?', !!gmailPrivateKey);

    if (gmailClientEmail) {
      console.log('🧪 [TEST-EMAIL] Service Account:', gmailClientEmail);
    }

    let privateKeyFormat = 'NOT SET';
    let extractedKey = null;

    if (gmailPrivateKey) {
      // Detectar formato da chave
      if (gmailPrivateKey.trim().startsWith('{')) {
        privateKeyFormat = 'JSON (será extraído automaticamente)';
        try {
          const jsonData = JSON.parse(gmailPrivateKey);
          if (jsonData.private_key) {
            extractedKey = jsonData.private_key;
            console.log('🧪 [TEST-EMAIL] Formato: JSON detectado, chave extraída');
          }
        } catch (e) {
          privateKeyFormat = 'JSON inválido';
        }
      } else if (gmailPrivateKey.includes('BEGIN PRIVATE KEY')) {
        privateKeyFormat = 'Chave PEM direta (formato correto)';
        extractedKey = gmailPrivateKey;
      } else {
        privateKeyFormat = 'Formato desconhecido';
      }

      if (extractedKey) {
        console.log('🧪 [TEST-EMAIL] Private Key (primeiros 50 chars):', extractedKey.substring(0, 50) + '...');
      }
    }

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Teste de configuração Gmail API',
      gmailClientEmailExists: !!gmailClientEmail,
      gmailPrivateKeyExists: !!gmailPrivateKey,
      gmailClientEmail: gmailClientEmail || 'NOT SET',
      privateKeyFormat: privateKeyFormat,
      privateKeyPreview: extractedKey ? extractedKey.substring(0, 50) + '...' : 'NOT SET',
      configurationStatus: (gmailClientEmail && gmailPrivateKey && extractedKey) ? 'CONFIGURADO ✅' : 'INCOMPLETO ❌',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers
    });
  }

  // Se não é /api/test, passa para next
  return context.next();
}

