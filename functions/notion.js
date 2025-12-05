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
    // ===== BUSCAR TOKEN DE AUTENTICAÇÃO =====
    const notionToken = env.NOTION_TOKEN;

    if (!notionToken) {
      return new Response(JSON.stringify({
        error: 'Token de autenticação não configurado'
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
        
        if (!id || id.trim() === '') {
        return new Response(JSON.stringify({ 
          error: 'ID da tabela é obrigatório'
        }), {
          status: 400,
          headers
        });
      }

      // API espera ID sem hífens
      id = id.replace(/-/g, '');

      // Buscar linhas da database usando query
      const response = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken.trim()}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        let errorDetails = response.statusText;
        let errorBody = {};
        
        try {
          errorBody = await response.json();
          errorDetails = JSON.stringify(errorBody, null, 2);
        } catch (e) {
          try {
            errorDetails = await response.text();
          } catch (e2) {
            errorDetails = 'Erro desconhecido';
          }
        }
        
        return new Response(JSON.stringify({ 
          error: `Erro ao buscar tabela: ${response.status}`
        }), {
          status: response.status,
          headers
        });
      }

      const notionData = await response.json();
      
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
        const fieldNames = Object.keys(firstRecord.properties).sort();
        allFields = fieldNames.map(fieldName => ({
          name: fieldName,
          type: firstRecord.properties[fieldName].type
        }));
        
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
      }
      
      if (!notionData.results || notionData.results.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'Database vazia'
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
              
              if (propName.includes('Negociado') && !keyLower.includes('negociado')) {
                continue;
              }
              if (propName.includes('Tabela') && !keyLower.includes('tabela')) {
                continue;
              }
              
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
                continue;
              }
              
              const prop = properties[key];
              
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
        
        return defaultValue;
      };

      // Mapear registros da tabela (otimizado - debug apenas se necessário)
      const emissoras = notionData.results.map((row, rowIndex) => {
        const properties = row.properties || {};
        
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
          })(),
          
          // PMM (Pessoas Muito Mais / Público-alvo) - Para cálculo de impactos
          PMM: extractValue(properties, 0, 'PMM', 'PMM', 'Pmm', 'PMM Valor', 'PMM (Público)')
        };
      });

      // Carregar estado de exclusão da base de dados
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

      // Buscar nome da proposta e parent page ID
      let proposalName = 'Proposta';
      let parentPageId = null;
      try {
        const proposalInfo = await getProposalInfo(notionToken, id);
        proposalName = proposalInfo.proposalName;
        parentPageId = proposalInfo.parentPageId;
      } catch (error) {
        proposalName = 'Proposta';
        parentPageId = null;
      }

      return new Response(JSON.stringify({
        emissoras: emissoras,
        ocultasEmissoras: ocultasEmissoras,
        proposalName: proposalName,
        parentPageId: parentPageId,
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

      // Sincronizar o status "Excluir" com base de dados
      const emissoras_changes = [];  // Rastrear mudanças de inclusão/exclusão
      if (ocultasEmissoras && Array.isArray(ocultasEmissoras)) {
        log(` Sincronizando status "Excluir" para ${ocultasEmissoras.length} emissoras`);
        
        for (const emissora of emissoras) {
          const isExcluida = ocultasEmissoras.includes(emissora.id);
          const wasPreviouslyExcluida = emissora.excluir || false;
          
          // Só atualizar se houve mudança no status
          if (isExcluida !== wasPreviouslyExcluida) {
            log(`   Atualizando ${emissora.emissora}: Excluir = ${isExcluida}`);
            
            // Rastrear mudança de inclusão/exclusão
            emissoras_changes.push({
              field: 'Excluir',
              notionField: 'Excluir',
              emissoraId: emissora.id,
              emissoraName: emissora.emissora,
              oldValue: wasPreviouslyExcluida ? 'Excluída' : 'Ativa',
              newValue: isExcluida ? 'Excluída' : 'Ativa',
              success: true,
              isExclusionChange: true
            });
            
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
              // O tracking já foi feito acima
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

        // Mapear campo para nome da base de dados
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

        // Atualizando campo na base de dados

        const updateProperties = {};
        updateProperties[notionField] = { number: parseFloat(change.new) || 0 };

        const bodyToSend = JSON.stringify({ properties: updateProperties });

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
          console.error(` Erro ao atualizar ${emissora.emissora} (${notionField}):`, updateResponse.status);
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
            success: true,
            isExclusionChange: false
          });
        }
      }

      // Enviar email com as alterações
      let emailLogs = [];
      try {
        // Buscar nome da proposta
        let proposalName = 'Proposta';
        try {
          const proposalInfo = await getProposalInfo(notionToken, tableId);
          proposalName = proposalInfo.proposalName;
        } catch (e) {
          console.warn('⚠️ Não conseguiu buscar nome da proposta:', e.message);
        }

        const emailPayload = {
          tableId: tableId,
          proposalName: proposalName,
          changes: updatePromises,
          emissoras_changes: emissoras_changes,
          emissoras: emissoras,
          requestIP: request.headers.get('cf-connecting-ip') || 'desconhecido',
          editorEmail: requestBody.editorEmail || 'desconhecido@email.com'
        };

        emailLogs = await sendNotificationEmail(env, emailPayload);
        debugLogs.push(...emailLogs);
      } catch (emailError) {
        console.error('⚠️ [PATCH] Erro ao enviar email:', emailError.message);
        log('⚠️ Erro ao enviar email: ' + emailError.message);
        debugLogs.push('⚠️ Erro ao enviar email: ' + emailError.message);
        // Não interrompe o fluxo se falhar o email
      }
      
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
// FUNÇÃO DE EXTRAÇÃO DO NOME DA PROPOSTA E PARENT PAGE ID
// =====================================================

async function getProposalInfo(notionToken, databaseId) {
  try {
    // Buscar metadados da database
    const dbResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!dbResponse.ok) {
      throw new Error(`Erro ao buscar database (${dbResponse.status})`);
    }

    const dbData = await dbResponse.json();

    // Buscar parent page ID
    let parentPageId = dbData.parent?.page_id || dbData.parent?.database_id;

    if (!parentPageId) {
      if (dbData.title && dbData.title.length > 0) {
        return {
          proposalName: dbData.title[0].text.content,
          parentPageId: null
        };
      }
      return {
        proposalName: 'Proposta',
        parentPageId: null
      };
    }

    // Buscar a página pai
    const parentResponse = await fetch(`https://api.notion.com/v1/pages/${parentPageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken.trim()}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!parentResponse.ok) {
      throw new Error(`Erro ao buscar página pai (${parentResponse.status})`);
    }

    const parentData = await parentResponse.json();

    // Extrair o título da página pai
    let proposalName = null;

    // Procurar pela propriedade "title"
    if (parentData.properties?.title?.title?.[0]?.text?.content) {
      proposalName = parentData.properties.title.title[0].text.content;
    }

    // Procurar por "Name"
    if (!proposalName && parentData.properties?.Name?.title?.[0]?.text?.content) {
      proposalName = parentData.properties.Name.title[0].text.content;
    }

    // Buscar em todas as propriedades do tipo title
    if (!proposalName) {
      for (const [key, prop] of Object.entries(parentData.properties || {})) {
        if (prop.type === 'title' && prop.title?.length > 0) {
          proposalName = prop.title[0].text.content;
          break;
        }
      }
    }

    return {
      proposalName: proposalName || 'Proposta',
      parentPageId: parentPageId
    };

  } catch (error) {
    console.error('Erro ao buscar informações da proposta:', error.message);
    throw error;
  }
}

// =====================================================
// FUNÇÕES DE AUTENTICAÇÃO GMAIL API
// =====================================================

// Função auxiliar para extrair a chave privada
function extractPrivateKey(privateKeyData) {
  // Se for um JSON, extrair o campo private_key
  if (privateKeyData.trim().startsWith('{')) {
    try {
      const jsonData = JSON.parse(privateKeyData);
      if (jsonData.private_key) {
        return jsonData.private_key;
      }
    } catch (e) {
      // Não é um JSON válido, continuar com o valor original
    }
  }
  // Retornar o valor original (já é a chave privada)
  return privateKeyData;
}

// Função para criar JWT token
async function createJWT(serviceAccountEmail, privateKey, scope, userToImpersonate) {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    sub: userToImpersonate,   // ← ESSENCIAL
    scope: scope,             // ← agora pode ter múltiplos escopos
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };


  // Encode header e payload em base64url
  const base64UrlEncode = (obj) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Importar chave privada para assinatura
  const pemKey = privateKey.replace(/\\n/g, '\n');
  const keyData = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Assinar o JWT
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  // Converter signature para base64url
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  const signatureBase64Url = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${signatureInput}.${signatureBase64Url}`;
}

// Função para obter access token do Google
async function getGoogleAccessToken(serviceAccountEmail, privateKey) {

  const scope =
    "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify";

  const jwt = await createJWT(
    serviceAccountEmail,
    privateKey,
    scope,
    "kaike@hubradios.com"  // ← aqui entra o impersonation
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao obter access token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// =====================================================
// FUNÇÃO DE ENVIO DE EMAIL VIA GMAIL API
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

  const { tableId, proposalName, changes, emissoras_changes, emissoras, requestIP, editorEmail } = data;

  // Configurações Gmail API
  const gmailClientEmail = env.GMAIL_CLIENT_EMAIL;
  let gmailPrivateKey = env.GMAIL_PRIVATE_KEY;

  emailLogs.push('📧 [EMAIL] ===== INICIANDO ENVIO DE EMAIL VIA GMAIL API =====');
  emailLogs.push('📧 [EMAIL] Proposta: ' + proposalName);
  emailLogs.push('📧 [EMAIL] Editor: ' + (editorEmail || 'desconhecido'));
  emailLogs.push('📧 [EMAIL] Alterações recebidas: ' + changes.length);
  emailLogs.push('📧 [EMAIL] Emissoras: ' + emissoras.length);
  emailLogs.push('📧 [EMAIL] Service Account: ' + (gmailClientEmail || 'NÃO CONFIGURADO'));

  if (!gmailClientEmail || !gmailPrivateKey) {
    emailLogs.push('❌ [EMAIL] Credenciais do Gmail não configuradas! Email NÃO será enviado.');
    emailLogs.push('❌ [EMAIL] GMAIL_CLIENT_EMAIL existe: ' + !!gmailClientEmail);
    emailLogs.push('❌ [EMAIL] GMAIL_PRIVATE_KEY existe: ' + !!gmailPrivateKey);
    return emailLogs;
  }

  // Extrair chave privada (suporta JSON ou chave direta)
  try {
    gmailPrivateKey = extractPrivateKey(gmailPrivateKey);
    emailLogs.push('📧 [EMAIL] Chave privada extraída com sucesso');
  } catch (error) {
    emailLogs.push('❌ [EMAIL] Erro ao processar chave privada: ' + error.message);
    return emailLogs;
  }

  // Agrupar alteraes por emissora
  const changesByEmissora = {};
  const exclusionChanges = [];  // Rastrear exclusões/inclusões separadamente
  
  changes.forEach(change => {
    if (change.success) {
      if (change.isExclusionChange) {
        // Rastrear mudanças de exclusão/inclusão separadamente
        exclusionChanges.push(change);
      } else {
        // Agrupar alterações normais por emissora
        const emissoraIndex = findEmissoraIndexById(change.emissoraId, emissoras);
        if (emissoraIndex !== -1) {
          if (!changesByEmissora[emissoraIndex]) {
            changesByEmissora[emissoraIndex] = [];
          }
          changesByEmissora[emissoraIndex].push(change);
        }
      }
    }
  });
  
  // Adicionar exclusões/inclusões do payload também
  if (emissoras_changes && Array.isArray(emissoras_changes)) {
    emissoras_changes.forEach(change => {
      if (change.success) {
        exclusionChanges.push(change);
      }
    });
  }

  // Construir URL da proposta
  const proposalUrl = `https://19f04e2d.alteracaoproposta1.pages.dev/?id=${tableId}`;

  // Gerar HTML do email
  let emailHTML = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Alteração de Proposta - E-Mídias</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
          background-color: #f5f7fa;
          color: #333;
          line-height: 1.6;
          padding: 20px 0;
        }

        .email-container {
          max-width: 700px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }

        .logo-section {
          background-color: #ffffff;
          padding: 30px 40px 20px 40px;
          text-align: center;
        }

        .logo-img {
          max-width: 150px;
          height: auto;
        }

        .header {
          background: linear-gradient(135deg, #06055b 0%, #1a0f4f 100%);
          color: white;
          padding: 20px 40px;
          text-align: center;
        }

        .header h1 {
          font-size: 24px;
          font-weight: 600;
        }

        .content {
          padding: 40px;
        }

        .section {
          margin-bottom: 35px;
        }

        .section-title {
          display: flex;
          align-items: center;
          font-size: 18px;
          color: #06055b;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f0f4ff;
          font-weight: 600;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .info-card {
          background-color: #f8faff;
          border-radius: 10px;
          padding: 20px;
          border-left: 4px solid #06055b;
        }

        .info-card h3 {
          color: #06055b;
          font-size: 14px;
          margin-bottom: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-card p {
          color: #333;
          font-size: 16px;
          font-weight: 600;
          word-break: break-word;
        }

        .info-card a {
          color: #06055b;
          text-decoration: none;
          transition: color 0.3s ease;
        }

        .info-card a:hover {
          color: #1a0f4f;
          text-decoration: underline;
        }

        .changes-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .changes-table thead {
          background: linear-gradient(135deg, #06055b 0%, #1a0f4f 100%);
          color: white;
        }

        .changes-table th {
          padding: 15px;
          text-align: left;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .changes-table td {
          padding: 15px;
          border-bottom: 1px solid #eee;
          font-size: 14px;
        }

        .changes-table tbody tr:hover {
          background-color: #f8faff;
        }

        .changes-table tbody tr:last-child td {
          border-bottom: none;
        }

        .emissora-name {
          font-weight: 700;
          color: #06055b;
          font-size: 15px;
        }

        .field-name {
          color: #666;
          font-weight: 500;
        }

        .value-change {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .old-value {
          background-color: #ffeaea;
          color: #ff4757;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 700;
          text-decoration: line-through;
        }

        .new-value {
          background-color: #e8f7ef;
          color: #2ed573;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 700;
        }

        .arrow {
          color: #06055b;
          font-weight: bold;
        }

        .status-change {
          background-color: #f8faff;
          border-radius: 10px;
          padding: 20px;
          margin-top: 15px;
          border-left: 4px solid #FF1493;
        }

        .status-change h3 {
          color: #06055b;
          margin-bottom: 15px;
          font-size: 16px;
          font-weight: 600;
        }

        .status-item {
          padding: 12px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .status-item:last-child {
          border-bottom: none;
        }

        .status-active {
          color: #2ed573;
          font-weight: 700;
        }

        .status-excluded {
          color: #ff4757;
          font-weight: 700;
        }

        .footer {
          background-color: #f8faff;
          padding: 25px 40px;
          text-align: center;
          color: #666;
          font-size: 14px;
          border-top: 1px solid #eaeaea;
        }

        .footer p {
          margin: 5px 0;
        }

        .security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 15px;
          color: #777;
          font-size: 13px;
        }

        .security-icon {
          color: #2ed573;
          margin-right: 8px;
        }

        @media (max-width: 600px) {
          .header, .content, .footer {
            padding: 25px 20px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .changes-table {
            font-size: 12px;
          }

          .changes-table th,
          .changes-table td {
            padding: 10px 8px;
          }

          .value-change {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }

          .notification-badge {
            top: 15px;
            right: 15px;
            font-size: 10px;
            padding: 4px 8px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="logo-section">
          <img src="https://emidiastec.com.br/wp-content/smush-avif/2025/03/logo-E-MIDIAS-png-fundo-escuro-HORIZONTAL.png.avif" alt="E-MÍDIAS" class="logo-img">
        </div>

        <div class="header">
          <h1>Alteração de Proposta</h1>
        </div>

        <div class="content">
          <div class="section">
            <div class="section-title">DETALHES DA PROPOSTA</div>

            <div class="info-grid">
              <div class="info-card">
                <h3>Nome da Proposta</h3>
                <p><a href="${proposalUrl}" target="_blank">${proposalName}</a></p>
              </div>

              <div class="info-card">
                <h3>Alterado por</h3>
                <p>${editorEmail || 'Desconhecido'}</p>
              </div>

              <div class="info-card">
                <h3>Data/Hora</h3>
                <p>${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
              </div>

              <div class="info-card">
                <h3>Endereço IP</h3>
                <p style="font-size: 13px; word-break: break-all;">${requestIP}</p>
              </div>
            </div>
          </div>
  `;

  // Adicionar alterações de inclusão/exclusão de emissoras (se houver)
  if (exclusionChanges && exclusionChanges.length > 0) {
    emailHTML += `
          <div class="section">
            <div class="section-title">MUDANÇAS DE STATUS</div>
            <div class="status-change">
              <h3>Inclusão / Exclusão de Emissoras</h3>
    `;

    exclusionChanges.forEach(change => {
      const oldStatusClass = change.oldValue === 'Excluída' ? 'status-excluded' : 'status-active';
      const newStatusClass = change.newValue === 'Excluída' ? 'status-excluded' : 'status-active';
      emailHTML += `
              <div class="status-item">
                <strong>${change.emissoraName}</strong>:
                <span class="${oldStatusClass}">${change.oldValue}</span>
                <span class="arrow">→</span>
                <span class="${newStatusClass}">${change.newValue}</span>
              </div>
      `;
    });

    emailHTML += `
            </div>
          </div>
    `;
  }

  // Adicionar alterações por emissora em formato de tabela
  const hasChanges = Object.keys(changesByEmissora).length > 0;

  if (hasChanges) {
    emailHTML += `
          <div class="section">
            <div class="section-title">ALTERAÇÕES REALIZADAS</div>
            <table class="changes-table">
              <thead>
                <tr>
                  <th>Emissora</th>
                  <th>Campo Alterado</th>
                  <th>Valor Anterior → Novo</th>
                </tr>
              </thead>
              <tbody>
    `;

    for (const emissoraIndex in changesByEmissora) {
      const emissora = emissoras[emissoraIndex];
      const changes_by_emissora = changesByEmissora[emissoraIndex];

      changes_by_emissora.forEach((change, index) => {
        emailHTML += `
                <tr>
                  <td>${index === 0 ? '<span class="emissora-name">📻 ' + emissora.emissora + '</span>' : ''}</td>
                  <td><span class="field-name">${change.notionField}</span></td>
                  <td>
                    <div class="value-change">
                      <span class="old-value">${change.oldValue || change.old}</span>
                      <span class="arrow">→</span>
                      <span class="new-value">${change.newValue || change.new}</span>
                    </div>
                  </td>
                </tr>
        `;
      });
    }

    emailHTML += `
              </tbody>
            </table>
          </div>
    `;
  }

  // Fechar conteúdo
  emailHTML += `
        </div>

        <div class="footer">
          <p><strong>E-MÍDIAS | Sistema de Gestão de Propostas</strong></p>
          <p>Esta é uma notificação automática. Por favor, não responda a este e-mail.</p>

          <div class="security-note">
            <span class="security-icon">🔒</span>
            <span>Esta alteração foi registrada com data, hora e endereço IP para fins de auditoria.</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Enviar via Gmail API
  try {
    emailLogs.push('📧 [EMAIL] Obtendo access token do Google...');

    // Obter access token
    const accessToken = await getGoogleAccessToken(
      gmailClientEmail,
      gmailPrivateKey,
      'https://www.googleapis.com/auth/gmail.send'
    );

    emailLogs.push('✅ [EMAIL] Access token obtido com sucesso');
    emailLogs.push('📧 [EMAIL] Preparando email para envio...');

    // Destinatários fixos
    const recipients = ['kaike@hubradios.com', 'dani@hubradios.com'];
    const subjectText = `${proposalName} - Modificado`;

    // Encode subject em MIME para suportar caracteres especiais
    const encodeSubject = (text) => {
      const encoded = Buffer.from(text, 'utf8').toString('base64');
      return `=?UTF-8?B?${encoded}?=`;
    };

    const subject = encodeSubject(subjectText);

    // Criar mensagem RFC 2822
    const emailMessage = [
      `From: E-MÍDIAS <kaike@hubradios.com>`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      emailHTML
    ].join('\r\n');

    // Codificar mensagem em base64url
    const encodedMessage = btoa(unescape(encodeURIComponent(emailMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    emailLogs.push('📧 [EMAIL] Enviando email via Gmail API...');
    emailLogs.push('📧 [EMAIL] Remetente (impersonation): kaike@hubradios.com');
    emailLogs.push('📧 [EMAIL] Destinatários: ' + recipients.join(', '));

    // Enviar email via Gmail API usando impersonation
const response = await fetch(
  'https://gmail.googleapis.com/gmail/v1/users/kaike@hubradios.com/messages/send?alt=json',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodedMessage
    })
  }
);


    const statusMsg = '📧 [EMAIL] Status da resposta Gmail API: ' + response.status;
    emailLogs.push(statusMsg);
    console.log(statusMsg);

    if (response.ok) {
      const result = await response.json();
      const successMsg = '✅ [EMAIL] Email enviado com sucesso via Gmail API! ID: ' + result.id;
      emailLogs.push(successMsg);
      emailLogs.push('📧 [EMAIL] Thread ID: ' + result.threadId);
      console.log(successMsg);
    } else {
      const errorText = await response.text();
      const errorMsg = '❌ [EMAIL] Erro ao enviar email via Gmail API. Status: ' + response.status + ', Resposta: ' + errorText;
      emailLogs.push(errorMsg);
      console.error(errorMsg);

      try {
        const errorJson = JSON.parse(errorText);
        emailLogs.push('📧 [EMAIL] Erro detalhado: ' + JSON.stringify(errorJson));
        console.error('📧 [EMAIL] Erro detalhado:', errorJson);
      } catch (e) {
        // erro não é JSON, mantém como texto
      }
    }
  } catch (error) {
    const errorMsg = '❌ [EMAIL] Erro na requisição Gmail API: ' + error.message;
    emailLogs.push(errorMsg);
    emailLogs.push('❌ [EMAIL] Stack trace: ' + error.stack);
    console.error(errorMsg);
    console.error('Erro completo:', error);
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







