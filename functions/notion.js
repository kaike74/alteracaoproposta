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
      const debugMode = url.searchParams.get('debug') === 'true';
      
      console.log('⚠️ DEBUG GET REQUEST - TABELA DE EMISSORAS');
      console.log('URL completa:', request.url);
      console.log('Query params:', [...url.searchParams.entries()]);
      console.log('ID extraído:', id);
      console.log('Debug mode:', debugMode);
      
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
      let allFields = [];
      
      if (firstRecord?.properties) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 TODOS OS CAMPOS ENCONTRADOS NO NOTION (PRIMEIRO REGISTRO):');
        console.log('═══════════════════════════════════════════════════════════');
        const fieldNames = Object.keys(firstRecord.properties).sort();
        allFields = fieldNames.map(fieldName => ({
          name: fieldName,
          type: firstRecord.properties[fieldName].type
        }));
        
        fieldNames.forEach(fieldName => {
          const prop = firstRecord.properties[fieldName];
          console.log(`  "${fieldName}" (tipo: ${prop.type})`);
        });
        console.log('═══════════════════════════════════════════════════════════');
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
        
        // Log específico para campos que contêm "impacto"
        console.log('🔍 PROCURANDO CAMPOS COM "IMPACTO":');
        const impactFields = fieldNames.filter(f => f.toLowerCase().includes('impacto'));
        if (impactFields.length > 0) {
          impactFields.forEach(field => {
            const prop = firstRecord.properties[field];
            console.log(`  ✅ ENCONTRADO: "${field}" (tipo: ${prop.type})`);
            console.log(`     Conteúdo bruto:`, JSON.stringify(prop));
          });
        } else {
          console.log('  ❌ NENHUM CAMPO COM "IMPACTO" ENCONTRADO');
          console.log('  💡 DICA: Os campos encontrados são:');
          fieldNames.forEach(fieldName => {
            console.log(`     - "${fieldName}"`);
          });
        }
        console.log('');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 VALORES DOS CAMPOS (PRIMEIRO REGISTRO):');
        console.log('═══════════════════════════════════════════════════════════');
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

      // Função melhorada para extrair valores com fallbacks e logging
      const extractValue = (properties, defaultValue = 0, propName = '', ...possibleKeys) => {
        // Tenta cada chave possível em sequência
        for (const key of possibleKeys) {
          const prop = properties[key];
          if (prop) {
            if (propName === 'impactos') {
              console.log(`\n🎯 EXTRAÇÃO DE IMPACTOS:`);
              console.log(`  Campo encontrado como: "${key}"`);
              console.log(`  Tipo: ${prop.type}`);
              console.log(`  Conteúdo bruto:`, JSON.stringify(prop));
            }
            
            console.log(`✅ Campo "${propName}" encontrado como: "${key}"`);
            
            switch (prop.type) {
              case 'number':
                const numValue = prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
                if (propName === 'impactos') console.log(`  ✅ Valor extraído (number): ${numValue}`);
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
                console.log(`⚠️ Tipo desconhecido: ${prop.type}`);
                return defaultValue;
            }
          }
        }
        
        // Se nenhuma chave foi encontrada
        if (propName === 'impactos') {
          console.log(`\n❌ ERRO: Campo "impactos" NÃO encontrado!`);
          console.log(`  Chaves procuradas:`, possibleKeys);
          console.log(`  Valor padrão retornado: ${defaultValue}`);
        }
        console.log(`❌ Campo "${propName}" NÃO encontrado. Chaves procuradas:`, possibleKeys);
        return defaultValue;
      };

      // Mapear registros da tabela
      const emissoras = notionData.results.map((row, rowIndex) => {
        const properties = row.properties || {};
        
        // Log detalhado apenas do primeiro registro
        if (rowIndex === 0) {
          console.log('');
          console.log('═══════════════════════════════════════════════════════════');
          console.log('🔍 TODOS OS CAMPOS DISPONÍVEIS NO NOTION:');
          console.log('═══════════════════════════════════════════════════════════');
          
          const allFields = Object.keys(properties).sort();
          allFields.forEach(field => {
            console.log(`  ✅ "${field}"`);
          });
          
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
            'Menshan 60"', 'Valor Mershan 60" (Tabela)', 'Valor Mershan 60" (Tabela)',
            'Impactos', 'impactos', 'Quantidade de Impactos', 'IMPACTOS', 'Impacto', 'impacto', 'IMPACTO'
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
          proposta: extractValue(properties, '', 'Proposta', 'Proposta', 'Nome Proposta', 'Nome da Proposta'),
          empresa: extractValue(properties, '', 'Empresa', 'Empresa', 'Cliente', 'Nome Empresa'),
          emissora: extractValue(properties, '', 'Emissora', 'Emissora'),
          praca: extractValue(properties, '', 'Praça', 'Praça', 'Praca'),
          dial: extractValue(properties, '', 'Dial', 'Dial'),
          uf: extractValue(properties, '', 'UF', 'UF'),
          impactos: (() => {
            // Função especial para extrair impactos que aceita QUALQUER tipo de dados
            const possibleKeys = ['Impactos', 'impactos', 'Quantidade de Impactos', 'IMPACTOS', 'Impacto', 'impacto', 'IMPACTO', 'Qtd Impactos', 'Quantidade Impactos', 'Total Impactos'];
            
            for (const key of possibleKeys) {
              const prop = properties[key];
              if (prop) {
                console.log(`🎯 EXTRAÇÃO DE IMPACTOS - Campo encontrado: "${key}" (tipo: ${prop.type})`);
                
                // Tenta extrair de qualquer tipo de campo
                if (prop.type === 'number' && prop.number !== null && prop.number !== undefined) {
                  console.log(`   ✅ Valor (number): ${prop.number}`);
                  return prop.number;
                } else if (prop.type === 'title' && prop.title?.length) {
                  const val = prop.title[0].text.content;
                  console.log(`   ✅ Valor (title): ${val}`);
                  return val;
                } else if (prop.type === 'rich_text' && prop.rich_text?.length) {
                  const val = prop.rich_text[0].text.content;
                  console.log(`   ✅ Valor (rich_text): ${val}`);
                  return val;
                } else if (prop.type === 'formula' && prop.formula?.number !== null) {
                  console.log(`   ✅ Valor (formula number): ${prop.formula.number}`);
                  return prop.formula.number;
                } else if (prop.type === 'formula' && prop.formula?.string) {
                  console.log(`   ✅ Valor (formula string): ${prop.formula.string}`);
                  return prop.formula.string;
                } else if (prop.type === 'checkbox') {
                  console.log(`   ✅ Valor (checkbox): ${prop.checkbox}`);
                  return prop.checkbox;
                } else if (prop.type === 'date' && prop.date?.start) {
                  console.log(`   ✅ Valor (date): ${prop.date.start}`);
                  return prop.date.start;
                } else if (prop.type === 'select' && prop.select?.name) {
                  console.log(`   ✅ Valor (select): ${prop.select.name}`);
                  return prop.select.name;
                } else if (prop.type === 'multi_select' && prop.multi_select?.length) {
                  const val = prop.multi_select.map(item => item.name).join(',');
                  console.log(`   ✅ Valor (multi_select): ${val}`);
                  return val;
                } else {
                  console.log(`   ⚠️ Campo encontrado mas vazio ou tipo não suportado. Conteúdo:`, prop);
                  return 0;
                }
              }
            }
            
            console.log(`❌ Nenhum campo de impactos encontrado. Procurados:`, possibleKeys);
            return 0;
          })(),
          
          // Spots 30ʺ
          spots30: extractValue(properties, 0, 'Spots 30ʺ', 'Spots 30ʺ'),
          valorTabela30: extractValue(properties, 0, 'Valor spot 30ʺ (Tabela)', 'Valor spot 30ʺ (Tabela)'),
          valorNegociado30: extractValue(properties, 0, 'Valor spot 30ʺ (Negociado)', 'Valor spot 30ʺ (Negociado)'),
          
          // Spots 60ʺ
          spots60: extractValue(properties, 0, 'Spots 60ʺ', 'Spots 60ʺ'),
          valorTabela60: extractValue(properties, 0, 'Valor spot 60ʺ (Tabela)', 'Valor spot 60ʺ (Tabela)'),
          valorNegociado60: extractValue(properties, 0, 'Valor spot 60ʺ (Negociado)', 'Valor spot 60ʺ (Negociado)'),
          
          // Blitz
          spotsBlitz: extractValue(properties, 0, 'Blitz', 'Blitz', 'blitz'),
          valorTabelaBlitz: extractValue(properties, 0, 'Valor Blitz (Tabela)', 'Valor Blitz (Tabela)', 'valorTabelaBlitz'),
          valorNegociadoBlitz: extractValue(properties, 0, 'Valor Blitz (Negociado)', 'Valor Blitz (Negociado)', 'valorNegociadoBlitz'),
          
          // Spots 15"
          spots15: extractValue(properties, 0, 'Spots 15', 'Spots 15"', 'Spots 15ʺ', 'Spots 15', 'spots15'),
          valorTabela15: extractValue(properties, 0, 'Valor spot 15 (Tabela)', 'Valor spot 15" (Tabela)', 'Valor spot 15ʺ (Tabela)', 'Valor spot 15 (Tabela)', 'valorTabela15'),
          valorNegociado15: extractValue(properties, 0, 'Valor spot 15 (Negociado)', 'Valor spot 15"(Negociado)', 'Valor spot 15ʺ(Negociado)', 'Valor spot 15 (Negociado)', 'valorNegociado15'),
          
          // Spots 5ʺ
          spots5: extractValue(properties, 0, 'Spots 5ʺ', 'Spots 5ʺ'),
          valorTabela5: extractValue(properties, 0, 'Valor spot 5ʺ (Tabela)', 'Valor spot 5ʺ (Tabela)'),
          valorNegociado5: extractValue(properties, 0, 'Valor spot 5ʺ (Negociado)', 'Valor spot 5ʺ (Negociado)'),
          
          // Test. 30ʺ
          spotsTest30: extractValue(properties, 0, 'Test. 30ʺ', 'Test. 30ʺ'),
          valorTabelaTest30: extractValue(properties, 0, 'Valor test. 30ʺ (Tabela)', 'Valor test. 30ʺ (Tabela)'),
          valorNegociadoTest30: extractValue(properties, 0, 'Valor test. 30ʺ (Negociado)', 'Valor test. 30ʺ (Negociado)'),
          
          // Test. 60ʺ
          spotsTest60: extractValue(properties, 0, 'Test. 60ʺ', 'Test. 60ʺ'),
          valorTabelaTest60: extractValue(properties, 0, 'Valor test. 60ʺ (Tabela)', 'Valor test. 60ʺ (Tabela)'),
          valorNegociadoTest60: extractValue(properties, 0, 'Valor test. 60ʺ (Negociado)', 'Valor test. 60ʺ (Negociado)'),
          
          // Flash 30"
          spotsFlash30: extractValue(properties, 0, 'Flash 30', 'Flash 30"', 'Flash 30ʺ', 'Flash 30', 'spotsFlash30'),
          valorTabelaFlash30: extractValue(properties, 0, 'Valor Flash 30 (Tabela)', 'Valor Flash 30" (Tabela)', 'Valor Flash 30ʺ (Tabela)', 'Valor Flash 30 (Tabela)', 'valorTabelaFlash30'),
          valorNegociadoFlash30: extractValue(properties, 0, 'Valor Flash 30 (Negociado)', 'Valor Flash 30"(Negociado)', 'Valor Flash 30ʺ(Negociado)', 'Valor Flash 30 (Negociado)', 'valorNegociadoFlash30'),
          
          // Flash 60"
          spotsFlash60: extractValue(properties, 0, 'Flash 60', 'Flash 60"', 'Flash 60ʺ', 'Flash 60', 'spotsFlash60'),
          valorTabelaFlash60: extractValue(properties, 0, 'Valor Flash 60 (Tabela)', 'Valor Flash 60" (Tabela)', 'Valor Flash 60ʺ (Tabela)', 'Valor Flash 60 (Tabela)', 'valorTabelaFlash60'),
          valorNegociadoFlash60: extractValue(properties, 0, 'Valor Flash 60 (Negociado)', 'Valor Flash 60"(Negociado)', 'Valor Flash 60ʺ(Negociado)', 'Valor Flash 60 (Negociado)', 'valorNegociadoFlash60'),
          
          // Menshan 30"
          spotsMensham30: extractValue(properties, 0, 'Menshan 30', 'Menshan 30"', 'Menshan 30ʺ', 'Menshan 30', 'spotsMensham30'),
          valorTabelaMensham30: extractValue(properties, 0, 'Valor Mershan 30 (Tabela)', 'Valor Mershan 30" (Tabela)', 'Valor Mershan 30ʺ (Tabela)', 'Valor Mershan 30 (Tabela)', 'valorTabelaMensham30'),
          valorNegociadoMensham30: extractValue(properties, 0, 'Valor Mershan 30 (Tabela)', 'Valor Mershan 30" (Tabela)', 'Valor Mershan 30ʺ (Tabela)', 'Valor Mershan 30 (Tabela)', 'valorNegociadoMensham30'),
          
          // Menshan 60"
          spotsMensham60: extractValue(properties, 0, 'Menshan 60', 'Menshan 60"', 'Menshan 60ʺ', 'Menshan 60', 'spotsMensham60'),
          valorTabelaMensham60: extractValue(properties, 0, 'Valor Mershan 60 (Tabela)', 'Valor Mershan 60" (Tabela)', 'Valor Mershan 60ʺ (Tabela)', 'Valor Mershan 60 (Tabela)', 'valorTabelaMensham60'),
          valorNegociadoMensham60: extractValue(properties, 0, 'Valor Mershan 60 (Tabela)', 'Valor Mershan 60" (Tabela)', 'Valor Mershan 60ʺ (Tabela)', 'Valor Mershan 60 (Tabela)', 'valorNegociadoMensham60')
        };
      });

      console.log('✅ Emissoras mapeadas:', emissoras);
      
      // Obter lista de emissoras nos alternantes (com tratamento de erro)
      let ocultasEmissoras = [];
      try {
        const alternantesDbId = await getOrCreateAlternantesDatabase(notionToken, 'e-radios');
        if (alternantesDbId) {
          ocultasEmissoras = await getAlternantesEmissoraIds(notionToken, alternantesDbId);
        }
      } catch (alternantesError) {
        console.warn('⚠️ Erro ao obter alternantes, continuando sem eles:', alternantesError.message);
        ocultasEmissoras = [];
      }
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ EMISSORAS MAPEADAS - PRIMEIRA EMISSORA:');
      console.log('═══════════════════════════════════════════════════════════');
      if (emissoras.length > 0) {
        console.log(JSON.stringify(emissoras[0], null, 2));
      }
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      return new Response(JSON.stringify({
        emissoras: emissoras,
        ocultasEmissoras: ocultasEmissoras
      }), {
        status: 200,
        headers
      });
    }

    // MÉTODO PATCH - ATUALIZAR MÚLTIPLAS EMISSORAS
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

      log('🔄 Atualizando múltiplas emissoras');
      log('📝 Dados recebidos: ' + JSON.stringify(requestBody));

      const { emissoras, changes, ocultasEmissoras } = requestBody;
      if (!emissoras || !Array.isArray(emissoras)) {
        return new Response(JSON.stringify({ 
          error: 'Emissoras deve ser um array' 
        }), {
          status: 400,
          headers
        });
      }

      // Processar ocultamento de emissoras (Liga/desliga)
      if (ocultasEmissoras && Array.isArray(ocultasEmissoras) && ocultasEmissoras.length > 0) {
        log(`👤 Processando ${ocultasEmissoras.length} emissoras para alternantes...`);
        log(`📋 IDs a ocultar: ${JSON.stringify(ocultasEmissoras)}`);
        
        try {
          let alternantesDbId = await getOrCreateAlternantesDatabase(notionToken, 'e-radios');
          log(`🔎 alternantesDbId obtido: ${alternantesDbId}`);
          
          // Se não encontrou, criar agora
          if (!alternantesDbId) {
            log('📝 Criando database "Lista de alternantes" agora...');
            alternantesDbId = await createAlternantesDatabase(notionToken);
            log(`✅ Database criada: ${alternantesDbId}`);
          }
          
          if (alternantesDbId) {
            log(`🔄 Iniciando movimento de ${ocultasEmissoras.length} emissoras...`);
            for (const emissoraId of ocultasEmissoras) {
              const emissora = emissoras.find(e => e.id === emissoraId);
              log(`  ↳ Processando: ${emissoraId} - ${emissora?.emissora || 'NÃO ENCONTRADA'}`);
              if (emissora) {
                const result = await moveToAlternantes(notionToken, emissora, tableId, alternantesDbId);
                log(`  ↳ Resultado: ${result}`);
              } else {
                log(`  ⚠️ Emissora ${emissoraId} não encontrada nos dados`);
              }
            }
          } else {
            log('❌ Não foi possível criar/obter database de alternantes');
          }
        } catch (ocultError) {
          log('⚠️ Erro ao processar ocultamento: ' + ocultError.message);
          log('⚠️ Stack: ' + ocultError.stack);
          // Continua mesmo se houver erro no ocultamento
        }
      } else {
        log(`ℹ️ Nenhuma emissora para ocultar (${ocultasEmissoras?.length || 0})`);
      }

      // Processar cada alteração
      const updatePromises = [];
      
      for (const changeKey in changes) {
        const change = changes[changeKey];
        const emissora = emissoras[change.emissoraIndex];
        
        if (!emissora || !emissora.id) continue;

        // Mapear campo para nome do Notion
        const fieldMap = {
          'spots30': 'Spots 30ʺ',
          'valorTabela30': 'Valor spot 30ʺ (Tabela)',
          'valorNegociado30': 'Valor spot 30ʺ (Negociado)',
          'spots60': 'Spots 60ʺ',
          'valorTabela60': 'Valor spot 60ʺ (Tabela)',
          'valorNegociado60': 'Valor spot 60ʺ (Negociado)',
          'spotsBlitz': 'Blitz',
          'valorTabelaBlitz': 'Valor Blitz (Tabela)',
          'valorNegociadoBlitz': 'Valor Blitz (Negociado)',
          'spots15': 'Spots 15ʺ',
          'valorTabela15': 'Valor spot 15ʺ (Tabela)',
          'valorNegociado15': 'Valor spot 15ʺ (Negociado)',
          'spots5': 'Spots 5ʺ',
          'valorTabela5': 'Valor spot 5ʺ (Tabela)',
          'valorNegociado5': 'Valor spot 5ʺ (Negociado)',
          'spotsTest60': 'Test. 60ʺ',
          'valorTabelaTest60': 'Valor test. 60ʺ (Tabela)',
          'valorNegociadoTest60': 'Valor test. 60ʺ (Negociado)'
        };

        const notionField = fieldMap[change.field];
        if (!notionField) {
          console.error(`❌ Campo não mapeado: ${change.field}`);
          continue;
        }

        console.log(`📤 Atualizando ${emissora.emissora} - Campo: "${notionField}" = ${change.new}`);

        const updateProperties = {};
        updateProperties[notionField] = { number: parseFloat(change.new) || 0 };

        const bodyToSend = JSON.stringify({ properties: updateProperties });
        console.log(`🔍 FIELD NAME (chave):`, notionField);
        console.log(`🔍 FIELD NAME (type):`, typeof notionField);
        console.log(`🔍 BODY sendo enviado para Notion:`, bodyToSend);
        console.log(`🔍 updateProperties objeto:`, updateProperties);

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
          console.error(`❌ Erro ao atualizar ${emissora.emissora} (${notionField}):`, updateResponse.status, updateData);
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
          console.log(`✅ ${emissora.emissora} - ${notionField} atualizado com sucesso`);
          updatePromises.push({
            field: change.field,
            notionField: notionField,
            emissoraId: emissora.id,
            emissoraName: emissora.emissora,
            success: true
          });
        }
      }

      // Enviar email com as alterações
      try {
        await sendNotificationEmail(env, {
          tableId: id,
          changes: updatePromises,
          emissoras: emissoras,
          requestIP: request.headers.get('cf-connecting-ip') || 'desconhecido'
        });
      } catch (emailError) {
        console.error('⚠️ Erro ao enviar email:', emailError.message);
        // Não interrompe o fluxo se falhar o email
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Alterações processadas',
        totalChanges: Object.keys(changes).length,
        successfulUpdates: updatePromises.filter(p => p.success).length,
        failedUpdates: updatePromises.filter(p => !p.success).length,
        details: updatePromises,
        debugLogs: debugLogs
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

// =====================================================
// FUNÇÃO DE ENVIO DE EMAIL
// =====================================================

async function sendNotificationEmail(env, data) {
  const { tableId, changes, emissoras, requestIP } = data;
  const resendApiKey = env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.warn('⚠️ RESEND_API_KEY não configurada. Email não será enviado.');
    return;
  }

  // Agrupar alterações por emissora
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
      <title>Alteração de Proposta</title>
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
          <h1>📋 Alteração de Proposta Radiofônica</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">E-MÍDIAS | Sistema de Gestão de Propostas</p>
        </div>
        
        <div class="content">
          <p>Olá,</p>
          <p>Uma proposta foi alterada no sistema E-MÍDIAS. Confira os detalhes abaixo:</p>
          
          <div class="info-box">
            <strong>📅 Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}<br>
            <strong>🌐 IP do Responsável:</strong> ${requestIP}
          </div>
  `;

  // Adicionar alterações por emissora
  for (const emissoraIndex in changesByEmissora) {
    const emissora = emissoras[emissoraIndex];
    const emissoras_changes = changesByEmissora[emissoraIndex];
    
    emailHTML += `
      <div class="change-group">
        <h3>📻 ${emissora.emissora}</h3>
    `;
    
    emissoras_changes.forEach(change => {
      emailHTML += `
        <div class="change-item">
          <strong>${change.notionField}:</strong> 
          <span class="old-value">${change.oldValue || change.old}</span> 
          → 
          <span class="new-value">${change.newValue || change.new}</span>
        </div>
      `;
    });
    
    emailHTML += '</div>';
  }

  // Link da proposta
  emailHTML += `
          <div class="info-box">
            <strong>🔗 Link da Proposta:</strong><br>
            <a href="https://seu-dominio.pages.dev/?id=${tableId}" class="link">Abrir Proposta no E-MÍDIAS</a>
          </div>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            Este é um email automático. Não responda este message.
          </p>
        </div>
        
        <div class="footer">
          <p>© 2025 HUB RÁDIOS - E-MÍDIAS. Todos os direitos reservados.</p>
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
        subject: `[E-MÍDIAS] Alteração de Proposta - ${new Date().toLocaleDateString('pt-BR')}`,
        html: emailHTML
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Email enviado com sucesso:', result.id);
    } else {
      const error = await response.json();
      console.error('❌ Erro ao enviar email via Resend:', error);
    }
  } catch (error) {
    console.error('❌ Erro na requisição Resend:', error);
  }
}

function findEmissoraIndexById(id, emissoras) {
  return emissoras.findIndex(e => e.id === id);
}

async function getAlternantesEmissoraIds(notionToken, alternantesDbId) {
  console.log('📤 Obtendo lista de IDs de alternantes...');
  
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${alternantesDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'archived',
          checkbox: {
            equals: false
          }
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const alternantesIds = [];
      
      for (const page of data.results) {
        const idEmissoraField = page.properties['ID Emissora'];
        if (idEmissoraField && idEmissoraField.rich_text && idEmissoraField.rich_text.length > 0) {
          alternantesIds.push(idEmissoraField.rich_text[0].text.content);
        }
      }
      
      console.log(`✅ ${alternantesIds.length} emissoras encontradas nos alternantes`);
      return alternantesIds;
    }
  } catch (error) {
    console.error('❌ Erro ao obter alternantes:', error);
  }
  
  return [];
}

// =====================================================
// GERENCIAMENTO DE "LISTA DE ALTERNANTES"
// =====================================================

async function getOrCreateAlternantesDatabase(notionToken, workspaceId) {
  console.log('🔍 Buscando database "Lista de alternantes"...');
  
  if (!notionToken) {
    console.warn('⚠️ Token Notion não disponível');
    return null;
  }
  
  try {
    // Procura por database chamada "Lista de alternantes" no workspace
    const searchResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'Lista de alternantes',
        filter: {
          value: 'database',
          property: 'object'
        }
      })
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const existingDb = searchData.results?.find(item => 
        item.title && item.title[0]?.text?.content === 'Lista de alternantes'
      );
      
      if (existingDb) {
        console.log('✅ Database "Lista de alternantes" encontrada:', existingDb.id);
        return existingDb.id;
      }
    }

    console.log('ℹ️ Database "Lista de alternantes" não encontrada. Será criada ao primeiro ocultamento.');
    return null;
  } catch (error) {
    console.error('⚠️ Erro ao buscar database:', error.message);
    return null;
  }
}

async function createAlternantesDatabase(notionToken) {
  console.log('📝 Criando nova database "Lista de alternantes"...');
  try {
    const createResponse = await fetch('https://api.notion.com/v1/databases', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: {
          type: 'workspace',
          workspace: true
        },
        title: [
          {
            type: 'text',
            text: {
              content: 'Lista de alternantes'
            }
          }
        ],
        properties: {
          'Emissora': {
            title: {}
          },
          'ID Emissora': {
            rich_text: {}
          },
          'Data Adicionado': {
            date: {}
          }
        }
      })
    });

    if (createResponse.ok) {
      const newDb = await createResponse.json();
      console.log('✅ Database "Lista de alternantes" criada:', newDb.id);
      return newDb.id;
    } else {
      const error = await createResponse.json();
      console.error('❌ Erro ao criar database:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro na requisição de criação:', error);
    return null;
  }
}


async function moveToAlternantes(notionToken, emissora, mainTableId, alternantesDbId) {
  console.log(`📤 Movendo emissora ${emissora.emissora} para alternantes...`);
  
  try {
    // 1. Criar página na "Lista de alternantes" com todos os dados
    console.log(`  1️⃣ Criando registro em alternantes...`);
    const createResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: {
          database_id: alternantesDbId
        },
        properties: {
          'Emissora': {
            title: [
              {
                text: {
                  content: emissora.emissora
                }
              }
            ]
          },
          'ID Emissora': {
            rich_text: [
              {
                text: {
                  content: emissora.id
                }
              }
            ]
          },
          'Data Adicionado': {
            date: {
              start: new Date().toISOString().split('T')[0]
            }
          }
        }
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.error(`❌ Erro ao criar em alternantes:`, error);
      return false;
    }
    
    console.log(`  ✅ Registro criado em alternantes`);

    // 2. Deletar a página original da tabela principal
    console.log(`  2️⃣ Deletando registro da tabela principal (ID: ${emissora.id})...`);
    const deleteResponse = await fetch(`https://api.notion.com/v1/pages/${emissora.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: true
      })
    });

    if (deleteResponse.ok) {
      console.log(`  ✅ Emissora ${emissora.emissora} movida para alternantes com sucesso!`);
      return true;
    } else {
      const error = await deleteResponse.json();
      console.error(`⚠️ Erro ao arquivar da tabela principal:`, error);
      // Mesmo que falhe o arquivamento, consideramos sucesso pois está em alternantes
      return true;
    }
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
    return false;
  }
}

async function removeFromAlternantes(notionToken, emissoraId, alternantesDbId) {
  console.log(`🗑️ Removendo emissora ${emissoraId} dos alternantes...`);
  
  try {
    // Procura a página com ID da emissora
    const queryResponse = await fetch(`https://api.notion.com/v1/databases/${alternantesDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: 'ID Emissora',
          rich_text: {
            equals: emissoraId
          }
        }
      })
    });

    if (queryResponse.ok) {
      const queryData = await queryResponse.json();
      
      if (queryData.results.length > 0) {
        const pageId = queryData.results[0].id;
        
        // Arquiva a página
        const archiveResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${notionToken.trim()}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            archived: true
          })
        });

        if (archiveResponse.ok) {
          console.log(`✅ Emissora ${emissoraId} removida dos alternantes`);
          return true;
        }
      } else {
        console.log(`⚠️ Emissora ${emissoraId} não encontrada nos alternantes`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erro ao remover dos alternantes:', error);
    return false;
  }
}
