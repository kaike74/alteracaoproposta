// Cloudflare Pages Function - NOTION API GATEWAY
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Responder OPTIONS para CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers
    });
  }

  try {
    // ===== BUSCAR TOKEN NOTION_TOKEN =====
    const notionToken = env.NOTION_TOKEN || 'ntn_d87800291735CSok9UAEgUkUBpPCLBjfwhuLV2HJG9c4cS';
    
    console.log('=== DEBUG CLOUDFLARE ===');
    console.log('1. Token existe?', !!notionToken);
    console.log('2. Usando token de env?', !!env.NOTION_TOKEN);
    console.log('3. Método:', request.method);
    console.log('4. URL:', request.url);
    console.log('========================');
    
    if (!notionToken) {
      return new Response(JSON.stringify({ 
        error: 'Token do Notion não configurado',
        debug: {
          message: 'Variável NOTION_TOKEN não encontrada',
          env_keys: Object.keys(env || {})
        }
      }), {
        status: 500,
        headers
      });
    }

    // MÉTODO GET - BUSCAR DADOS DA TABELA DE EMISSORAS
    if (request.method === 'GET') {
      let id = url.searchParams.get('id');
      
      console.log('⚠️ DEBUG GET REQUEST - TABELA DE EMISSORAS');
      console.log('URL completa:', request.url);
      console.log('Query params:', [...url.searchParams.entries()]);
      console.log('ID extraído:', id);
      
      if (!id || id.trim() === '') {
        return new Response(JSON.stringify({ 
          error: 'ID da tabela é obrigatório',
          debug: {
            receivedUrl: request.url,
            rawId: id
          }
        }), {
          status: 400,
          headers
        });
      }

      // Notion API espera ID sem hífens
      id = id.replace(/-/g, '');
      console.log('🔍 ID formatado para Notion:', id);
      console.log('🔍 Buscando tabela de emissoras:', id);

      // Buscar linhas da database no Notion usando query
      const response = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken.trim()}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      console.log('📡 Resposta Notion - Status:', response.status);
      console.log('📡 Resposta Notion - OK:', response.ok);

      if (!response.ok) {
        let errorDetails = response.statusText;
        let errorBody = {};
        
        try {
          errorBody = await response.json();
          console.log('📡 Erro Notion JSON:', errorBody);
          errorDetails = JSON.stringify(errorBody, null, 2);
        } catch (e) {
          try {
            errorDetails = await response.text();
            console.log('📡 Erro Notion texto:', errorDetails);
          } catch (e2) {
            console.log('Não foi possível ler corpo do erro');
          }
        }
        
        return new Response(JSON.stringify({ 
          error: `Erro ao buscar tabela: ${response.status}`,
          details: errorDetails,
          debug: {
            id: id,
            notionError: errorBody
          }
        }), {
          status: response.status,
          headers
        });
      }

      const notionData = await response.json();
      console.log('✅ Tabela recebida com sucesso!');
      console.log('📝 Total de registros:', notionData.results?.length || 0);

      // Função para extrair valores
      const extractValue = (prop, defaultValue = '') => {
        if (!prop) return defaultValue;
        
        switch (prop.type) {
          case 'number':
            return prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
          case 'title':
            return prop.title?.[0]?.text?.content || defaultValue;
          case 'rich_text':
            return prop.rich_text?.[0]?.text?.content || defaultValue;
          case 'date':
            return prop.date?.start || defaultValue;
          case 'select':
            return prop.select?.name || defaultValue;
          case 'multi_select':
            return prop.multi_select?.map(item => item.name).join(',') || defaultValue;
          default:
            return defaultValue;
        }
      };

      // Mapear registros da tabela
      const emissoras = notionData.results.map(row => {
        const properties = row.properties || {};
        return {
          id: row.id,
          emissora: extractValue(properties['Emissora']),
          uf: extractValue(properties['UF']),
          spots30: extractValue(properties['Spots 30"'], 0),
          valorTabela30: extractValue(properties['Valor spot 30" Tabela'], 0),
          valorNegociado30: extractValue(properties['Valor spot 30" Negociado'], 0),
          spotsTest60: extractValue(properties['Testemunhal 60"'], 0),
          valorTabelaTest60: extractValue(properties['Testemunhal 60" Tabela'], 0),
          valorNegociadoTest60: extractValue(properties['Testemunhal 60" Negociado'], 0),
          investimento: extractValue(properties['Investimento'], 0),
          investimentoTabela: extractValue(properties['Investimento Tabela'], 0)
        };
      });

      console.log('✅ Emissoras mapeadas:', emissoras);

      return new Response(JSON.stringify(emissoras), {
        status: 200,
        headers
      });
    }

    // MÉTODO PATCH - ATUALIZAR MÚLTIPLAS EMISSORAS
    if (request.method === 'PATCH') {
      const tableId = url.searchParams.get('id');
      
      if (!tableId) {
        return new Response(JSON.stringify({ 
          error: 'ID da tabela obrigatório' 
        }), {
          status: 400,
          headers
        });
      }

      let requestBody;
      try {
        requestBody = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ 
          error: 'Body inválido' 
        }), {
          status: 400,
          headers
        });
      }

      console.log('🔄 Atualizando múltiplas emissoras');
      console.log('📝 Dados recebidos:', requestBody);

      const { emissoras, changes } = requestBody;
      if (!emissoras || !Array.isArray(emissoras)) {
        return new Response(JSON.stringify({ 
          error: 'Emissoras deve ser um array' 
        }), {
          status: 400,
          headers
        });
      }

      // Processar cada alteração
      const updatePromises = [];
      
      for (const changeKey in changes) {
        const change = changes[changeKey];
        const emissora = emissoras[change.emissoraIndex];
        
        if (!emissora || !emissora.id) continue;

        // Mapear campo para nome do Notion
        const fieldMap = {
          'spots30': 'Spots 30"',
          'valorTabela30': 'Valor spot 30" Tabela',
          'valorNegociado30': 'Valor spot 30" Negociado',
          'spotsTest60': 'Testemunhal 60"',
          'valorTabelaTest60': 'Testemunhal 60" Tabela',
          'valorNegociadoTest60': 'Testemunhal 60" Negociado'
        };

        const notionField = fieldMap[change.field];
        if (!notionField) continue;

        const updateProperties = {};
        updateProperties[notionField] = { number: parseFloat(change.new) || 0 };

        const updateResponse = await fetch(`https://api.notion.com/v1/pages/${emissora.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${notionToken.trim()}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ properties: updateProperties })
        });

        updatePromises.push({
          field: change.field,
          emissoraId: emissora.id,
          promise: updateResponse.ok
        });

        if (!updateResponse.ok) {
          console.error(`❌ Erro ao atualizar ${emissora.emissora}:`, updateResponse.status);
        } else {
          console.log(`✅ ${emissora.emissora} - ${change.field} atualizado`);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Alterações processadas',
        updated: updatePromises.length,
        changes: Object.keys(changes).length
      }), {
        status: 200,
        headers
      });
    }

    // Método não suportado
    return new Response(JSON.stringify({ 
      error: 'Método não permitido' 
    }), {
      status: 405,
      headers
    });

  } catch (error) {
    console.error('💥 Erro:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Erro interno',
      details: error.message
    }), {
      status: 500,
      headers
    });
  }
}
