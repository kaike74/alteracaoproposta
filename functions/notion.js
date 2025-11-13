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
    const notionToken = 'ntn_d87800291735CSok9UAEgUkUBpPCLBjfwhuLV2HJG9c4cS';
    
    console.log('=== DEBUG CLOUDFLARE ===');
    console.log('1. Token existe?', !!notionToken);
    console.log('2. Método:', request.method);
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

    // MÉTODO GET - BUSCAR DADOS DA PROPOSTA
    if (request.method === 'GET') {
      const id = url.searchParams.get('id');
      
      console.log('⚠️ DEBUG GET REQUEST');
      console.log('URL completa:', request.url);
      console.log('Query params:', [...url.searchParams.entries()]);
      console.log('ID extraído:', id);
      
      if (!id || id.trim() === '') {
        return new Response(JSON.stringify({ 
          error: 'ID do registro é obrigatório',
          debug: {
            receivedUrl: request.url,
            rawId: id
          }
        }), {
          status: 400,
          headers
        });
      }

      console.log('🔍 Buscando proposta:', id);

      // Buscar dados da página no Notion
      const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        headers: {
          'Authorization': `Bearer ${notionToken.trim()}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        let errorDetails = response.statusText;
        try {
          errorDetails = JSON.stringify(await response.json());
        } catch (e) {
          try {
            errorDetails = await response.text();
          } catch (e2) {
            console.log('Não foi possível ler corpo do erro');
          }
        }
        
        return new Response(JSON.stringify({ 
          error: `Erro ao buscar proposta: ${response.status}`,
          details: errorDetails
        }), {
          status: response.status,
          headers
        });
      }

      const notionData = await response.json();
      console.log('✅ Proposta recebida com sucesso!');

      const properties = notionData.properties || {};
      
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

      // Mapear dados da proposta
      const proposalData = {
        id: id,
        region: extractValue(properties['Região']),
        uf: extractValue(properties['UF']),
        praca: extractValue(properties['Praça']),
        emissora: extractValue(properties['Emissora']),
        
        // Spots 30"
        spots30: extractValue(properties['Spots 30"'], 0),
        valorTabela30: extractValue(properties['Valor spot 30" (Tab.)'], 0),
        valorNegociado30: extractValue(properties['Valor spot 30" (Negociado)'], 0),
        
        // Spots 60"
        spots60: extractValue(properties['Spots 60"'], 0),
        valorTabela60: extractValue(properties['Valor spot 60" (Tab.)'], 0),
        valorNegociado60: extractValue(properties['Valor spot 60" (Negociado)'], 0),
        
        // Spots 5"
        spots5: extractValue(properties['Spots 5"'], 0),
        valorTabela5: extractValue(properties['Valor spot 5" (Tab.)'], 0),
        valorNegociado5: extractValue(properties['Valor spot 5" (Negociado)'], 0),
        
        // Blitz
        spotsBlitz: extractValue(properties['Spots Blitz'], 0),
        valorTabelaBlitz: extractValue(properties['Valor Blitz (Tab.)'], 0),
        valorNegociadoBlitz: extractValue(properties['Valor Blitz (Negociado)'], 0),
        
        // Testemunhal 60"
        spotsTest60: extractValue(properties['Testemunhal 60"'], 0),
        valorTabelaTest60: extractValue(properties['Valor testemunhal 60" (Tab.)'], 0),
        valorNegociadoTest60: extractValue(properties['Valor testemunhal 60" (Negociado)'], 0),
        
        // Totais
        investimentoTabela: extractValue(properties['Investimento Tabela'], 0),
        investimentoTotal: extractValue(properties['Investimento'], 0),
        
        // Campos de controle
        selected: extractValue(properties['Selecionada'], true),
        createdTime: notionData.created_time,
        lastEditedTime: notionData.last_edited_time
      };

      console.log('✅ Proposta mapeada:', proposalData);

      return new Response(JSON.stringify(proposalData), {
        status: 200,
        headers
      });
    }

    // MÉTODO PATCH - ATUALIZAR PROPOSTA
    if (request.method === 'PATCH') {
      const id = url.searchParams.get('id');
      
      if (!id) {
        return new Response(JSON.stringify({ 
          error: 'ID obrigatório' 
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

      console.log('🔄 Atualizando proposta:', id);
      console.log('📝 Dados recebidos:', requestBody);

      // Mapear campos para Notion
      const updateProperties = {};

      // Spots 30"
      if (requestBody.spots30 !== undefined) {
        updateProperties['Spots 30"'] = { number: parseFloat(requestBody.spots30) || 0 };
      }
      if (requestBody.valorNegociado30 !== undefined) {
        updateProperties['Valor spot 30" (Negociado)'] = { number: parseFloat(requestBody.valorNegociado30) || 0 };
      }

      // Spots 60"
      if (requestBody.spots60 !== undefined) {
        updateProperties['Spots 60"'] = { number: parseFloat(requestBody.spots60) || 0 };
      }
      if (requestBody.valorNegociado60 !== undefined) {
        updateProperties['Valor spot 60" (Negociado)'] = { number: parseFloat(requestBody.valorNegociado60) || 0 };
      }

      // Spots 5"
      if (requestBody.spots5 !== undefined) {
        updateProperties['Spots 5"'] = { number: parseFloat(requestBody.spots5) || 0 };
      }
      if (requestBody.valorNegociado5 !== undefined) {
        updateProperties['Valor spot 5" (Negociado)'] = { number: parseFloat(requestBody.valorNegociado5) || 0 };
      }

      // Blitz
      if (requestBody.spotsBlitz !== undefined) {
        updateProperties['Spots Blitz'] = { number: parseFloat(requestBody.spotsBlitz) || 0 };
      }
      if (requestBody.valorNegociadoBlitz !== undefined) {
        updateProperties['Valor Blitz (Negociado)'] = { number: parseFloat(requestBody.valorNegociadoBlitz) || 0 };
      }

      // Testemunhal 60"
      if (requestBody.spotsTest60 !== undefined) {
        updateProperties['Testemunhal 60"'] = { number: parseFloat(requestBody.spotsTest60) || 0 };
      }
      if (requestBody.valorNegociadoTest60 !== undefined) {
        updateProperties['Valor testemunhal 60" (Negociado)'] = { number: parseFloat(requestBody.valorNegociadoTest60) || 0 };
      }

      // Seleção de emissora
      if (requestBody.selected !== undefined) {
        updateProperties['Selecionada'] = { checkbox: Boolean(requestBody.selected) };
      }

      // Fazer requisição de atualização
      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${notionToken.trim()}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: updateProperties
        })
      });

      if (!updateResponse.ok) {
        console.error('❌ Erro ao atualizar:', updateResponse.status);
        let errorDetails = updateResponse.statusText;
        try {
          errorDetails = await updateResponse.text();
        } catch (e) {
          console.log('Erro ao ler resposta');
        }
        
        return new Response(JSON.stringify({ 
          error: `Erro ao atualizar: ${updateResponse.status}`,
          details: errorDetails
        }), {
          status: updateResponse.status,
          headers
        });
      }

      console.log('✅ Proposta atualizada com sucesso');

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Proposta atualizada com sucesso',
        changes: requestBody
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
