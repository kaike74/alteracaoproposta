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
    console.log('3. Mtodo:', request.method);
    console.log('4. URL:', request.url);
    console.log('========================');
    
    if (!notionToken) {
      return new Response(JSON.stringify({ 
        error: 'Token do Notion no configurado',
        debug: {
          message: 'Varivel NOTION_TOKEN no encontrada',
          env_keys: Object.keys(env || {})
        }
      }), {
        status: 500,
        headers
      });
    }

      // MTODO GET - BUSCAR DADOS DA TABELA DE EMISSORAS
      if (request.method === 'GET') {
        let id = url.searchParams.get('id');
        const debugMode = url.searchParams.get('debug') === 'true';
        const listFieldsOnly = url.searchParams.get('listFields') === 'true';
        const debugFields = url.searchParams.get('debugFields') === 'true';
        const showAllFields = url.searchParams.get('showAllFields') === 'true';
        
        console.log(' DEBUG GET REQUEST - TABELA DE EMISSORAS');
        console.log('URL completa:', request.url);
        console.log('Query params:', [...url.searchParams.entries()]);
        console.log('ID extrado:', id);
        console.log('Debug mode:', debugMode);
        console.log('List fields only:', listFieldsOnly);
        console.log('Debug Fields mode:', debugFields);      if (!id || id.trim() === '') {
        return new Response(JSON.stringify({ 
          error: 'ID da tabela  obrigatrio',
          debug: {
            receivedUrl: request.url,
            rawId: id
          }
        }), {
          status: 400,
          headers
        });
      }

      // Notion API espera ID sem hfens
      id = id.replace(/-/g, '');
      console.log(' ID formatado para Notion:', id);
      console.log(' Buscando tabela de emissoras:', id);

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

      console.log(' Resposta Notion - Status:', response.status);
      console.log(' Resposta Notion - OK:', response.ok);

      if (!response.ok) {
        let errorDetails = response.statusText;
        let errorBody = {};
        
        try {
          errorBody = await response.json();
          console.log(' Erro Notion JSON:', errorBody);
          errorDetails = JSON.stringify(errorBody, null, 2);
        } catch (e) {
          try {
            errorDetails = await response.text();
            console.log(' Erro Notion texto:', errorDetails);
          } catch (e2) {
            console.log('No foi possvel ler corpo do erro');
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
      console.log(' Tabela recebida com sucesso!');
      console.log(' Total de registros:', notionData.results?.length || 0);
      console.log(' Primeiro registro ID:', notionData.results?.[0]?.id || 'nenhum');
      
      // Se solicitado, retornar APENAS lista de campos
      if (listFieldsOnly) {
        const firstRecord = notionData.results?.[0];
        if (!firstRecord?.properties) {
          return new Response(JSON.stringify({
            error: 'Nenhum registro encontrado'
          }), { status: 400, headers });
        }
        
        // Se showAllFields, retornar JSON com todos os campos da primeira emissora
        if (showAllFields && notionData.results.length > 0) {
          const firstRecord = notionData.results[0];
          const allProps = Object.keys(firstRecord.properties).sort();
          const importantProps = allProps.filter(k => {
            const lower = k.toLowerCase();
            return lower.includes('valor') || lower.includes('negociado') || lower.includes('tabela') || lower.includes('cota') || lower.includes('spot');
          });
          
          return new Response(JSON.stringify({
            success: true,
            showAllFields: true,
            emissora: firstRecord.properties['Emissora']?.rich_text?.[0]?.text?.content || 'Desconhecida',
            totalFields: allProps.length,
            importantFieldsCount: importantProps.length,
            importantFields: importantProps.map(name => {
              const prop = firstRecord.properties[name];
              let value = '?';
              if (prop.type === 'number') value = prop.number;
              else if (prop.type === 'formula') value = prop.formula?.number || prop.formula?.string;
              else if (prop.type === 'rich_text') value = prop.rich_text?.[0]?.text?.content;
              return {
                name: name,
                type: prop.type,
                value: value
              };
            }),
            allFields: allProps
          }, null, 2), { status: 200, headers });
        }
        
        // Se debugFields, retornar com valores completos
        if (debugFields) {
          const fieldsWithValues = Object.keys(firstRecord.properties).map(name => {
            const prop = firstRecord.properties[name];
            let value = null;
            
            if (prop.type === 'number') value = prop.number;
            else if (prop.type === 'title') value = prop.title?.[0]?.text?.content;
            else if (prop.type === 'rich_text') value = prop.rich_text?.[0]?.text?.content;
            else if (prop.type === 'formula') value = prop.formula?.number || prop.formula?.string;
            
            return {
              name: name,
              type: prop.type,
              value: value,
              raw: prop
            };
          });
          
          return new Response(JSON.stringify({
            success: true,
            debugFields: true,
            firstRecordId: firstRecord.id,
            emissora: firstRecord.properties['Emissora']?.rich_text?.[0]?.text?.content || 'Desconhecida',
            fields: fieldsWithValues
          }, null, 2), { status: 200, headers });
        }
        
        const fields = Object.keys(firstRecord.properties).map(name => ({
          name: name,
          type: firstRecord.properties[name].type
        }));
        
        return new Response(JSON.stringify({
          success: true,
          total: fields.length,
          fields: fields,
          firstRecordId: firstRecord.id
        }), { status: 200, headers });
      }
      
      // Log detalhado dos campos do primeiro registro
      const firstRecord = notionData.results?.[0];
      let allFields = [];
      
      if (firstRecord?.properties) {
        console.log('');
        console.log('');
        console.log(' TODOS OS CAMPOS ENCONTRADOS NO NOTION (PRIMEIRO REGISTRO):');
        console.log('');
        const fieldNames = Object.keys(firstRecord.properties).sort();
        allFields = fieldNames.map(fieldName => ({
          name: fieldName,
          type: firstRecord.properties[fieldName].type
        }));
        
        fieldNames.forEach(fieldName => {
          const prop = firstRecord.properties[fieldName];
          console.log(`  "${fieldName}" (tipo: ${prop.type})`);
        });
        console.log('');
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
        
        // Log especfico para campos que contm "impacto"
        console.log(' PROCURANDO CAMPOS COM "IMPACTO":');
        const impactFields = fieldNames.filter(f => f.toLowerCase().includes('impacto'));
        if (impactFields.length > 0) {
          impactFields.forEach(field => {
            const prop = firstRecord.properties[field];
            console.log(`   ENCONTRADO: "${field}" (tipo: ${prop.type})`);
            console.log(`     Contedo bruto:`, JSON.stringify(prop));
          });
        } else {
          console.log('   NENHUM CAMPO COM "IMPACTO" ENCONTRADO');
          console.log('   DICA: Os campos encontrados so:');
          fieldNames.forEach(fieldName => {
            console.log(`     - "${fieldName}"`);
          });
        }
        console.log('');
        
        console.log('');
        console.log(' VALORES DOS CAMPOS (PRIMEIRO REGISTRO):');
        console.log('');
        fieldNames.forEach(fieldName => {
          const prop = firstRecord.properties[fieldName];
          let value = '(vazio)';
          if (prop.type === 'number' && prop.number !== null) value = prop.number;
          if (prop.type === 'title' && prop.title?.length) value = prop.title[0].text.content;
          if (prop.type === 'rich_text' && prop.rich_text?.length) value = prop.rich_text[0].text.content;
          console.log(`  "${fieldName}": ${value}`);
        });
        console.log('');
        console.log('');
      }
      
      if (!notionData.results || notionData.results.length === 0) {
        console.log(' AVISO: Database retornou vazio!');
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

      // Função otimizada para extrair valores com suporte a Patrocínio
      const extractValue = (properties, defaultValue = 0, propName = '', ...possibleKeys) => {
        // Tenta cada chave possível em sequência (match exato primeiro)
        for (const key of possibleKeys) {
          const prop = properties[key];
          if (prop) {
            // Log para Patrocínio
            if (propName && propName.includes('Cota')) {
              console.log(`✅ ENCONTRADO (match exato): "${key}" para ${propName}`);
            }
            
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
              case 'formula':
                return prop.formula?.number !== null ? prop.formula.number : (prop.formula?.string || defaultValue);
              default:
                return defaultValue;
            }
          }
        }
        
        // FALLBACK 1: busca parcial case-insensitive (otimizado)
        const allKeys = Object.keys(properties);
        for (const key of allKeys) {
          const keyLower = key.toLowerCase().replace(/[^\w]/g, '');
          for (const searchKey of possibleKeys) {
            if (!searchKey) continue;
            const searchLower = searchKey.toLowerCase().replace(/[^\w]/g, '');
            
            if (keyLower.includes(searchLower) || searchLower.includes(keyLower)) {
              const prop = properties[key];
              
              // Log para Patrocínio
              if (propName && propName.includes('Cota')) {
                console.log(`✅ ENCONTRADO (FALLBACK 1): Notion="${key}" (${prop.type}) para ${propName}`);
              }
              
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
                case 'formula':
                  return prop.formula?.number !== null ? prop.formula.number : (prop.formula?.string || defaultValue);
                default:
                  return defaultValue;
              }
            }
          }
        }
        
        // FALLBACK 2: busca por palavras-chave (para campos "Valor Tabela por Cota" que podem estar com nomes diferentes)
        if (propName && (propName.includes('Valor') && propName.includes('Cota'))) {
          // Procura especificamente por campos que contêm "Valor" E "Cota"
          for (const key of allKeys) {
            const keyLower = key.toLowerCase();
            if (keyLower.includes('valor') && keyLower.includes('cota')) {
              const prop = properties[key];
              
              // ⚠️ IMPORTANTE: Verificar se o campo é realmente o correto
              // Se está procurando "Negociado", o campo DEVE conter "negociado"
              // Se está procurando "Tabela", o campo DEVE conter "tabela"
              if (propName.includes('Negociado') && !keyLower.includes('negociado')) {
                console.warn(`⚠️  FALLBACK 2: Campo "${key}" encontrado mas NÃO contém 'negociado' - PULANDO`);
                continue; // PULE e procure o próximo
              }
              if (propName.includes('Tabela') && !keyLower.includes('tabela')) {
                console.warn(`⚠️  FALLBACK 2: Campo "${key}" encontrado mas NÃO contém 'tabela' - PULANDO`);
                continue; // PULE e procure o próximo
              }
              
              console.warn(`✅ FALLBACK 2: Campo correto encontrado: "${key}" (${prop.type}) para ${propName}`);
              
              switch (prop.type) {
                case 'number':
                  return prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
                case 'formula':
                  return prop.formula?.number !== null ? prop.formula.number : (prop.formula?.string || defaultValue);
                default:
                  return defaultValue;
              }
            }
          }
        }
        
        // FALLBACK 3: busca específica por "Negociado"
        if (propName && propName.includes('Negociado')) {
          for (const key of allKeys) {
            const keyLower = key.toLowerCase();
            // Procura por campos que contêm "negociado" (qualquer variação)
            if (keyLower.includes('negociado')) {
              // Verificar se também tem "cota" ou "valor"
              if (!keyLower.includes('cota') && !keyLower.includes('valor')) {
                console.warn(`⚠️  FALLBACK 3: Campo "${key}" tem 'negociado' mas não tem 'cota' ou 'valor' - PULANDO`);
                continue;
              }
              
              const prop = properties[key];
              console.log(`✅ FALLBACK 3: Campo 'Negociado' encontrado: "${key}" (${prop.type})`);
              
              switch (prop.type) {
                case 'number':
                  return prop.number !== null && prop.number !== undefined ? prop.number : defaultValue;
                case 'formula':
                  return prop.formula?.number !== null ? prop.formula.number : (prop.formula?.string || defaultValue);
                default:
                  return defaultValue;
              }
            }
          }
        }
        
        // Se nada foi encontrado, logar para debug
        if (propName && propName.includes('Cota')) {
          console.warn(`❌ NÃO ENCONTRADO: ${propName}`);
          console.warn(`   Procurando por: ${possibleKeys.join(', ')}`);
          const valorCotaFields = allKeys.filter(k => k.toLowerCase().includes('valor') || k.toLowerCase().includes('cota'));
          console.warn(`   Campos com 'valor' ou 'cota' disponíveis:`, valorCotaFields);
          console.warn(`   TODOS os campos:`, allKeys.slice(0, 15).map(k => `"${k}"`).join(', '));
        }
        
        return defaultValue;
      };

      // Mapear registros da tabela (otimizado - debug apenas se necessário)
      const emissoras = notionData.results.map((row, rowIndex) => {
        const properties = row.properties || {};
        
        // LOG detalhado apenas da primeira emissora para debug de Patrocínio
        if (rowIndex === 0) {
          console.log('\n╔════════════════════════════════════════════════════════════════╗');
          console.log('║ 🔍 PRIMEIRA EMISSORA - TODOS OS CAMPOS');
          console.log('╚════════════════════════════════════════════════════════════════╝');
          const allKeys = Object.keys(properties).sort();
          
          // Mostrar campos com 'valor', 'negociado', 'cota', 'tabela'
          console.log('📌 CAMPOS IMPORTANTES (com valor/negociado/cota/tabela):');
          const importantFields = allKeys.filter(k => {
            const lower = k.toLowerCase();
            return lower.includes('valor') || lower.includes('negociado') || lower.includes('cota') || lower.includes('tabela');
          });
          importantFields.forEach(key => {
            const prop = properties[key];
            let valor = '?';
            if (prop.type === 'number') valor = prop.number;
            else if (prop.type === 'formula') valor = prop.formula?.number || prop.formula?.string;
            console.log(`   "${key}" (${prop.type}) = ${valor}`);
          });
          
          console.log('\n📋 TODOS OS CAMPOS:');
          allKeys.forEach(key => {
            const prop = properties[key];
            console.log(`   "${key}" (${prop.type})`);
          });
          console.log('');
        }
        
        // Log detalhado apenas se houver parâmetro debug=true na URL
        const debugMode = url.searchParams.get('debug') === 'true';
        if (rowIndex === 0 && debugMode) {
          console.log('═══ DEBUG: CAMPOS DISPONÍVEIS NO NOTION ═══');
          const allFields = Object.keys(properties).sort();
          allFields.forEach(field => console.log(`   "${field}"`));
          console.log('═══════════════════════════════════════════');
        }
        
        return {
          id: row.id,
          proposta: extractValue(properties, '', 'Proposta', 'Proposta', 'Nome Proposta', 'Nome da Proposta'),
          empresa: extractValue(properties, '', 'Empresa', 'Empresa', 'Cliente', 'Nome Empresa'),
          emissora: extractValue(properties, '', 'Emissora', 'Emissora'),
          praca: extractValue(properties, '', 'Praa', 'Praa', 'Praca'),
          dial: extractValue(properties, '', 'Dial', 'Dial'),
          linkLogo: extractValue(properties, '', 'linkLogo', 'linkLogo', 'Link Logo', 'Link da Logo', 'Logo URL', 'URL Logo'),
          uf: extractValue(properties, '', 'UF', 'UF'),
          impactos: (() => {
            // Extração otimizada de impactos
            const possibleKeys = ['Impactos', 'impactos', 'Quantidade de Impactos', 'IMPACTOS', 'Impacto', 'impacto', 'IMPACTO', 'Qtd Impactos'];
            
            for (const key of possibleKeys) {
              const prop = properties[key];
              if (!prop) continue;
              
              // Tenta extrair de qualquer tipo de campo
              if (prop.type === 'number') return prop.number || 0;
              if (prop.type === 'title') return prop.title?.[0]?.text?.content || 0;
              if (prop.type === 'rich_text') return prop.rich_text?.[0]?.text?.content || 0;
              if (prop.type === 'formula') return prop.formula?.number || prop.formula?.string || 0;
            }
            
            return 0;
          })(),
          
          // Spots 30ʺ
          spots30: extractValue(properties, 0, 'Spots 30', 'Spots 30ʺ', 'Spots 30'),
          valorTabela30: extractValue(properties, 0, 'Valor spot 30 (Tabela)', 'Valor spot 30ʺ (Tabela)', 'Valor spot 30 (Tabela)', 'Valor 30 (Tabela)', 'Valor 30ʺ (Tabela)'),
          valorNegociado30: extractValue(properties, 0, 'Valor spot 30 (Negociado)', 'Valor spot 30ʺ (Negociado)', 'Valor spot 30 (Negociado)', 'Valor 30 (Negociado)', 'Valor 30ʺ (Negociado)'),
          
          // Spots 60ʺ
          spots60: extractValue(properties, 0, 'Spots 60', 'Spots 60ʺ', 'Spots 60'),
          valorTabela60: extractValue(properties, 0, 'Valor spot 60 (Tabela)', 'Valor spot 60ʺ (Tabela)', 'Valor spot 60 (Tabela)', 'Valor 60 (Tabela)', 'Valor 60ʺ (Tabela)'),
          valorNegociado60: extractValue(properties, 0, 'Valor spot 60 (Negociado)', 'Valor spot 60ʺ (Negociado)', 'Valor spot 60 (Negociado)', 'Valor 60 (Negociado)', 'Valor 60ʺ (Negociado)'),
          
          // Blitz
          spotsBlitz: extractValue(properties, 0, 'Blitz', 'Blitz'),
          valorTabelaBlitz: extractValue(properties, 0, 'Valor Blitz (Tabela)', 'Valor Blitz (Tabela)', 'Blitz Tabela'),
          valorNegociadoBlitz: extractValue(properties, 0, 'Valor Blitz (Negociado)', 'Valor Blitz (Negociado)', 'Blitz Negociado'),
          
          // Spots 15ʺ
          spots15: extractValue(properties, 0, 'Spots 15', 'Spots 15ʺ', 'Spots 15'),
          valorTabela15: extractValue(properties, 0, 'Valor spot 15 (Tabela)', 'Valor spot 15ʺ (Tabela)', 'Valor spot 15 (Tabela)', 'Valor 15 (Tabela)', 'Valor 15ʺ (Tabela)'),
          valorNegociado15: extractValue(properties, 0, 'Valor spot 15 (Negociado)', 'Valor spot 15ʺ (Negociado)', 'Valor spot 15 (Negociado)', 'Valor 15 (Negociado)', 'Valor 15ʺ (Negociado)'),
          
          // Spots 5ʺ
          spots5: extractValue(properties, 0, 'Spots 5', 'Spots 5ʺ'),
          valorTabela5: extractValue(properties, 0, 'Valor spot 5 (Tabela)', 'Valor spot 5ʺ (Tabela)', 'Valor 5 (Tabela)', 'Valor 5ʺ (Tabela)'),
          valorNegociado5: extractValue(properties, 0, 'Valor spot 5 (Negociado)', 'Valor spot 5ʺ (Negociado)', 'Valor 5 (Negociado)', 'Valor 5ʺ (Negociado)'),
          
          // Test. 30ʺ
          spotsTest30: extractValue(properties, 0, 'Test. 30', 'Test. 30ʺ'),
          valorTabelaTest30: extractValue(properties, 0, 'Valor test. 30 (Tabela)', 'Valor test. 30ʺ (Tabela)', 'Test 30 Tabela', 'Test 30 Valor Tabela'),
          valorNegociadoTest30: extractValue(properties, 0, 'Valor test. 30 (Negociado)', 'Valor test. 30ʺ (Negociado)', 'Test 30 Negociado', 'Test 30 Valor Negociado'),
          
          // Test. 60ʺ
          spotsTest60: extractValue(properties, 0, 'Test. 60', 'Test. 60ʺ'),
          valorTabelaTest60: extractValue(properties, 0, 'Valor test. 60 (Tabela)', 'Valor test. 60ʺ (Tabela)', 'Test 60 Tabela', 'Test 60 Valor Tabela'),
          valorNegociadoTest60: extractValue(properties, 0, 'Valor test. 60 (Negociado)', 'Valor test. 60ʺ (Negociado)', 'Test 60 Negociado', 'Test 60 Valor Negociado'),
          
          // Flash 30ʺ
          spotsFlash30: extractValue(properties, 0, 'Flash 30', 'Flash 30ʺ'),
          valorTabelaFlash30: extractValue(properties, 0, 'Valor Flash 30 (Tabela)', 'Valor Flash 30ʺ (Tabela)', 'Flash 30 Tabela', 'Flash 30 Valor Tabela'),
          valorNegociadoFlash30: extractValue(properties, 0, 'Valor Flash 30 (Negociado)', 'Valor Flash 30ʺ (Negociado)', 'Flash 30 Negociado', 'Flash 30 Valor Negociado'),
          
          // Flash 60ʺ
          spotsFlash60: extractValue(properties, 0, 'Flash 60', 'Flash 60ʺ'),
          valorTabelaFlash60: extractValue(properties, 0, 'Valor Flash 60 (Tabela)', 'Valor Flash 60ʺ (Tabela)', 'Flash 60 Tabela', 'Flash 60 Valor Tabela'),
          valorNegociadoFlash60: extractValue(properties, 0, 'Valor Flash 60 (Negociado)', 'Valor Flash 60ʺ (Negociado)', 'Flash 60 Negociado', 'Flash 60 Valor Negociado'),
          
          // Menshan 30ʺ
          spotsMensham30: extractValue(properties, 0, 'Menshan 30', 'Menshan 30ʺ'),
          valorTabelaMensham30: extractValue(properties, 0, 'Valor Mershan 30 (Tabela)', 'Valor Mershan 30ʺ (Tabela)', 'Valor Mensham 30 (Tabela)', 'Valor Mensham 30ʺ (Tabela)', 'Mensham 30 Tabela'),
          valorNegociadoMensham30: extractValue(properties, 0, 'Valor Mershan 30 (Negociado)', 'Valor Mershan 30ʺ (Negociado)', 'Valor Mensham 30 (Negociado)', 'Valor Mensham 30ʺ (Negociado)', 'Mensham 30 Negociado'),
          
          // Menshan 60ʺ
          spotsMensham60: extractValue(properties, 0, 'Menshan 60', 'Menshan 60ʺ'),
          valorTabelaMensham60: extractValue(properties, 0, 'Valor Mershan 60 (Tabela)', 'Valor Mershan 60ʺ (Tabela)', 'Valor Mensham 60 (Tabela)', 'Valor Mensham 60ʺ (Tabela)', 'Mensham 60 Tabela'),
          valorNegociadoMensham60: extractValue(properties, 0, 'Valor Mershan 60 (Negociado)', 'Valor Mershan 60ʺ (Negociado)', 'Valor Mensham 60 (Negociado)', 'Valor Mensham 60ʺ (Negociado)', 'Mensham 60 Negociado'),
          
          // PATROCÍNIO - Inserções
          cotasMeses: extractValue(properties, 0, 'Cotas | Meses', 'Cotas/Meses', 'Cotas Meses'),
          ins5: extractValue(properties, 0, 'Ins 5ʺ', 'Ins 5"', 'Ins 5'),
          ins15: extractValue(properties, 0, 'Ins 15ʺ', 'Ins 15"', 'Ins 15'),
          ins30: extractValue(properties, 0, 'Ins 30ʺ', 'Ins 30"', 'Ins 30'),
          ins60: extractValue(properties, 0, 'Ins 60ʺ', 'Ins 60"', 'Ins 60'),
          valorTabelaCota: extractValue(properties, 0, 'Valor Tabela por Cota', 'Valor Tabela Cota'),
          valorNegociadoCota: extractValue(properties, 0, 'Valor Negociado por Cota', 'Valor Negociado Cota'),
          
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

      console.log(' Emissoras mapeadas:', emissoras);
      
      // Carregar estado de excluso do Notion
      const ocultasEmissoras = emissoras
        .filter(e => e.excluir === true)
        .map(e => e.id);
      
      // Detectar quais produtos estão disponíveis (têm dados em alguma emissora)
      const availableProducts = {
        midia: [],
        patrocinio: []
      };
      
      // Verifica Mídia Avulsa
      const mediaProducts = [
        { key: 'spots30', field: 'spots30', label: 'Spots 30"' },
        { key: 'spots60', field: 'spots60', label: 'Spots 60"' },
        { key: 'spotsBlitz', field: 'spotsBlitz', label: 'Blitz' },
        { key: 'spots15', field: 'spots15', label: 'Spots 15"' },
        { key: 'spots5', field: 'spots5', label: 'Spots 5"' },
        { key: 'spotsTest30', field: 'spotsTest30', label: 'Test 30"' },
        { key: 'spotsTest60', field: 'spotsTest60', label: 'Test 60"' },
        { key: 'spotsFlash30', field: 'spotsFlash30', label: 'Flash 30"' },
        { key: 'spotsFlash60', field: 'spotsFlash60', label: 'Flash 60"' },
        { key: 'spotsMensham30', field: 'spotsMensham30', label: 'Mensham 30"' },
        { key: 'spotsMensham60', field: 'spotsMensham60', label: 'Mensham 60"' }
      ];
      
      // Verifica Patrocínio
      const patrocinioProducts = [
        { key: 'ins5', field: 'ins5', label: 'Ins 5"' },
        { key: 'ins15', field: 'ins15', label: 'Ins 15"' },
        { key: 'ins30', field: 'ins30', label: 'Ins 30"' },
        { key: 'ins60', field: 'ins60', label: 'Ins 60"' }
      ];
      
      // Detectar produtos com dados
      for (const product of mediaProducts) {
        if (emissoras.some(e => e[product.field] > 0)) {
          availableProducts.midia.push(product);
        }
      }
      
      for (const product of patrocinioProducts) {
        if (emissoras.some(e => e[product.field] > 0)) {
          availableProducts.patrocinio.push(product);
        }
      }
      
      // Detectar se tem campo de Patrocínio (Cotas/Meses)
      const temPatrocinio = emissoras.some(e => e.cotasMeses > 0);
      const temMidia = emissoras.some(e => availableProducts.midia.length > 0);
      
      console.log('');
      console.log('');
      console.log(' PRODUTOS DISPONÍVEIS DETECTADOS:');
      console.log(`   Mídia Avulsa: ${availableProducts.midia.map(p => p.label).join(', ') || 'nenhum'}`);
      console.log(`   Patrocínio: ${availableProducts.patrocinio.map(p => p.label).join(', ') || 'nenhum'}`);
      console.log('');

      // Buscar nome da proposta
      let proposalName = 'Proposta';
      try {
        proposalName = await getProposalName(notionToken, id);
        console.log(`✅ Nome da proposta obtido: "${proposalName}"`);
      } catch (error) {
        console.error('⚠️ Falha ao obter nome da proposta, usando padrão:', error.message);
        proposalName = 'Proposta';
      }
      
      return new Response(JSON.stringify({
        emissoras: emissoras,
        ocultasEmissoras: ocultasEmissoras,
        proposalName: proposalName,
        availableProducts: availableProducts,
        temMidia: temMidia,
        temPatrocinio: temPatrocinio
      }), {
        status: 200,
        headers
      });
    }

    // MTODO PATCH - ATUALIZAR MLTIPLAS EMISSORAS
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
          error: 'ID da tabela obrigatrio' 
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
          error: 'Body invlido' 
        }), {
          status: 400,
          headers
        });
      }

      log(' Atualizando mltiplas emissoras');
      log(' Dados recebidos: ' + JSON.stringify(requestBody));

      const { emissoras, changes, ocultasEmissoras } = requestBody;
      log(' ocultasEmissoras recebido: ' + JSON.stringify(ocultasEmissoras));
      
      if (!emissoras || !Array.isArray(emissoras)) {
        return new Response(JSON.stringify({ 
          error: 'Emissoras deve ser um array' 
        }), {
          status: 400,
          headers
        });
      }

      // Array para guardar resultados das atualizações
      const updatePromises = [];

      // Sincronizar o status "Excluir" com Notion
      if (ocultasEmissoras && Array.isArray(ocultasEmissoras)) {
        log(` Sincronizando status "Excluir" para ${ocultasEmissoras.length} emissoras`);
        
        for (const emissora of emissoras) {
          const isExcluida = ocultasEmissoras.includes(emissora.id);
          const wasPreviouslyExcluida = emissora.excluir || false;
          
          // Só atualizar se houve mudança no status
          if (isExcluida !== wasPreviouslyExcluida) {
            log(`   Atualizando ${emissora.emissora}: Excluir = ${isExcluida}`);
            
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
              log(`     Excluir atualizado para ${isExcluida}`);
            } else {
              const error = await excludeResponse.json();
              log(`     Erro ao atualizar Excluir: ${JSON.stringify(error)}`);
              console.error(`     Erro completo:`, error);
              
              //  IMPORTANTE: Rastrear falha de atualizao de excluso
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

      // Processar cada alteração
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
          'spotsTest30': 'Test. 30ʺ',
          'valorTabelaTest30': 'Valor test. 30ʺ (Tabela)',
          'valorNegociadoTest30': 'Valor test. 30ʺ (Negociado)',
          'spotsTest60': 'Test. 60ʺ',
          'valorTabelaTest60': 'Valor test. 60ʺ (Tabela)',
          'valorNegociadoTest60': 'Valor test. 60ʺ (Negociado)',
          'spotsFlash30': 'Flash 30ʺ',
          'valorTabelaFlash30': 'Valor Flash 30ʺ (Tabela)',
          'valorNegociadoFlash30': 'Valor Flash 30ʺ (Negociado)',
          'spotsFlash60': 'Flash 60ʺ',
          'valorTabelaFlash60': 'Valor Flash 60ʺ (Tabela)',
          'valorNegociadoFlash60': 'Valor Flash 60ʺ (Negociado)',
          'spotsMensham30': 'Menshan 30ʺ',
          'valorTabelaMensham30': 'Valor Mershan 30ʺ (Tabela)',
          'valorNegociadoMensham30': 'Valor Mershan 30ʺ (Negociado)',
          'spotsMensham60': 'Menshan 60ʺ',
          'valorTabelaMensham60': 'Valor Mershan 60ʺ (Tabela)',
          'valorNegociadoMensham60': 'Valor Mershan 60ʺ (Negociado)'
        };

        const notionField = fieldMap[change.field];
        if (!notionField) {
          console.error(` Campo no mapeado: ${change.field}`);
          continue;
        }

        console.log(` Atualizando ${emissora.emissora} - Campo: "${notionField}" = ${change.new}`);

        const updateProperties = {};
        updateProperties[notionField] = { number: parseFloat(change.new) || 0 };

        const bodyToSend = JSON.stringify({ properties: updateProperties });
        console.log(` FIELD NAME (chave):`, notionField);
        console.log(` FIELD NAME (type):`, typeof notionField);
        console.log(` BODY sendo enviado para Notion:`, bodyToSend);
        console.log(` updateProperties objeto:`, updateProperties);

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
          console.error(` Erro ao atualizar ${emissora.emissora} (${notionField}):`, updateResponse.status, updateData);
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
          console.log(` ${emissora.emissora} - ${notionField} atualizado com sucesso`);
          updatePromises.push({
            field: change.field,
            notionField: notionField,
            emissoraId: emissora.id,
            emissoraName: emissora.emissora,
            oldValue: change.old || change.oldValue || 'N/A',
            newValue: change.new || change.newValue || 'N/A',
            success: true
          });
        }
      }

      // Enviar email com as alterações
      let emailLogs = [];
      try {
        console.log('📧 [PATCH] Chamando sendNotificationEmail...');
        console.log('📧 [PATCH] updatePromises:', updatePromises.length, 'alterações');
        console.log('📧 [PATCH] requestBody.editorEmail:', requestBody.editorEmail);
        console.log('📧 [PATCH] editorEmail final:', requestBody.editorEmail || 'desconhecido@email.com');
        
        // Buscar nome da proposta
        let proposalName = 'Proposta';
        try {
          proposalName = await getProposalName(notionToken, tableId);
        } catch (e) {
          console.warn('⚠️ Não conseguiu buscar nome da proposta:', e.message);
        }
        
        const emailPayload = {
          tableId: tableId,
          proposalName: proposalName,
          changes: updatePromises,
          emissoras: emissoras,
          requestIP: request.headers.get('cf-connecting-ip') || 'desconhecido',
          editorEmail: requestBody.editorEmail || 'desconhecido@email.com'
        };
        
        console.log('📧 [PATCH] Payload enviado para sendNotificationEmail:', JSON.stringify(emailPayload));
        
        emailLogs = await sendNotificationEmail(env, emailPayload);
        console.log('📧 [PATCH] sendNotificationEmail completado');
        console.log('📧 [PATCH] emailLogs retornado:', emailLogs);
        debugLogs.push(...emailLogs);
      } catch (emailError) {
        console.error('⚠️ [PATCH] Erro ao enviar email:', emailError.message);
        console.error('⚠️ [PATCH] Stack:', emailError.stack);
        log('⚠️ Erro ao enviar email: ' + emailError.message);
        debugLogs.push('⚠️ Erro ao enviar email: ' + emailError.message);
        debugLogs.push('⚠️ Stack completo: ' + emailError.stack);
        // Não interrompe o fluxo se falhar o email
      }

      console.log(' Retornando resposta com debugLogs:', debugLogs.length, 'mensagens');
      
      const failedUpdates = updatePromises.filter(p => !p.success).length;
      const hasFailed = failedUpdates > 0;
      
      //  IMPORTANTE: Se houver qualquer falha, retornar sucesso falso
      // Isso garante que o frontend saiba que algo no funcionou
      const responseData = { 
        success: !hasFailed,  //  Retorna false se houver falhas
        message: hasFailed ? 'Algumas alteraes falharam' : 'Alteraes processadas com sucesso',
        totalChanges: Object.keys(changes).length,
        successfulUpdates: updatePromises.filter(p => p.success).length,
        failedUpdates: failedUpdates,
        details: updatePromises,
        debugLogs: debugLogs
      };
      
      console.log(' Response data:', responseData);
      
      return new Response(JSON.stringify(responseData), {
        status: hasFailed ? 400 : 200,  //  Retorna 400 se houver falhas
        headers
      });
    }

    // Mtodo no suportado
    return new Response(JSON.stringify({  
      error: 'Mtodo no permitido' 
    }), {
      status: 405,
      headers
    });

  } catch (error) {
    console.error(' Erro:', error);
    
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
// =====================================================
// FUNÇÃO DE EXTRAÇÃO DO NOME DA PROPOSTA
// =====================================================

async function getProposalName(notionToken, databaseId) {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 🔍 BUSCANDO NOME DA PROPOSTA');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`📍 Database ID: ${databaseId}`);
    
    // Passo 1: Buscar metadados da database
    console.log('\n📍 PASSO 1: Buscando database...');
    const dbResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!dbResponse.ok) {
      const errorData = await dbResponse.json().catch(() => ({}));
      console.error('❌ Erro ao buscar database:', errorData);
      throw new Error(`Erro ao buscar database (${dbResponse.status})`);
    }

    const dbData = await dbResponse.json();
    console.log('✅ Database encontrada!');
    console.log(`   - Database ID: ${dbData.id}`);
    console.log(`   - Database Title: ${JSON.stringify(dbData.title)}`);
    console.log(`   - Parent Type: ${dbData.parent?.type || 'nenhum'}`);
    console.log(`   - Parent Page ID: ${dbData.parent?.page_id || 'nenhum'}`);
    console.log(`   - Parent Database ID: ${dbData.parent?.database_id || 'nenhum'}`);
    
    // Passo 2: Se há parent_id, buscar a página pai
    let parentPageId = dbData.parent?.page_id;
    
    if (!parentPageId) {
      console.log('⚠️ Nenhum parent.page_id encontrado na database');
      console.log('   Tentando usar database_id do parent...');
      parentPageId = dbData.parent?.database_id;
    }
    
    if (!parentPageId) {
      console.log('❌ Nenhum parent encontrado. Usando nome da database.');
      if (dbData.title && dbData.title.length > 0) {
        const proposalName = dbData.title[0].text.content;
        console.log(`✅ Nome da database: "${proposalName}"`);
        return proposalName;
      }
      return 'Proposta';
    }
    
    // Passo 3: Buscar a página pai
    console.log(`\n📍 PASSO 2: Buscando página pai (ID: ${parentPageId})...`);
    const parentResponse = await fetch(`https://api.notion.com/v1/pages/${parentPageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!parentResponse.ok) {
      const errorData = await parentResponse.json().catch(() => ({}));
      console.error('❌ Erro ao buscar página pai:', errorData);
      throw new Error(`Erro ao buscar página pai (${parentResponse.status})`);
    }

    const parentData = await parentResponse.json();
    console.log('✅ Página pai encontrada!');
    console.log(`   - Page ID: ${parentData.id}`);
    console.log(`   - Properties: ${JSON.stringify(Object.keys(parentData.properties || {}))}`);
    
    // Passo 4: Extrair o título da página pai
    let proposalName = null;
    
    // Procurar pela propriedade "title" (mais comum)
    if (parentData.properties?.title) {
      const titleProp = parentData.properties.title;
      console.log(`\n📋 Propriedade 'title' encontrada:`);
      console.log(`   - Tipo: ${titleProp.type}`);
      console.log(`   - Conteúdo: ${JSON.stringify(titleProp.title)}`);
      
      if (titleProp.title && titleProp.title.length > 0) {
        proposalName = titleProp.title[0].text.content;
        console.log(`✅ NOME EXTRAÍDO: "${proposalName}"`);
        return proposalName;
      }
    }
    
    // Se não tem "title", procurar por "Name" (alternativa comum)
    if (!proposalName && parentData.properties?.Name) {
      const nameProp = parentData.properties.Name;
      console.log(`\n📋 Propriedade 'Name' encontrada:`);
      console.log(`   - Tipo: ${nameProp.type}`);
      console.log(`   - Conteúdo: ${JSON.stringify(nameProp.title)}`);
      
      if (nameProp.title && nameProp.title.length > 0) {
        proposalName = nameProp.title[0].text.content;
        console.log(`✅ NOME EXTRAÍDO: "${proposalName}"`);
        return proposalName;
      }
    }
    
    // Se ainda não achou, listar todas as propriedades para debug
    if (!proposalName) {
      console.log('\n⚠️ Nenhuma propriedade "title" ou "Name" encontrada');
      console.log('📋 Propriedades disponíveis na página pai:');
      for (const [key, prop] of Object.entries(parentData.properties || {})) {
        console.log(`   - ${key}: ${prop.type}`);
        if (prop.type === 'title' && prop.title?.length > 0) {
          proposalName = prop.title[0].text.content;
          console.log(`     ✅ ENCONTRADO TÍTULO: "${proposalName}"`);
          break;
        }
      }
    }
    
    if (!proposalName) {
      console.log('⚠️ Não conseguiu extrair nome da página pai, usando padrão');
      proposalName = 'Proposta';
    }
    
    console.log(`\n✅ NOME FINAL DA PROPOSTA: "${proposalName}"`);
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    return proposalName;
    
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════════╗');
    console.error('║ ❌ ERRO CRÍTICO ao buscar nome da proposta');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error(`   Mensagem: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.error('');
    throw error;
  }
}

// =====================================================
// FUNÇÃO DE ENVIO DE EMAIL
// =====================================================

async function sendNotificationEmail(env, data) {
  const emailLogs = [];
  
  // Validação defensiva
  if (!data || typeof data !== 'object') {
    emailLogs.push('❌ [EMAIL] ERRO: data inválida ou undefined!');
    emailLogs.push('❌ [EMAIL] data type: ' + typeof data);
    emailLogs.push('❌ [EMAIL] data value: ' + JSON.stringify(data));
    console.error('❌ [EMAIL] ERRO: data inválida ou undefined!', data);
    return emailLogs;
  }
  
  const { tableId, proposalName, changes, emissoras, requestIP, editorEmail } = data;
  const resendApiKey = env.RESEND_API_KEY;
  
  emailLogs.push('📧 [EMAIL] ===== INICIANDO ENVIO DE EMAIL =====');
  emailLogs.push('📧 [EMAIL] Proposta: ' + proposalName);
  emailLogs.push('📧 [EMAIL] Editor: ' + (editorEmail || 'desconhecido'));
  emailLogs.push('📧 [EMAIL] RESEND_API_KEY existe? ' + (!!resendApiKey));
  if (resendApiKey) {
    emailLogs.push('📧 [EMAIL] RESEND_API_KEY primeiros 10 chars: ' + resendApiKey.substring(0, 10));
  }
  emailLogs.push('📧 [EMAIL] Alterações recebidas: ' + changes.length);
  emailLogs.push('📧 [EMAIL] Emissoras: ' + emissoras.length);
  
  console.log('📧 [EMAIL] ===== INICIANDO ENVIO DE EMAIL =====');
  console.log('📧 [EMAIL] Proposta:', proposalName);
  console.log('📧 [EMAIL] Editor:', editorEmail || 'desconhecido');
  console.log('📧 [EMAIL] RESEND_API_KEY existe?', !!resendApiKey);
  console.log('📧 [EMAIL] Alterações recebidas:', changes.length);
  console.log('📧 [EMAIL] Emissoras:', emissoras.length);
  
  if (!resendApiKey) {
    emailLogs.push('❌ [EMAIL] RESEND_API_KEY NÃO CONFIGURADA! Email NÃO será enviado.');
    console.error('❌ [EMAIL] RESEND_API_KEY NÃO CONFIGURADA!');
    return emailLogs;
  }

  // Agrupar alteraes por emissora
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
      <title>Alterao de Proposta</title>
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
          <h1> Alteração de Proposta</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Proposta: <strong>${proposalName}</strong></p>
          <p style="margin: 8px 0 0 0; opacity: 0.8; font-size: 13px;">E-MDIAS | Sistema de Gestão de Propostas</p>
        </div>
        
        <div class="content">
          <p>Olá,</p>
          <p>A proposta <strong>"${proposalName}"</strong> foi alterada no sistema E-MDIAS. Confira os detalhes abaixo:</p>
          
          <div class="info-box">
            <strong>📧 Alterado por:</strong> ${editorEmail || 'Desconhecido'}<br>
            <strong>📅 Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}<br>
            <strong>🌐 IP do Responsável:</strong> ${requestIP}
          </div>
  `;

  // Adicionar alteraes por emissora
  for (const emissoraIndex in changesByEmissora) {
    const emissora = emissoras[emissoraIndex];
    const emissoras_changes = changesByEmissora[emissoraIndex];
    
    emailHTML += `
      <div class="change-group">
        <h3> ${emissora.emissora}</h3>
    `;
    
    emissoras_changes.forEach(change => {
      emailHTML += `
        <div class="change-item">
          <strong>${change.notionField}:</strong> 
          <span class="old-value">${change.oldValue || change.old}</span> 
           
          <span class="new-value">${change.newValue || change.new}</span>
        </div>
      `;
    });
    
    emailHTML += '</div>';
  }

  // Link da proposta
  emailHTML += `
          <div class="info-box">
            <strong> Link da Proposta:</strong><br>
            <a href="https://alteracaoproposta.pages.dev/?id=${tableId}" class="link">Abrir Proposta no E-MDIAS</a>
          </div>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            Este  um email automtico. No responda este message.
          </p>
        </div>
        
        <div class="footer">
          <p> 2025 HUB RDIOS - E-MDIAS. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Enviar via Resend
  try {
    emailLogs.push('📧 [EMAIL] Enviando para: tatico5@hubradios.com');
    emailLogs.push('📧 [EMAIL] De: onboarding@resend.dev (Email de teste)');
    emailLogs.push('📧 [EMAIL] Endpoint: https://api.resend.com/emails');
    console.log('📧 [EMAIL] Enviando para: tatico5@hubradios.com');
    console.log('📧 [EMAIL] De: onboarding@resend.dev (Email de teste)');
    console.log('📧 [EMAIL] Endpoint: https://api.resend.com/emails');
    console.log('📧 [EMAIL] Headers:', {
      'Authorization': `Bearer ${resendApiKey.substring(0, 10)}***`,
      'Content-Type': 'application/json'
    });
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'tatico5@hubradios.com',
        subject: `[E-MDIAS] Alteração de Proposta - ${new Date().toLocaleDateString('pt-BR')}`,
        html: emailHTML
      })
    });

    const statusMsg = '📧 [EMAIL] Status da resposta: ' + response.status;
    emailLogs.push(statusMsg);
    console.log(statusMsg);
    
    if (response.ok) {
      const result = await response.json();
      const successMsg = '✅ [EMAIL] Email enviado com sucesso! ID: ' + result.id;
      emailLogs.push(successMsg);
      console.log(successMsg);
    } else {
      const errorText = await response.text();
      const errorMsg = '❌ [EMAIL] Erro ao enviar email via Resend. Status: ' + response.status + ', Resposta: ' + errorText;
      emailLogs.push(errorMsg);
      console.error(errorMsg);
      
      // Mensagem específica para erro 403 (domínio não verificado)
      if (response.status === 403) {
        const domainMsg = '⚠️ [EMAIL] Erro 403: O domínio hubradios.com não está verificado no Resend. Acesse https://resend.com/domains para verificar o domínio.';
        emailLogs.push(domainMsg);
        console.warn(domainMsg);
      }
      
      try {
        const errorJson = JSON.parse(errorText);
        emailLogs.push('📧 [EMAIL] Erro detalhado: ' + JSON.stringify(errorJson));
        console.error('📧 [EMAIL] Erro detalhado:', errorJson);
      } catch (e) {
        // erro não é JSON, mantém como texto
      }
    }
  } catch (error) {
    const errorMsg = '❌ [EMAIL] Erro na requisição Resend: ' + error.message;
    emailLogs.push(errorMsg);
    console.error(errorMsg);
    console.error('Erro completo:', error);
    console.error(errorMsg);
  }
  
  return emailLogs;
}

function findEmissoraIndexById(id, emissoras) {
  return emissoras.findIndex(e => e.id === id);
}

// =====================================================
// NOTA: Todas as funes de "Lista de alternantes" 
// foram removidas em favor de um filtro cliente simples
// (getAlternantesEmissoraIds, getOrCreateAlternantesDatabase,
//  createAlternantesDatabase, moveToAlternantes, removeFromAlternantes)
// =====================================================





