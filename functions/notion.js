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
  
  const { tableId, proposalName, changes, emissoras_changes, emissoras, requestIP, editorEmail } = data;
  const resendApiKey = env.RESEND_API_KEY;
  
  emailLogs.push('📧 [EMAIL] ===== INICIANDO ENVIO DE EMAIL =====');
  emailLogs.push('📧 [EMAIL] Proposta: ' + proposalName);
  emailLogs.push('📧 [EMAIL] Editor: ' + (editorEmail || 'desconhecido'));
  emailLogs.push('📧 [EMAIL] Alterações recebidas: ' + changes.length);
  emailLogs.push('📧 [EMAIL] Emissoras: ' + emissoras.length);
  
  if (!resendApiKey) {
    emailLogs.push('❌ [EMAIL] API key de email não configurada! Email NÃO será enviado.');
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
          <h1>🔔 Alteração de Proposta</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Proposta: <strong>${proposalName}</strong></p>
          <p style="margin: 8px 0 0 0; opacity: 0.8; font-size: 13px;">E-MÍDIAS | Sistema de Gestão de Propostas</p>
        </div>
        
        <div class="content">
          <p>Olá,</p>
          <p>A proposta <strong>"${proposalName}"</strong> foi alterada no sistema E-MÍDIAS. Confira os detalhes abaixo:</p>
          
          <div class="info-box">
            <strong>📧 Alterado por:</strong> ${editorEmail || 'Desconhecido'}<br>
            <strong>📅 Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}<br>
            <strong>🌐 IP do Responsável:</strong> ${requestIP}
          </div>
  `;

  // Adicionar alterações de inclusão/exclusão de emissoras (se houver)
  if (exclusionChanges && exclusionChanges.length > 0) {
    emailHTML += `
      <div class="change-group" style="border-left-color: #f59e0b; background: #fffbf0;">
        <h3 style="color: #f59e0b;">⚙️ Mudanças de Status (Inclusão/Exclusão)</h3>
    `;
    
    exclusionChanges.forEach(change => {
      const icon = change.newValue === 'Excluída' ? '❌' : '✅';
      emailHTML += `
        <div class="change-item">
          <strong>${icon} ${change.emissoraName}:</strong> 
          <span class="old-value">${change.oldValue}</span> 
          → 
          <span class="new-value">${change.newValue}</span>
        </div>
      `;
    });
    
    emailHTML += '</div>';
  }
  
  // Adicionar alteraes por emissora
  for (const emissoraIndex in changesByEmissora) {
    const emissora = emissoras[emissoraIndex];
    const changes_by_emissora = changesByEmissora[emissoraIndex];
    
    emailHTML += `
      <div class="change-group">
        <h3>📻 ${emissora.emissora}</h3>
    `;
    
    changes_by_emissora.forEach(change => {
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

  // Fechar conteúdo
  emailHTML += `
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
    emailLogs.push('📧 [EMAIL] Enviando notificação por email...');
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'tatico5@hubradios.com',
        subject: `[E-MÍDIAS] Alteração de Proposta - ${proposalName} - ${new Date().toLocaleDateString('pt-BR')}`,
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





