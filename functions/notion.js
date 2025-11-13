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
      console.log('📝 Primeiro registro ID:', notionData.results?.[0]?.id || 'nenhum');
      
      // Log detalhado dos campos do primeiro registro
      const firstRecord = notionData.results?.[0];
      if (firstRecord?.properties) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 CAMPOS ENCONTRADOS NO NOTION (PRIMEIRO REGISTRO):');
        console.log('═══════════════════════════════════════════════════════════');
        const fieldNames = Object.keys(firstRecord.properties).sort();
        fieldNames.forEach(fieldName => {
          const prop = firstRecord.properties[fieldName];
          let value = '(vazio)';
          if (prop.type === 'number' && prop.number !== null) value = prop.number;
          if (prop.type === 'title' && prop.title?.length) value = prop.title[0].text.content;
          if (prop.type === 'rich_text' && prop.rich_text?.length) value = prop.rich_text[0].text.content;
          console.log(`  "${fieldName}": ${value}`);
        });
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
      }
      
      if (!notionData.results || notionData.results.length === 0) {
        console.log('⚠️ AVISO: Database retornou vazio!');
        return new Response(JSON.stringify({ 
          error: 'Database vazia',
          debug: {
            has_results: !!notionData.results,
            results_length: notionData.results?.length || 0,
            has_object: !!notionData.object
          }
        }), {
          status: 200,
          headers
        });
      }

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
      const emissoras = notionData.results.map((row, rowIndex) => {
        const properties = row.properties || {};
        
        // Log detalhado apenas do primeiro registro
        if (rowIndex === 0) {
          console.log('');
          console.log('═══════════════════════════════════════════════════════════');
          console.log('🔍 DEBUG: CAMPOS ENCONTRADOS vs PROCURADOS');
          console.log('═══════════════════════════════════════════════════════════');
          
          const fieldsToProcure = [
            'Spots 30"', 'Valor spot 30" (Tabela)', 'Valor spot 30"(Negociado)',
            'Spots 60"', 'Valor spot 60" (Tabela)', 'Valor spot 60"(Negociado)',
            'Blitz', 'Valor Blitz (Tabela)', 'Valor Blitz (Negociado)',
            'Spots 15"', 'Valor spot 15" (Tabela)', 'Valor spot 15"(Negociado)',
            'Spots 5"', 'Valor spot 5" (Tabela)', 'Valor spot 5"(Negociado)',
            'Test 60"', 'Valor Test 60" (Tabela)', 'Valor Test 60" (Negociado)',
            'Flash 30"', 'Valor Flash 30" (Tabela)', 'Valor Flash 30"(Negociado)',
            'Flash 60"', 'Valor Flash 60" (Tabela)', 'Valor Flash 60"(Negociado)',
            'Menshan 30"', 'Valor Mershan 30" (Tabela)', 'Valor Mershan 30" (Tabela)',
            'Menshan 60"', 'Valor Mershan 60" (Tabela)', 'Valor Mershan 60" (Tabela)'
          ];
          
          const actualFields = Object.keys(properties);
          console.log('CAMPOS QUE EXISTEM NO NOTION:');
          actualFields.sort().forEach(field => {
            console.log(`  ✅ "${field}"`);
          });
          
          console.log('');
          console.log('CAMPOS QUE ESTAMOS PROCURANDO:');
          fieldsToProcure.forEach(field => {
            const found = properties[field];
            const status = found ? '✅' : '❌';
            console.log(`  ${status} "${field}"`);
          });
          console.log('═══════════════════════════════════════════════════════════');
          console.log('');
        }
        
        return {
          id: row.id,
          emissora: extractValue(properties['Emissora'], ''),
          praca: extractValue(properties['Praça'], ''),
          dial: extractValue(properties['Dial'], ''),
          uf: extractValue(properties['UF'], ''),
          
          // Spots 30"
          spots30: extractValue(properties['Spots 30"'], 0),
          valorTabela30: extractValue(properties['Valor spot 30" (Tabela)'], 0),
          valorNegociado30: extractValue(properties['Valor spot 30"(Negociado)'], 0),
          
          // Spots 60"
          spots60: extractValue(properties['Spots 60"'], 0),
          valorTabela60: extractValue(properties['Valor spot 60" (Tabela)'], 0),
          valorNegociado60: extractValue(properties['Valor spot 60"(Negociado)'], 0),
          
          // Blitz
          spotsBlitz: extractValue(properties['Blitz'], 0),
          valorTabelaBlitz: extractValue(properties['Valor Blitz (Tabela)'], 0),
          valorNegociadoBlitz: extractValue(properties['Valor Blitz (Negociado)'], 0),
          
          // Spots 15"
          spots15: extractValue(properties['Spots 15"'], 0),
          valorTabela15: extractValue(properties['Valor spot 15" (Tabela)'], 0),
          valorNegociado15: extractValue(properties['Valor spot 15"(Negociado)'], 0),
          
          // Spots 5"
          spots5: extractValue(properties['Spots 5"'], 0),
          valorTabela5: extractValue(properties['Valor spot 5" (Tabela)'], 0),
          valorNegociado5: extractValue(properties['Valor spot 5"(Negociado)'], 0),
          
          // Test 60"
          spotsTest60: extractValue(properties['Test 60"'], 0),
          valorTabelaTest60: extractValue(properties['Valor Test 60" (Tabela)'], 0),
          valorNegociadoTest60: extractValue(properties['Valor Test 60" (Negociado)'], 0),
          
          // Flash 30"
          spotsFlash30: extractValue(properties['Flash 30"'], 0),
          valorTabelaFlash30: extractValue(properties['Valor Flash 30" (Tabela)'], 0),
          valorNegociadoFlash30: extractValue(properties['Valor Flash 30"(Negociado)'], 0),
          
          // Flash 60"
          spotsFlash60: extractValue(properties['Flash 60"'], 0),
          valorTabelaFlash60: extractValue(properties['Valor Flash 60" (Tabela)'], 0),
          valorNegociadoFlash60: extractValue(properties['Valor Flash 60"(Negociado)'], 0),
          
          // Menshan 30"
          spotsMensham30: extractValue(properties['Menshan 30"'], 0),
          valorTabelaMensham30: extractValue(properties['Valor Mershan 30" (Tabela)'], 0),
          valorNegociadoMensham30: extractValue(properties['Valor Mershan 30" (Tabela)'], 0),
          
          // Menshan 60"
          spotsMensham60: extractValue(properties['Menshan 60"'], 0),
          valorTabelaMensham60: extractValue(properties['Valor Mershan 60" (Tabela)'], 0),
          valorNegociadoMensham60: extractValue(properties['Valor Mershan 60" (Tabela)'], 0)
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
          'valorTabela30': 'Valor spot 30" (Tabela)',
          'valorNegociado30': 'Valor spot 30" (Negociado)',
          'spots60': 'Spots 60"',
          'valorTabela60': 'Valor spot 60" (Tabela)',
          'valorNegociado60': 'Valor spot 60" (Negociado)',
          'spotsBlitz': 'Blitz',
          'valorTabelaBlitz': 'Valor Blitz (Tabela)',
          'valorNegociadoBlitz': 'Valor Blitz (Negociado)',
          'spots15': 'Spots 15"',
          'valorTabela15': 'Valor spot 15" (Tabela)',
          'valorNegociado15': 'Valor spot 15" (Negociado)',
          'spots5': 'Spots 5"',
          'valorTabela5': 'Valor spot 5" (Tabela)',
          'valorNegociado5': 'Valor spot 5" (Negociado)',
          'spotsTest60': 'Test 60"',
          'valorTabelaTest60': 'Valor Test 60" (Tabela)',
          'valorNegociadoTest60': 'Valor Test 60" (Negociado)',
          'spotsFlash30': 'Flash 30"',
          'valorTabelaFlash30': 'Valor Flash 30" (Tabela)',
          'valorNegociadoFlash30': 'Valor Flash 30" (Negociado)',
          'spotsFlash60': 'Flash 60"',
          'valorTabelaFlash60': 'Valor Flash 60" (Tabela)',
          'valorNegociadoFlash60': 'Valor Flash 60" (Negociado)',
          'spotsMensham30': 'Mensham 30"',
          'valorTabelaMensham30': 'Valor Mensham 30" (Tabela)',
          'valorNegociadoMensham30': 'Valor Mensham 30" (Negociado)',
          'spotsMensham60': 'Mensham 60"',
          'valorTabelaMensham60': 'Valor Mensham 60" (Tabela)',
          'valorNegociadoMensham60': 'Valor Mensham 60" (Negociado)'
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
