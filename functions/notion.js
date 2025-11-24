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
    console.log('3. MÃ©todo:', request.method);
    console.log('4. URL:', request.url);
    console.log('========================');
    
    if (!notionToken) {
      return new Response(JSON.stringify({ 
        error: 'Token do Notion nÃ£o configurado',
        debug: {
          message: 'VariÃ¡vel NOTION_TOKEN nÃ£o encontrada',
          env_keys: Object.keys(env || {})
        }
      }), {
        status: 500,
        headers
      });
    }

    // MÃ‰TODO GET - BUSCAR DADOS DA TABELA DE EMISSORAS
    if (request.method === 'GET') {
      let id = url.searchParams.get('id');
      const debugMode = url.searchParams.get('debug') === 'true';
      
      console.log('âš ï¸ DEBUG GET REQUEST - TABELA DE EMISSORAS');
      console.log('URL completa:', request.url);
      console.log('Query params:', [...url.searchParams.entries()]);
      console.log('ID extraÃ­do:', id);
      console.log('Debug mode:', debugMode);
      
      if (!id || id.trim() === '') {
        return new Response(JSON.stringify({ 
          error: 'ID da tabela Ã© obrigatÃ³rio',
          debug: {
            receivedUrl: request.url,
            rawId: id
          }
        }), {
          status: 400,
          headers
        });
      }

      // Notion API espera ID sem hÃ­fens
      id = id.replace(/-/g, '');
      console.log('ðŸ” ID formatado para Notion:', id);
      console.log('ðŸ” Buscando tabela de emissoras:', id);

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

      console.log('ðŸ“¡ Resposta Notion - Status:', response.status);
      console.log('ðŸ“¡ Resposta Notion - OK:', response.ok);

      if (!response.ok) {
        let errorDetails = response.statusText;
        let errorBody = {};
        
        try {
          errorBody = await response.json();
          console.log('ðŸ“¡ Erro Notion JSON:', errorBody);
          errorDetails = JSON.stringify(errorBody, null, 2);
        } catch (e) {
          try {
            errorDetails = await response.text();
            console.log('ðŸ“¡ Erro Notion texto:', errorDetails);
          } catch (e2) {
            console.log('NÃ£o foi possÃ­vel ler corpo do erro');
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
      console.log('âœ… Tabela recebida com sucesso!');
      console.log('ðŸ“ Total de registros:', notionData.results?.length || 0);
      console.log('ðŸ“ Primeiro registro ID:', notionData.results?.[0]?.id || 'nenhum');
      
      // Log detalhado dos campos do primeiro registro
      const firstRecord = notionData.results?.[0];
      let allFields = [];
      
      if (firstRecord?.properties) {
        console.log('');
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        console.log('ðŸ” TODOS OS CAMPOS ENCONTRADOS NO NOTION (PRIMEIRO REGISTRO):');
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        const fieldNames = Object.keys(firstRecord.properties).sort();
        allFields = fieldNames.map(fieldName => ({
          name: fieldName,
          type: firstRecord.properties[fieldName].type
        }));
        
        fieldNames.forEach(fieldName => {
          const prop = firstRecord.properties[fieldName];
          console.log(`  "${fieldName}" (tipo: ${prop.type})`);
        });
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        console.log('');
        
        // Se for debug mode, retorna apenas a lista de campos
        if (debugMode) {
          return new Response(JSON.stringify({
            debug: true,
            fields: allFields,
            total: allFields.length,
            firstRecordId: firstRecord.id
          }, null, 2), {
            status: 200,
            headers
          });
        }
        
        // Log especÃ­fico para campos que contÃªm "impacto"
        console.log('ðŸ” PROCURANDO CAMPOS COM "IMPACTO":');
        const impactFields = fieldNames.filter(f => f.toLowerCase().includes('impacto'));
        if (impactFields.length > 0) {
          impactFields.forEach(field => {
            const prop = firstRecord.properties[field];
            console.log(`  âœ… ENCONTRADO: "${field}" (tipo: ${prop.type})`);
            console.log(`     ConteÃºdo bruto:`, JSON.stringify(prop));
          });
        } else {
          console.log('  âŒ NENHUM CAMPO COM "IMPACTO" ENCONTRADO');
          console.log('  ðŸ’¡ DICA: Os campos encontrados sÃ£o:');
          fieldNames.forEach(fieldName => {
            console.log(`     - "${fieldName}"`);
          });
        }
        console.log('');
        
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        console.log('ðŸ” VALORES DOS CAMPOS (PRIMEIRO REGISTRO):');
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        fieldNames.forEach(fieldName => {
          const prop = firstRecord.properties[fieldName];
          let value = '(vazio)';
          if (prop.type === 'number' && prop.number !== null) value = prop.number;
          if (prop.type === 'title' && prop.title?.length) value = prop.title[0].text.content;
          if (prop.type === 'rich_text' && prop.rich_text?.length) value = prop.rich_text[0].text.content;
          console.log(`  "${fieldName}": ${value}`);
        });
        console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        console.log('');
      }
      
      if (!notionData.results || notionData.results.length === 0) {
        console.log('âš ï¸ AVISO: Database retornou vazio!');
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

      // FunÃ§Ã£o melhorada para extrair valores com fallbacks e logging
      const extractValue = (properties, defaultValue = 0, propName = '', ...possibleKeys) => {
        // Tenta cada chave possÃ­vel em sequÃªncia
        for (const key of possibleKeys) {
          const prop = properties[key];
          if (prop) {
            if (propName === 'impactos') {
              console.log(`\nðŸŽ¯ EXTRAÃ‡ÃƒO DE IMPACTOS:`);
              console.log(`  Campo encontrado como: "${key}"`);
              console.log(`  Tipo: ${prop.type}`);
              console.log(`  ConteÃºdo bruto:`, JSON.stringify(prop));
            }
            
            console.log(`âœ… Campo "${propName}" encontrado como: "${key}"`);
            
            switch (prop.type) {
              case 'number':
                const numValue = prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
                if (propName === 'impactos') console.log(`  âœ… Valor extraÃ­do (number): ${numValue}`);
                console.log(`   Valor: ${numValue}`);
                return numValue;
              case 'title':
                const titleValue = prop.title?.[0]?.text?.content || defaultValue;
                console.log(`   Valor: ${titleValue}`);
                return titleValue;
              case 'rich_text':
                const textValue = prop.rich_text?.[0]?.text?.content || defaultValue;
                console.log(`   Valor: ${textValue}`);
                return textValue;
              case 'date':
                return prop.date?.start || defaultValue;
              case 'select':
                return prop.select?.name || defaultValue;
              case 'multi_select':
                return prop.multi_select?.map(item => item.name).join(',') || defaultValue;
              default:
                console.log(`âš ï¸ Tipo desconhecido: ${prop.type}`);
                return defaultValue;
            }
          }
        }
        
        // FALLBACK: Tenta busca parcial (case-insensitive)
        for (const key of Object.keys(properties)) {
          const searchTerm = possibleKeys[0];
          if (searchTerm && key.toLowerCase().includes(searchTerm.toLowerCase())) {
            const prop = properties[key];
            console.log(`âš¡ FALLBACK (busca parcial): Campo "${propName}" encontrado como: "${key}"`);
            
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
          }
        }
        
        // Se nenhuma chave foi encontrada
        if (propName === 'impactos') {
          console.log(`\nâŒ ERRO: Campo "impactos" NÃƒO encontrado!`);
          console.log(`  Chaves procuradas:`, possibleKeys);
          console.log(`  Valor padrÃ£o retornado: ${defaultValue}`);
        }
        console.log(`âŒ Campo "${propName}" NÃƒO encontrado. Chaves procuradas:`, possibleKeys);
        return defaultValue;
      };

      // Mapear registros da tabela
      const emissoras = notionData.results.map((row, rowIndex) => {
        const properties = row.properties || {};
        
        // Log detalhado apenas do primeiro registro
        if (rowIndex === 0) {
          console.log('');
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
          console.log('ðŸ” TODOS OS CAMPOS DISPONÃVEIS NO NOTION:');
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
          
          const allFields = Object.keys(properties).sort();
          allFields.forEach(field => {
            console.log(`  âœ… "${field}"`);
          });
          
          console.log('');
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
          console.log('ðŸ” DEBUG: CAMPOS ENCONTRADOS vs PROCURADOS');
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
          
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
            'Menshan 60"', 'Valor Mershan 60" (Tabela)', 'Valor Mershan 60" (Tabela)',
            'Impactos', 'impactos', 'Quantidade de Impactos', 'IMPACTOS', 'Impacto', 'impacto', 'IMPACTO'
          ];
          
          const actualFields = Object.keys(properties);
          console.log('CAMPOS QUE EXISTEM NO NOTION:');
          actualFields.sort().forEach(field => {
            console.log(`  âœ… "${field}"`);
          });
          
          console.log('');
          console.log('CAMPOS QUE ESTAMOS PROCURANDO:');
          fieldsToProcure.forEach(field => {
            const found = properties[field];
            const status = found ? 'âœ…' : 'âŒ';
            console.log(`  ${status} "${field}"`);
          });
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
          console.log('');
        }
        
        return {
          id: row.id,
          proposta: extractValue(properties, '', 'Proposta', 'Proposta', 'Nome Proposta', 'Nome da Proposta'),
          empresa: extractValue(properties, '', 'Empresa', 'Empresa', 'Cliente', 'Nome Empresa'),
          emissora: extractValue(properties, '', 'Emissora', 'Emissora'),
          praca: extractValue(properties, '', 'PraÃ§a', 'PraÃ§a', 'Praca'),
          dial: extractValue(properties, '', 'Dial', 'Dial'),
          linkLogo: extractValue(properties, '', 'linkLogo', 'linkLogo', 'Link Logo', 'Link da Logo', 'Logo URL', 'URL Logo'),
          uf: extractValue(properties, '', 'UF', 'UF'),
          impactos: (() => {
            // FunÃ§Ã£o especial para extrair impactos que aceita QUALQUER tipo de dados
            const possibleKeys = ['Impactos', 'impactos', 'Quantidade de Impactos', 'IMPACTOS', 'Impacto', 'impacto', 'IMPACTO', 'Qtd Impactos', 'Quantidade Impactos', 'Total Impactos'];
            
            for (const key of possibleKeys) {
              const prop = properties[key];
              if (prop) {
                console.log(`ðŸŽ¯ EXTRAÃ‡ÃƒO DE IMPACTOS - Campo encontrado: "${key}" (tipo: ${prop.type})`);
                
                // Tenta extrair de qualquer tipo de campo
                if (prop.type === 'number' && prop.number !== null && prop.number !== undefined) {
                  console.log(`   âœ… Valor (number): ${prop.number}`);
                  return prop.number;
                } else if (prop.type === 'title' && prop.title?.length) {
                  const val = prop.title[0].text.content;
                  console.log(`   âœ… Valor (title): ${val}`);
                  return val;
                } else if (prop.type === 'rich_text' && prop.rich_text?.length) {
                  const val = prop.rich_text[0].text.content;
                  console.log(`   âœ… Valor (rich_text): ${val}`);
                  return val;
                } else if (prop.type === 'formula' && prop.formula?.number !== null) {
                  console.log(`   âœ… Valor (formula number): ${prop.formula.number}`);
                  return prop.formula.number;
                } else if (prop.type === 'formula' && prop.formula?.string) {
                  console.log(`   âœ… Valor (formula string): ${prop.formula.string}`);
                  return prop.formula.string;
                } else if (prop.type === 'checkbox') {
                  console.log(`   âœ… Valor (checkbox): ${prop.checkbox}`);
                  return prop.checkbox;
                } else if (prop.type === 'date' && prop.date?.start) {
                  console.log(`   âœ… Valor (date): ${prop.date.start}`);
                  return prop.date.start;
                } else if (prop.type === 'select' && prop.select?.name) {
                  console.log(`   âœ… Valor (select): ${prop.select.name}`);
                  return prop.select.name;
                } else if (prop.type === 'multi_select' && prop.multi_select?.length) {
                  const val = prop.multi_select.map(item => item.name).join(',');
                  console.log(`   âœ… Valor (multi_select): ${val}`);
                  return val;
                } else {
                  console.log(`   âš ï¸ Campo encontrado mas vazio ou tipo nÃ£o suportado. ConteÃºdo:`, prop);
                  return 0;
                }
              }
            }
            
            console.log(`âŒ Nenhum campo de impactos encontrado. Procurados:`, possibleKeys);
            return 0;
          })(),
          
          // Spots 30
          // Spots 30" - Tentar vários formatos possíveis
          spots30: extractValue(properties, 0, 'Spots 30ʺ', 'Spots 30"', 'Spots 30´', 'Spots 30', 'spots30'),
          valorTabela30: extractValue(properties, 0, 'Valor spot 30ʺ (Tabela)', 'Valor spot 30" (Tabela)', 'Valor spot 30 (Tabela)', 'valorTabela30'),
          valorNegociado30: extractValue(properties, 0, 'Valor spot 30ʺ (Negociado)', 'Valor spot 30" (Negociado)', 'Valor spot 30 (Negociado)', 'valorNegociado30'),
          
          // Spots 60" - Tentar vários formatos possíveis
          spots60: extractValue(properties, 0, 'Spots 60ʺ', 'Spots 60"', 'Spots 60´', 'Spots 60', 'spots60'),
          valorTabela60: extractValue(properties, 0, 'Valor spot 60ʺ (Tabela)', 'Valor spot 60" (Tabela)', 'Valor spot 60 (Tabela)', 'valorTabela60'),
          valorNegociado60: extractValue(properties, 0, 'Valor spot 60ʺ (Negociado)', 'Valor spot 60" (Negociado)', 'Valor spot 60 (Negociado)', 'valorNegociado60'),
          
          // Blitz
          spotsBlitz: extractValue(properties, 0, 'Blitz', 'Blitz', 'blitz'),
          valorTabelaBlitz: extractValue(properties, 0, 'Valor Blitz (Tabela)', 'Valor Blitz (Tabela)', 'valorTabelaBlitz'),
          valorNegociadoBlitz: extractValue(properties, 0, 'Valor Blitz (Negociado)', 'Valor Blitz (Negociado)', 'valorNegociadoBlitz'),
          
          // Spots 15"
          spots15: extractValue(properties, 0, 'Spots 15', 'Spots 15"', 'Spots 15', 'Spots 15', 'spots15'),
          valorTabela15: extractValue(properties, 0, 'Valor spot 15 (Tabela)', 'Valor spot 15" (Tabela)', 'Valor spot 15 (Tabela)', 'Valor spot 15 (Tabela)', 'valorTabela15'),
          valorNegociado15: extractValue(properties, 0, 'Valor spot 15 (Negociado)', 'Valor spot 15"(Negociado)', 'Valor spot 15(Negociado)', 'Valor spot 15 (Negociado)', 'valorNegociado15'),
          
          // Spots 5
          spots5: extractValue(properties, 0, 'Spots 5', 'Spots 5'),
          valorTabela5: extractValue(properties, 0, 'Valor spot 5 (Tabela)', 'Valor spot 5 (Tabela)'),
          valorNegociado5: extractValue(properties, 0, 'Valor spot 5 (Negociado)', 'Valor spot 5 (Negociado)'),
          
          // Test. 30
          spotsTest30: extractValue(properties, 0, 'Test. 30', 'Test. 30'),
          valorTabelaTest30: extractValue(properties, 0, 'Valor test. 30 (Tabela)', 'Valor test. 30 (Tabela)'),
          valorNegociadoTest30: extractValue(properties, 0, 'Valor test. 30 (Negociado)', 'Valor test. 30 (Negociado)'),
          
          // Test. 60
          spotsTest60: extractValue(properties, 0, 'Test. 60', 'Test. 60'),
          valorTabelaTest60: extractValue(properties, 0, 'Valor test. 60 (Tabela)', 'Valor test. 60 (Tabela)'),
          valorNegociadoTest60: extractValue(properties, 0, 'Valor test. 60 (Negociado)', 'Valor test. 60 (Negociado)'),
          
          // Flash 30"
          spotsFlash30: extractValue(properties, 0, 'Flash 30', 'Flash 30"', 'Flash 30', 'Flash 30', 'spotsFlash30'),
          valorTabelaFlash30: extractValue(properties, 0, 'Valor Flash 30 (Tabela)', 'Valor Flash 30" (Tabela)', 'Valor Flash 30 (Tabela)', 'Valor Flash 30 (Tabela)', 'valorTabelaFlash30'),
          valorNegociadoFlash30: extractValue(properties, 0, 'Valor Flash 30 (Negociado)', 'Valor Flash 30"(Negociado)', 'Valor Flash 30(Negociado)', 'Valor Flash 30 (Negociado)', 'valorNegociadoFlash30'),
          
          // Flash 60"
          spotsFlash60: extractValue(properties, 0, 'Flash 60', 'Flash 60"', 'Flash 60', 'Flash 60', 'spotsFlash60'),
          valorTabelaFlash60: extractValue(properties, 0, 'Valor Flash 60 (Tabela)', 'Valor Flash 60" (Tabela)', 'Valor Flash 60 (Tabela)', 'Valor Flash 60 (Tabela)', 'valorTabelaFlash60'),
          valorNegociadoFlash60: extractValue(properties, 0, 'Valor Flash 60 (Negociado)', 'Valor Flash 60"(Negociado)', 'Valor Flash 60(Negociado)', 'Valor Flash 60 (Negociado)', 'valorNegociadoFlash60'),
          
          // Menshan 30"
          spotsMensham30: extractValue(properties, 0, 'Menshan 30', 'Menshan 30"', 'Menshan 30', 'Menshan 30', 'spotsMensham30'),
          valorTabelaMensham30: extractValue(properties, 0, 'Valor Mershan 30 (Tabela)', 'Valor Mershan 30" (Tabela)', 'Valor Mershan 30 (Tabela)', 'Valor Mershan 30 (Tabela)', 'valorTabelaMensham30'),
          valorNegociadoMensham30: extractValue(properties, 0, 'Valor Mershan 30 (Tabela)', 'Valor Mershan 30" (Tabela)', 'Valor Mershan 30 (Tabela)', 'Valor Mershan 30 (Tabela)', 'valorNegociadoMensham30'),
          
          // Menshan 60"
          spotsMensham60: extractValue(properties, 0, 'Menshan 60', 'Menshan 60"', 'Menshan 60', 'Menshan 60', 'spotsMensham60'),
          valorTabelaMensham60: extractValue(properties, 0, 'Valor Mershan 60 (Tabela)', 'Valor Mershan 60" (Tabela)', 'Valor Mershan 60 (Tabela)', 'Valor Mershan 60 (Tabela)', 'valorTabelaMensham60'),
          valorNegociadoMensham60: extractValue(properties, 0, 'Valor Mershan 60 (Tabela)', 'Valor Mershan 60" (Tabela)', 'Valor Mershan 60 (Tabela)', 'Valor Mershan 60 (Tabela)', 'valorNegociadoMensham60'),
          
          // Coluna "Excluir" para filtro no site
          excluir: (() => {
            const excludeField = properties['Excluir'];
            if (excludeField && excludeField.checkbox !== null && excludeField.checkbox !== undefined) {
              return excludeField.checkbox === true;
            }
            return false;
          })()
        };
      });

      console.log('âœ… Emissoras mapeadas:', emissoras);
      
      // Carregar estado de exclusÃ£o do Notion
      const ocultasEmissoras = emissoras
        .filter(e => e.excluir === true)
        .map(e => e.id);
      console.log('');
      console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
      console.log('âœ… EMISSORAS MAPEADAS - PRIMEIRA EMISSORA:');
      console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
      if (emissoras.length > 0) {
        console.log(JSON.stringify(emissoras[0], null, 2));
      }
      console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
      console.log('');

      return new Response(JSON.stringify({
        emissoras: emissoras,
        ocultasEmissoras: ocultasEmissoras
      }), {
        status: 200,
        headers
      });
    }

    // MÃ‰TODO PATCH - ATUALIZAR MÃšLTIPLAS EMISSORAS
    if (request.method === 'PATCH') {
      const tableId = url.searchParams.get('id');
      
      // Array para guardar logs
      const debugLogs = [];
      const log = (msg) => {
        console.log(msg);
        debugLogs.push(msg);
      };
      
      if (!tableId) {
        return new Response(JSON.stringify({ 
          error: 'ID da tabela obrigatÃ³rio' 
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
          error: 'Body invÃ¡lido' 
        }), {
          status: 400,
          headers
        });
      }

      log('ðŸ”„ Atualizando mÃºltiplas emissoras');
      log('ðŸ“ Dados recebidos: ' + JSON.stringify(requestBody));

      const { emissoras, changes, ocultasEmissoras } = requestBody;
      log('ðŸ“ ocultasEmissoras recebido: ' + JSON.stringify(ocultasEmissoras));
      
      if (!emissoras || !Array.isArray(emissoras)) {
        return new Response(JSON.stringify({ 
          error: 'Emissoras deve ser um array' 
        }), {
          status: 400,
          headers
        });
      }

      // Sincronizar o status "Excluir" com Notion
      if (ocultasEmissoras && Array.isArray(ocultasEmissoras)) {
        log(`ðŸ”„ Sincronizando status "Excluir" para ${ocultasEmissoras.length} emissoras`);
        
        for (const emissora of emissoras) {
          const isExcluida = ocultasEmissoras.includes(emissora.id);
          const wasPreviouslyExcluida = emissora.excluir || false;
          
          // SEMPRE atualizar - Notion é a fonte da verdade
if (true) {
            log(`  ðŸ”„ Atualizando ${emissora.emissora}: Excluir = ${isExcluida}`);
            
            const excludeResponse = await fetch(`https://api.notion.com/v1/pages/${emissora.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${notionToken.trim()}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                properties: {
                  'Excluir': {
                    checkbox: isExcluida
                  }
                }
              })
            });
            
            if (excludeResponse.ok) {
              log(`    âœ… Excluir atualizado para ${isExcluida}`);
            } else {
              const error = await excludeResponse.json();
              log(`    âŒ Erro ao atualizar Excluir: ${JSON.stringify(error)}`);
              console.error(`    âŒ Erro completo:`, error);
              
              // âš ï¸ IMPORTANTE: Rastrear falha de atualizaÃ§Ã£o de exclusÃ£o
              updatePromises.push({
                field: 'Excluir',
                notionField: 'Excluir',
                emissoraId: emissora.id,
                emissoraName: emissora.emissora,
                success: false,
                status: excludeResponse.status,
                error: error.message || JSON.stringify(error),
                notionResponse: error
              });
            }
          }
        }
      }

      // Processar cada alteraÃ§Ã£o
      const updatePromises = [];
      
      for (const changeKey in changes) {
        const change = changes[changeKey];
        const emissora = emissoras[change.emissoraIndex];
        
        if (!emissora || !emissora.id) continue;

        // Mapear campo para nome do Notion
        const fieldMap = {
          'spots30': 'Spots 30',
          'valorTabela30': 'Valor spot 30 (Tabela)',
          'valorNegociado30': 'Valor spot 30 (Negociado)',
          'spots60': 'Spots 60',
          'valorTabela60': 'Valor spot 60 (Tabela)',
          'valorNegociado60': 'Valor spot 60 (Negociado)',
          'spotsBlitz': 'Blitz',
          'valorTabelaBlitz': 'Valor Blitz (Tabela)',
          'valorNegociadoBlitz': 'Valor Blitz (Negociado)',
          'spots15': 'Spots 15',
          'valorTabela15': 'Valor spot 15 (Tabela)',
          'valorNegociado15': 'Valor spot 15 (Negociado)',
          'spots5': 'Spots 5',
          'valorTabela5': 'Valor spot 5 (Tabela)',
          'valorNegociado5': 'Valor spot 5 (Negociado)',
          'spotsTest60': 'Test. 60',
          'valorTabelaTest60': 'Valor test. 60 (Tabela)',
          'valorNegociadoTest60': 'Valor test. 60 (Negociado)'
        };

        const notionField = fieldMap[change.field];
        if (!notionField) {
          console.error(`âŒ Campo nÃ£o mapeado: ${change.field}`);
          continue;
        }

        console.log(`ðŸ“¤ Atualizando ${emissora.emissora} - Campo: "${notionField}" = ${change.new}`);

        const updateProperties = {};
        updateProperties[notionField] = { number: parseFloat(change.new) || 0 };

        const bodyToSend = JSON.stringify({ properties: updateProperties });
        console.log(`ðŸ” FIELD NAME (chave):`, notionField);
        console.log(`ðŸ” FIELD NAME (type):`, typeof notionField);
        console.log(`ðŸ” BODY sendo enviado para Notion:`, bodyToSend);
        console.log(`ðŸ” updateProperties objeto:`, updateProperties);

        const updateResponse = await fetch(`https://api.notion.com/v1/pages/${emissora.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${notionToken.trim()}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: bodyToSend
        });

        const updateData = await updateResponse.json();

        if (!updateResponse.ok) {
          console.error(`âŒ Erro ao atualizar ${emissora.emissora} (${notionField}):`, updateResponse.status, updateData);
          updatePromises.push({
            field: change.field,
            notionField: notionField,
            emissoraId: emissora.id,
            emissoraName: emissora.emissora,
            success: false,
            status: updateResponse.status,
            error: updateData.message || JSON.stringify(updateData),
            bodySent: bodyToSend,
            notionResponse: updateData
          });
        } else {
          console.log(`âœ… ${emissora.emissora} - ${notionField} atualizado com sucesso`);
          updatePromises.push({
            field: change.field,
            notionField: notionField,
            emissoraId: emissora.id,
            emissoraName: emissora.emissora,
            success: true
          });
        }
      }

      // Enviar email com as alteraÃ§Ãµes
      try {
        await sendNotificationEmail(env, {
          tableId: id,
          changes: updatePromises,
          emissoras: emissoras,
          requestIP: request.headers.get('cf-connecting-ip') || 'desconhecido'
        });
      } catch (emailError) {
        console.error('âš ï¸ Erro ao enviar email:', emailError.message);
        log('âš ï¸ Erro ao enviar email: ' + emailError.message);
        // NÃ£o interrompe o fluxo se falhar o email
      }

      console.log('ðŸ“¤ Retornando resposta com debugLogs:', debugLogs.length, 'mensagens');
      
      const failedUpdates = updatePromises.filter(p => !p.success).length;
      const hasFailed = failedUpdates > 0;
      
      // âš ï¸ IMPORTANTE: Se houver qualquer falha, retornar sucesso falso
      // Isso garante que o frontend saiba que algo nÃ£o funcionou
      const responseData = { 
        success: !hasFailed,  // âœ… Retorna false se houver falhas
        message: hasFailed ? 'Algumas alteraÃ§Ãµes falharam' : 'AlteraÃ§Ãµes processadas com sucesso',
        totalChanges: Object.keys(changes).length,
        successfulUpdates: updatePromises.filter(p => p.success).length,
        failedUpdates: failedUpdates,
        details: updatePromises,
        debugLogs: debugLogs
      };
      
      console.log('ðŸ“¤ Response data:', responseData);
      
      return new Response(JSON.stringify(responseData), {
        status: hasFailed ? 400 : 200,  // âœ… Retorna 400 se houver falhas
        headers
      });
    }

    // MÃ©todo nÃ£o suportado
    return new Response(JSON.stringify({  
      error: 'MÃ©todo nÃ£o permitido' 
    }), {
      status: 405,
      headers
    });

  } catch (error) {
    console.error('ðŸ’¥ Erro:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Erro interno',
      details: error.message
    }), {
      status: 500,
      headers
    });
  }
}

// =====================================================
// FUNÃ‡ÃƒO DE ENVIO DE EMAIL
// =====================================================

async function sendNotificationEmail(env, data) {
  const { tableId, changes, emissoras, requestIP } = data;
  const resendApiKey = env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.warn('âš ï¸ RESEND_API_KEY nÃ£o configurada. Email nÃ£o serÃ¡ enviado.');
    return;
  }

  // Agrupar alteraÃ§Ãµes por emissora
  const changesByEmissora = {};
  changes.forEach(change => {
    if (change.success) {
      const emissoraIndex = findEmissoraIndexById(change.emissoraId, emissoras);
      if (emissoraIndex !== -1) {
        if (!changesByEmissora[emissoraIndex]) {
          changesByEmissora[emissoraIndex] = [];
        }
        changesByEmissora[emissoraIndex].push(change);
      }
    }
  });

  // Gerar HTML do email
  let emailHTML = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AlteraÃ§Ã£o de Proposta</title>
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #06055b 0%, #1a0f4f 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; }
        .change-group { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6366f1; border-radius: 4px; }
        .change-group h3 { margin-top: 0; color: #06055b; }
        .change-item { padding: 8px 0; font-size: 14px; }
        .old-value { color: #ef4444; font-weight: bold; }
        .new-value { color: #10b981; font-weight: bold; }
        .info-box { background: #ede9fe; padding: 12px; border-radius: 4px; font-size: 12px; color: #666; margin: 15px 0; }
        .footer { background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #999; border-radius: 0 0 8px 8px; }
        .link { color: #6366f1; text-decoration: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ðŸ“‹ AlteraÃ§Ã£o de Proposta RadiofÃ´nica</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">E-MÃDIAS | Sistema de GestÃ£o de Propostas</p>
        </div>
        
        <div class="content">
          <p>OlÃ¡,</p>
          <p>Uma proposta foi alterada no sistema E-MÃDIAS. Confira os detalhes abaixo:</p>
          
          <div class="info-box">
            <strong>ðŸ“… Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}<br>
            <strong>ðŸŒ IP do ResponsÃ¡vel:</strong> ${requestIP}
          </div>
  `;

  // Adicionar alteraÃ§Ãµes por emissora
  for (const emissoraIndex in changesByEmissora) {
    const emissora = emissoras[emissoraIndex];
    const emissoras_changes = changesByEmissora[emissoraIndex];
    
    emailHTML += `
      <div class="change-group">
        <h3>ðŸ“» ${emissora.emissora}</h3>
    `;
    
    emissoras_changes.forEach(change => {
      emailHTML += `
        <div class="change-item">
          <strong>${change.notionField}:</strong> 
          <span class="old-value">${change.oldValue || change.old}</span> 
          â†’ 
          <span class="new-value">${change.newValue || change.new}</span>
        </div>
      `;
    });
    
    emailHTML += '</div>';
  }

  // Link da proposta
  emailHTML += `
          <div class="info-box">
            <strong>ðŸ”— Link da Proposta:</strong><br>
            <a href="https://seu-dominio.pages.dev/?id=${tableId}" class="link">Abrir Proposta no E-MÃDIAS</a>
          </div>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            Este Ã© um email automÃ¡tico. NÃ£o responda este message.
          </p>
        </div>
        
        <div class="footer">
          <p>Â© 2025 HUB RÃDIOS - E-MÃDIAS. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Enviar via Resend
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'noreply@hubradios.com',
        to: 'tatico5@hubradios.com',
        subject: `[E-MÃDIAS] AlteraÃ§Ã£o de Proposta - ${new Date().toLocaleDateString('pt-BR')}`,
        html: emailHTML
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('âœ… Email enviado com sucesso:', result.id);
    } else {
      const error = await response.json();
      console.error('âŒ Erro ao enviar email via Resend:', error);
    }
  } catch (error) {
    console.error('âŒ Erro na requisiÃ§Ã£o Resend:', error);
  }
}

function findEmissoraIndexById(id, emissoras) {
  return emissoras.findIndex(e => e.id === id);
}

// =====================================================
// NOTA: Todas as funÃ§Ãµes de "Lista de alternantes" 
// foram removidas em favor de um filtro cliente simples
// (getAlternantesEmissoraIds, getOrCreateAlternantesDatabase,
//  createAlternantesDatabase, moveToAlternantes, removeFromAlternantes)
// =====================================================





