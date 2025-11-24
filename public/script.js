// =====================================================
// PROPOSTA DE MÍDIA - JavaScript (MÚLTIPLAS EMISSORAS)
// Build: 2025-11-19
// =====================================================

let proposalData = {
    tableId: null,
    emissoras: [],  // Array de emissoras
    changes: {},
    ocultasEmissoras: new Set(),  // Rastreia emissoras ocultas (por ID)
    initialOcultasEmissoras: new Set(),  // Estado inicial para detectar mudanças
    changedEmissoras: new Set(),  // Rastreia quais emissoras tiveram mudanças no status "Excluir"
    // Backup do último estado salvo com sucesso (para rollback em caso de erro)
    lastSuccessfulState: {
        ocultasEmissoras: new Set(),
        changes: {},
        emissoras: []
    }
};

// Flag para ignorar o próximo evento de checkbox (evita double trigger)
let ignoreNextCheckboxChange = false;


// Definição de todos os produtos disponíveis
const PRODUTOS = [
    { key: 'spots30', label: 'Spots 30"', tabelaKey: 'valorTabela30', negKey: 'valorNegociado30' },
    { key: 'spots60', label: 'Spots 60"', tabelaKey: 'valorTabela60', negKey: 'valorNegociado60' },
    { key: 'spotsBlitz', label: 'Blitz', tabelaKey: 'valorTabelaBlitz', negKey: 'valorNegociadoBlitz' },
    { key: 'spots15', label: 'Spots 15"', tabelaKey: 'valorTabela15', negKey: 'valorNegociado15' },
    { key: 'spots5', label: 'Spots 5"', tabelaKey: 'valorTabela5', negKey: 'valorNegociado5' },
    { key: 'spotsTest30', label: 'Test 30"', tabelaKey: 'valorTabelaTest30', negKey: 'valorNegociadoTest30' },
    { key: 'spotsTest60', label: 'Test 60"', tabelaKey: 'valorTabelaTest60', negKey: 'valorNegociadoTest60' },
    { key: 'spotsFlash30', label: 'Flash 30"', tabelaKey: 'valorTabelaFlash30', negKey: 'valorNegociadoFlash30' },
    { key: 'spotsFlash60', label: 'Flash 60"', tabelaKey: 'valorTabelaFlash60', negKey: 'valorNegociadoFlash60' },
    { key: 'spotsMensham30', label: 'Mensham 30"', tabelaKey: 'valorTabelaMensham30', negKey: 'valorNegociadoMensham30' },
    { key: 'spotsMensham60', label: 'Mensham 60"', tabelaKey: 'valorTabelaMensham60', negKey: 'valorNegociadoMensham60' }
];

let charts = {
    investment: null
};

// Função para extrair o link da logo (pode vir como string, array ou objeto)
function getLogoUrl(linkLogoField) {
    if (!linkLogoField) return null;
    
    // Se for string, retorna direto
    if (typeof linkLogoField === 'string' && linkLogoField.trim()) {
        return linkLogoField.trim();
    }
    
    // Se for array, pega o primeiro elemento
    if (Array.isArray(linkLogoField) && linkLogoField.length > 0) {
        const firstItem = linkLogoField[0];
        if (typeof firstItem === 'string') {
            return firstItem.trim();
        } else if (typeof firstItem === 'object' && firstItem.url) {
            return firstItem.url.trim();
        }
    }
    
    // Se for objeto com propriedade url
    if (typeof linkLogoField === 'object' && linkLogoField.url) {
        return linkLogoField.url.trim();
    }
    
    return null;
}

// =====================================================
// GERENCIAMENTO DE SALDO ANTERIOR (ÚLTIMA PROPOSTA SALVA)
// =====================================================

function getSaldoAnterior() {
    const saldoAnteriorStr = localStorage.getItem('saldoAnterior');
    if (saldoAnteriorStr) {
        try {
            return JSON.parse(saldoAnteriorStr);
        } catch (e) {
            console.error('Erro ao parsear saldoAnterior do localStorage:', e);
            return { negociado: 0, tabela: 0 };
        }
    }
    return { negociado: 0, tabela: 0 };
}

function setSaldoAnterior(negociado, tabela) {
    const saldoAnterior = {
        negociado: negociado,
        tabela: tabela,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('saldoAnterior', JSON.stringify(saldoAnterior));
    console.log('✅ Saldo anterior salvo:', saldoAnterior);
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔥 script.js CARREGADO!');
console.log('═══════════════════════════════════════════════════════════════');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('\n🎯 DOMContentLoaded DISPARADO!');
    console.log('🚀 Inicializando página de proposta...');
    
    try {
        const params = new URLSearchParams(window.location.search);
        proposalData.tableId = params.get('id');

        if (!proposalData.tableId) {
            showWelcomeMessage();
            throw new Error('Nenhuma tabela selecionada. Aguardando ID da tabela na URL.');
        }

        await loadProposalFromNotion(proposalData.tableId);
        renderInterface();
        console.log('✅ Página carregada com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
        showError(error.message);
    }
});

function showWelcomeMessage() {
    const container = document.querySelector('.container');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <h1 style="font-size: 2.5rem; color: #6366f1; margin-bottom: 20px;">
                    📋 E-MÍDIAS
                </h1>
                <p style="font-size: 1.1rem; color: #6b7280; margin-bottom: 30px;">
                    Plataforma de Gestão de Propostas Radiofônicas
                </p>
                <div style="background: #f3f4f6; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                    <p style="color: #374151; font-size: 1rem; line-height: 1.6; margin-bottom: 25px;">
                        ℹ️ Nenhuma proposta foi carregada.
                    </p>
                    <div style="background: white; padding: 20px; border-radius: 8px;">
                        <label style="display: block; color: #374151; font-weight: 500; margin-bottom: 10px;">
                            ID da Tabela no Notion:
                        </label>
                        <input 
                            id="tableIdInput" 
                            type="text" 
                            placeholder="Cole o ID da tabela aqui..." 
                            style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace; margin-bottom: 15px;"
                        />
                        <button 
                            onclick="loadFromWelcome()" 
                            style="width: 100%; padding: 12px; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 1rem;"
                        >
                            ✅ Carregar Proposta
                        </button>
                    </div>
                    <p style="color: #6b7280; font-size: 0.9rem; margin-top: 15px;">
                        💡 Ou acesse a URL com o ID: <code style="background: white; padding: 5px 8px; border-radius: 4px;">?id=SEU_ID_AQUI</code>
                    </p>
                </div>
            </div>
        `;
    }
}

function loadFromWelcome() {
    const tableId = document.getElementById('tableIdInput')?.value?.trim();
    if (!tableId) {
        alert('⚠️ Por favor, insira o ID da tabela');
        return;
    }
    window.location.href = `?id=${encodeURIComponent(tableId)}`;
}

// =====================================================
// CARREGAMENTO DE DADOS
// =====================================================

async function loadProposalFromNotion(tableId) {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 📍 INICIANDO: loadProposalFromNotion()');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('Parâmetro tableId:', tableId);
    
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
    const finalUrl = `${baseUrl}?id=${tableId}`;
    
    console.log(`📡 URL final: ${finalUrl}`);
    
    try {
        const response = await fetch(finalUrl);
        
        console.log(`📊 Status HTTP: ${response.status}`);
        console.log(`✅ OK: ${response.ok}`);
        
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.log(`❌ Erro: ${JSON.stringify(errorBody)}`);
            throw new Error(`Erro ao carregar dados: ${response.status}`);
        }

        const data = await response.json();
        
        // Log detalhado no console para diagnóstico
        console.log('');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  RESPOSTA BRUTA DA API - PRIMEIRO REGISTRO COMPLETO   ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        if (Array.isArray(data) && data.length > 0) {
            console.log(data[0]);
        } else {
            console.log(data);
        }
        console.log('');
        
        console.log(`📦 Dados tipo: ${typeof data}`);
        console.log(`📦 Dados é array? ${Array.isArray(data)}`);
        console.log(`📦 Dados tem .error? ${'error' in data}`);
        
        // Se recebeu erro, mostrar
        if (data.error) {
          console.log(`❌ API retornou erro: ${data.error}`);
          console.log(`📋 Debug info: ${JSON.stringify(data.debug || {})}`);
          throw new Error(`Erro da API: ${data.error}`);
        }
        
        // Se tem estrutura com debug, extrair emissoras
        let emissoras = Array.isArray(data) ? data : (data.emissoras || []);
        let ocultasEmissoras = data.ocultasEmissoras || [];
        
        // Log de debug das logos
        if (data.debug) {
          console.log(`📊 Debug info:`, data.debug);
          console.log(`✅ Logos encontradas: ${data.debug.logosFounded}`);
          console.log(`❌ Logos NÃO encontradas: ${data.debug.logosNotFound}`);
          if (data.debug.sampleWithLogo) {
            console.log(`📌 Exemplo com logo:`, data.debug.sampleWithLogo.emissora, '→', data.debug.sampleWithLogo.logo?.substring(0, 50));
          }
          if (data.debug.sampleWithoutLogo) {
            console.log(`⚠️ Exemplo sem logo:`, data.debug.sampleWithoutLogo.emissora);
          }
        }
        
        console.log(`📊 É array? ${Array.isArray(emissoras)}`);
        console.log(`📊 Tamanho: ${Array.isArray(emissoras) ? emissoras.length : 'N/A'}`);
        console.log(`👤 Emissoras ocultas: ${ocultasEmissoras.length}`);
        
        if (Array.isArray(emissoras) && emissoras.length > 0) {
            console.log(`✅ Processando ${emissoras.length} emissoras`);
            console.log(`📋 Primeiro emissora: ${emissoras[0].emissora || 'SEM NOME'}`);
            
            // Usar os dados diretamente do Notion, sem transformação
            proposalData.emissoras = emissoras;
            
            // Carregar emissoras ocultas no Set
            proposalData.ocultasEmissoras = new Set(ocultasEmissoras);
            proposalData.initialOcultasEmissoras = new Set(ocultasEmissoras);  // Guardar estado inicial
            console.log(`👤 ${proposalData.ocultasEmissoras.size} emissoras marcadas como ocultas`);
            
            console.log(`✅ ${proposalData.emissoras.length} emissoras carregadas com sucesso!`);
        } else {
            console.log('⚠️ Array vazio ou inválido');
            throw new Error('Nenhuma emissora encontrada');
        }
    } catch (error) {
        console.log(`❌ Erro na função: ${error.message}`);
        console.error(error);
        throw error;
    }
}

function getApiUrl() {
    const hostname = window.location.hostname;
    
    // Cloudflare Pages
    if (hostname.includes('pages.dev')) {
        return '/notion';
    }
    
    // Netlify
    if (hostname.includes('netlify.app')) {
        return '/.netlify/functions/notion';
    }
    
    // Local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8787/notion';
    }
    
    // Default
    return '/notion';
}

// =====================================================
// RENDERIZAÇÃO
// =====================================================

function renderInterface() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 📍 INICIANDO: renderInterface()');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('proposalData.emissoras.length:', proposalData.emissoras.length);
    
    console.log('🎨 Renderizando interface...');
    console.log('📊 Emissoras disponíveis:', proposalData.emissoras.length);
    
    // Buscar o nome da proposta
    let proposalName = 'Proposta de Mídia';
    
    if (proposalData.emissoras && proposalData.emissoras.length > 0) {
        const firstEmissora = proposalData.emissoras[0];
        
        // Tenta encontrar o nome da proposta nos campos
        if (firstEmissora.proposta && firstEmissora.proposta.trim()) {
            proposalName = firstEmissora.proposta;
            console.log('✅ Nome da proposta encontrado:', proposalName);
        } else if (firstEmissora.empresa && firstEmissora.empresa.trim()) {
            proposalName = firstEmissora.empresa;
            console.log('✅ Nome da empresa encontrado:', proposalName);
        } else {
            // Fallback: usa a primeira emissora
            proposalName = firstEmissora.emissora || 'Proposta de Mídia';
            console.log('⚠️ Usando emissora como nome:', proposalName);
        }
    }
    
    console.log('🏢 Nome da proposta:', proposalName);
    // Título não é mais atualizado dinamicamente
    
    // Remover a seção de localização (já não será exibida)
    const locationInfo = document.getElementById('locationInfo');
    if (locationInfo && locationInfo.parentElement) {
        locationInfo.parentElement.style.display = 'none';
    }
    
    console.log('🎯 Chamando renderSpotsTable...');
    renderSpotsTable();
    console.log('🎯 Chamando updateStats...');
    updateStats();
    console.log('🎯 Chamando renderCharts...');
    renderCharts();
    
    // 💾 Criar backup do estado inicial (para rollback em caso de erro)
    proposalData.lastSuccessfulState = {
        ocultasEmissoras: new Set(proposalData.ocultasEmissoras),
        changes: JSON.parse(JSON.stringify(proposalData.changes)),
        emissoras: proposalData.emissoras.map(e => ({...e}))
    };
    console.log('💾 Estado inicial salvo para rollback:', {
        ocultasEmissoras: Array.from(proposalData.lastSuccessfulState.ocultasEmissoras),
        changesCount: Object.keys(proposalData.lastSuccessfulState.changes).length
    });
    
    console.log('🎯 Garantindo que botão de salvar está oculto (sem alterações)...');
    showUnsavedChanges();
    console.log('✅ renderInterface() finalizado!');
}

function renderSpotsTable() {
    console.log('\n🎯🎯🎯 renderSpotsTable() INICIADA 🎯🎯🎯');
    
    const tbody = document.getElementById('spotsTableBody');
    const table = document.getElementById('spotsTable');
    
    console.log('✅ Procurando tbody #spotsTableBody...');
    console.log('✅ tbody encontrado?', !!tbody);
    console.log('✅ proposalData.emissoras.length:', proposalData.emissoras.length);
    
    if (!tbody || !table) {
        console.error('❌ CRÍTICO: Elementos da tabela não encontrados no DOM!');
        return;
    }
    
    if (!proposalData.emissoras || proposalData.emissoras.length === 0) {
        console.error('❌ CRÍTICO: proposalData.emissoras vazio ou indefinido!');
        return;
    }
    
    // LOG: Verificar se campo 'impactos' existe nos dados
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║ 🔍 VERIFICANDO CAMPOS NOS DADOS');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    proposalData.emissoras.forEach((emissora, idx) => {
        const logoUrl = getLogoUrl(emissora.linkLogo);
        console.log(`  [${idx}] ${emissora.emissora}:`);
        console.log(`       - impactos: "${emissora.impactos}"`);
        console.log(`       - linkLogo (raw): ${JSON.stringify(emissora.linkLogo)}`);
        console.log(`       - linkLogo (tipo): ${typeof emissora.linkLogo}`);
        console.log(`       - linkLogo (extraído): "${logoUrl}"`);
        console.log(`       - logo: "${emissora.logo}"`);
        console.log(`       - Todas as chaves:`, Object.keys(emissora));
    });
    
    // Encontra quais produtos têm dados (spots > 0) em qualquer emissora
    const produtosAtivos = new Set();
    proposalData.emissoras.forEach(emissora => {
        PRODUTOS.forEach(produto => {
            const spots = emissora[produto.key] || 0;
            if (spots > 0) {
                produtosAtivos.add(produto.key);
            }
        });
    });
    
    console.log('🔍 Produtos com dados encontrados:', Array.from(produtosAtivos).map(pk => {
        const p = PRODUTOS.find(x => x.key === pk);
        return p ? p.label : pk;
    }));
    
    // RECONSTRÓI os cabeçalhos da tabela
    const thead = table.querySelector('thead');
    if (thead) {
        thead.innerHTML = '';
        const headerRow = document.createElement('tr');
        
        // Cabeçalhos fixos
        headerRow.innerHTML = `
            <th style="width: 40px; min-width: 40px;">✓</th>
            <th style="min-width: 80px;">Região</th>
            <th style="min-width: 100px;">Praça</th>
            <th style="min-width: 140px;">Emissora</th>
        `;
        
        // Cabeçalhos dinâmicos por produto
        produtosAtivos.forEach(produtoKey => {
            const produto = PRODUTOS.find(p => p.key === produtoKey);
            headerRow.innerHTML += `
                <th colspan="2" style="text-align: center; border-bottom: 2px solid var(--primary); min-width: 180px;">
                    ${produto.label}
                </th>
            `;
        });
        
        headerRow.innerHTML += `
            <th style="min-width: 140px;">Inv. Tabela</th>
            <th style="min-width: 140px;">Inv. Negociado</th>
        `;
        
        thead.appendChild(headerRow);
    }
    
    // LIMPA o tbody completamente
    tbody.innerHTML = '';
    
    let totalLinhasAdicionadas = 0;
    
    // Renderiza uma linha por emissora
    proposalData.emissoras.forEach((emissora, emissoraIndex) => {
        console.log(`📍 Processando emissora ${emissoraIndex}: ${emissora.emissora}`);
        
        let investimentoTabelaEmissora = 0;
        let investimentoNegociadoEmissora = 0;
        
        const row = document.createElement('tr');
        row.className = 'spots-data-row';
        row.id = `emissora-row-${emissora.id}`;  // ID único para CSS
        row.setAttribute('data-emissora-id', emissora.id);  // Para rastreamento
        
        // Aplicar estilo se oculta
        if (proposalData.ocultasEmissoras.has(emissora.id)) {
            row.classList.add('emissora-oculta');
        }
        
        // Colunas fixas
        const isOculta = proposalData.ocultasEmissoras.has(emissora.id);
        const logoUrl = getLogoUrl(emissora.linkLogo);
        
        console.log(`  Logo URL para ${emissora.emissora}: ${logoUrl}`);
        
        row.innerHTML = `
            <td class="checkbox-cell">
                <input 
                    type="checkbox" 
                    data-emissora-index="${emissoraIndex}"
                    data-emissora-id="${emissora.id}"
                    onchange="toggleOcultarEmissora(this)"
                    style="cursor: pointer;"
                    ${!isOculta ? 'checked' : ''}
                >
            </td>
            <td>${emissora.uf || '-'}</td>
            <td>${emissora.praca || '-'}</td>
            <td class="emissora-cell">
                ${logoUrl ? `<img src="${logoUrl}" alt="${emissora.emissora}" class="emissora-logo" onerror="console.error('Erro ao carregar logo de ${emissora.emissora}')">` : ''}
                <span class="emissora-name"><strong>${emissora.emissora || '-'}</strong></span>
            </td>
        `;
        
        // Colunas dinâmicas por produto
        produtosAtivos.forEach(produtoKey => {
            const produto = PRODUTOS.find(p => p.key === produtoKey);
            const spots = emissora[produto.key] || 0;
            const valorTabela = emissora[produto.tabelaKey] || 0;
            const valorNegociado = emissora[produto.negKey] || 0;
            
            const invTabela = spots * valorTabela;
            const invNegociado = spots * valorNegociado;
            
            investimentoTabelaEmissora += invTabela;
            investimentoNegociadoEmissora += invNegociado;
            
            row.innerHTML += `
                <td style="text-align: center; min-width: 90px;">
                    <input 
                        type="number" 
                        value="${spots}" 
                        onchange="updateEmissora(${emissoraIndex}, '${produto.key}', this.value)"
                        class="input-spots"
                        min="0"
                        step="1"
                        style="width: 60px; padding: 4px; text-align: center;"
                    >
                </td>
                <td style="text-align: right; min-width: 90px;">R$ ${valorNegociado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            `;
        });
        
        // Colunas de investimento
        row.innerHTML += `
            <td class="investment-tabela">R$ ${investimentoTabelaEmissora.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="investment-negociado">R$ ${investimentoNegociadoEmissora.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        `;
        
        tbody.appendChild(row);
        totalLinhasAdicionadas++;
    });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Tabela renderizada com sucesso! ${totalLinhasAdicionadas} emissoras exibidas`);
    console.log('═══════════════════════════════════════════════════════════');
}

function updateActiveProducts() {
    const activeProductsList = document.getElementById('activeProductsList');
    if (!activeProductsList) return;
    
    // Contar quantidade de cada produto nas emissoras SELECIONADAS
    const productCounts = {};
    
    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
        
        // Apenas conta emissoras selecionadas
        if (checkbox && checkbox.checked) {
            PRODUTOS.forEach(produto => {
                const spots = emissora[produto.key] || 0;
                if (spots > 0) {
                    if (!productCounts[produto.label]) {
                        productCounts[produto.label] = 0;
                    }
                    productCounts[produto.label] += spots;
                }
            });
        }
    });
    
    // Renderizar badges com produtos ativos
    const badgesHTML = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1]) // Ordena por quantidade descendente
        .map(([product, count]) => {
            // Determinar classe de estilo baseado no tipo de produto
            let styleClass = 'secondary';
            if (product.includes('Spots') && product.includes('30')) styleClass = '';
            if (product.includes('5"')) styleClass = 'secondary';
            if (product.includes('15"')) styleClass = '';
            if (product.includes('60"')) styleClass = 'accent';
            if (product.includes('Test')) styleClass = 'secondary';
            
            return `<div class="product-badge ${styleClass}"><strong>${product}:</strong> ${count}</div>`;
        })
        .join('');
    
    activeProductsList.innerHTML = badgesHTML || '<div class="product-badge">Nenhum produto selecionado</div>';
}

function updateStats() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 📍 INICIANDO: updateStats()');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('✅ Iniciando cálculos apenas das emissoras SELECIONADAS...');
    
    // Calcula o investimento total APENAS das emissoras checadas
    let totalInvestimentoTabela = 0;
    let totalInvestimentoNegociado = 0;
    let totalSpots = 0;
    
    // Percorre apenas as linhas que estão selecionadas (checkbox marcado)
    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
        
        // Se a checkbox está checada, inclui no cálculo
        if (checkbox && checkbox.checked) {
            PRODUTOS.forEach(produto => {
                const spots = emissora[produto.key] || 0;
                if (spots > 0) {
                    const valorTabela = emissora[produto.tabelaKey] || 0;
                    const valorNegociado = emissora[produto.negKey] || 0;
                    
                    totalInvestimentoTabela += spots * valorTabela;
                    totalInvestimentoNegociado += spots * valorNegociado;
                    totalSpots += spots;
                }
            });
        }
    });
    
    // Calcula total de impactos das emissoras selecionadas
    let totalImpactos = 0;
    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
        if (checkbox && checkbox.checked) {
            const impactosValue = emissora.impactos || 0;
            // Se for string, converte do formato brasileiro
            const impactosNum = typeof impactosValue === 'string' 
                ? parseFloat(impactosValue.replace('.', '').replace(',', '.')) || 0
                : impactosValue;
            totalImpactos += impactosNum;
        }
    });
    
    // Calcula percentual de desconto
    const economia = totalInvestimentoTabela - totalInvestimentoNegociado;
    const percentualDesconto = totalInvestimentoTabela > 0 
        ? ((economia / totalInvestimentoTabela) * 100).toFixed(2)
        : 0;
    
    console.log('📊 Total Spots:', totalSpots);
    console.log('💰 Total Investimento Tabela:', totalInvestimentoTabela);
    console.log('💰 Total Investimento Negociado:', totalInvestimentoNegociado);
    console.log('📈 Total Impactos:', totalImpactos);
    console.log('💵 Economia (R$):', economia);
    console.log('💵 Desconto (%):', percentualDesconto);
    
    const statTotalSpots = document.getElementById('statTotalSpots');
    const statTabelaValue = document.getElementById('statTabelaValue');
    const statNegociadoValue = document.getElementById('statNegociadoValue');
    const statTotalImpacts = document.getElementById('statTotalImpacts');
    const statEconomia = document.getElementById('statEconomia');
    
    console.log('🔍 Elementos encontrados:', {
        statTotalSpots: !!statTotalSpots,
        statTabelaValue: !!statTabelaValue,
        statNegociadoValue: !!statNegociadoValue,
        statTotalImpacts: !!statTotalImpacts,
        statEconomia: !!statEconomia
    });
    
    if (statTotalSpots) statTotalSpots.textContent = totalSpots;
    if (statTabelaValue) statTabelaValue.textContent = formatCurrency(totalInvestimentoTabela);
    if (statNegociadoValue) statNegociadoValue.textContent = formatCurrency(totalInvestimentoNegociado);
    if (statTotalImpacts) statTotalImpacts.textContent = totalImpactos.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (statEconomia) statEconomia.textContent = percentualDesconto + '%';
    
    // Atualizar lista de produtos ativos
    updateActiveProducts();
    
    // Atualizar tabela comparativa "Sua Proposta"
    updateComparisonTable(totalInvestimentoNegociado, totalInvestimentoTabela);
    
    console.log('✅ Estatísticas atualizadas!\n');
}

function updateComparisonTable(negociado, tabela) {
    // Obtém os elementos da tabela
    const compNegociado = document.getElementById('compNegociado');
    const compNegociadoAtual = document.getElementById('compNegociadoAtual');
    const compTabela = document.getElementById('compTabela');
    const compTabelaAtual = document.getElementById('compTabelaAtual');
    
    // Obtém o saldo anterior do localStorage
    const saldoAnterior = getSaldoAnterior();
    const negociadoAnterior = saldoAnterior.negociado || 0;
    const tabelaAnterior = saldoAnterior.tabela || 0;
    
    // Atualiza os valores
    if (compNegociado) compNegociado.textContent = formatCurrency(negociadoAnterior);
    if (compNegociadoAtual) compNegociadoAtual.textContent = formatCurrency(negociado);
    if (compTabela) compTabela.textContent = formatCurrency(tabelaAnterior);
    if (compTabelaAtual) compTabelaAtual.textContent = formatCurrency(tabela);
}

function renderCharts() {
    console.log('📊 Renderizando gráficos...');
    
    try {
        // Destroi os gráficos antigos se existirem
        if (charts.investment) {
            charts.investment.destroy();
            charts.investment = null;
        }
        
        renderInvestmentChart();
        console.log('✅ Gráficos renderizados com sucesso!');
    } catch (error) {
        console.error('⚠️ Erro ao renderizar gráficos (não crítico):', error);
    }
}

function renderInvestmentChart() {
    const ctx = document.getElementById('investmentChart');
    if (!ctx) {
        console.warn('⚠️ Elemento investmentChart não encontrado');
        return;
    }
    
    const canvasCtx = ctx.getContext('2d');
    
    // Calcula investimentos apenas das linhas selecionadas
    let totalTabela = 0;
    let totalNegociado = 0;
    
    const rows = document.querySelectorAll('#spotsTableBody tr');
    rows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            // Encontra as células de investimento nesta linha
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                // Pega as últimas 2 células (investimento tabela e negociado)
                const investTabelaCell = cells[cells.length - 2];
                const investNegociadoCell = cells[cells.length - 1];
                
                if (investTabelaCell && investNegociadoCell) {
                    const tabelaText = investTabelaCell.textContent.replace('R$ ', '').replace(/\./g, '').replace(',', '.');
                    const negociadoText = investNegociadoCell.textContent.replace('R$ ', '').replace(/\./g, '').replace(',', '.');
                    
                    totalTabela += parseFloat(tabelaText) || 0;
                    totalNegociado += parseFloat(negociadoText) || 0;
                }
            }
        }
    });
    
    const labels = ['Tabela', 'Negociado'];
    const data = [totalTabela, totalNegociado];
    
    console.log('📊 Gráfico investimento - Tabela:', totalTabela, 'Negociado:', totalNegociado);
    
    charts.investment = new Chart(canvasCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#8b5cf6', '#06055b'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed);
                        }
                    }
                }
            }
        }
    });
}

// Calcula o máximo de escala (max redondo) que garanta visualização de TODAS as barras
function calculateChartMax(dataArray) {
    if (!dataArray || dataArray.length === 0) return 100000;
    
    // Pega o valor máximo real
    const maxValue = Math.max(...dataArray);
    if (maxValue === 0) return 100000;
    
    // Calcula um máximo "redondo" que seja ~20% maior que o máximo
    // Isso garante espaço no topo mas mantém escala legível
    const targetMax = maxValue * 1.15;
    
    // Arredonda para um valor "bonito": 100k, 200k, 500k, 1M, 2M, 5M, 10M, etc.
    const magnitude = Math.pow(10, Math.floor(Math.log10(targetMax)));
    const normalized = targetMax / magnitude;
    
    let roundedMax;
    if (normalized <= 1) roundedMax = magnitude;
    else if (normalized <= 2) roundedMax = 2 * magnitude;
    else if (normalized <= 5) roundedMax = 5 * magnitude;
    else roundedMax = 10 * magnitude;
    
    return roundedMax;
}


// =====================================================
// CÁLCULOS
// =====================================================

function getSelectedRows() {
    console.log('  ↳ getSelectedRows() chamada');
    // Retorna array de checkboxes selecionados
    const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]:checked');
    console.log('  ↳ Checkboxes selecionados:', checkboxes.length);
    return checkboxes;
}

function calculateTotalSpots() {
    console.log('  ↳ calculateTotalSpots() chamada');
    let total = 0;
    getSelectedRows().forEach(checkbox => {
        const row = checkbox.closest('tr');
        const input = row.querySelector('input[type="number"]');
        if (input) {
            total += parseFloat(input.value) || 0;
        }
    });
    console.log('  ↳ Total spots calculado:', total);
    return total;
}

function calculateTotalInvestimentoTabela() {
    console.log('  ↳ calculateTotalInvestimentoTabela() chamada');
    let total = 0;
    getSelectedRows().forEach(checkbox => {
        const row = checkbox.closest('tr');
        const investCell = row.querySelector('.investment-tabela');
        if (investCell) {
            const value = investCell.textContent.replace('R$ ', '').replace(',', '.');
            total += parseFloat(value) || 0;
        }
    });
    console.log('  ↳ Total investimento tabela calculado:', total);
    return total;
}

function calculateTotalInvestimentoNegociado() {
    console.log('  ↳ calculateTotalInvestimentoNegociado() chamada');
    let total = 0;
    getSelectedRows().forEach(checkbox => {
        const row = checkbox.closest('tr');
        const investCell = row.querySelector('.investment-negociado');
        if (investCell) {
            const value = investCell.textContent.replace('R$ ', '').replace(',', '.');
            total += parseFloat(value) || 0;
        }
    });
    console.log('  ↳ Total investimento negociado calculado:', total);
    return total;
}

function calculateCPM() {
    console.log('  ↳ calculateCPM() chamada');
    const totalSpots = calculateTotalSpots();
    const totalInvestimento = calculateTotalInvestimentoNegociado();
    
    console.log('  ↳ CPM: spots=', totalSpots, 'investimento=', totalInvestimento);
    
    if (totalSpots === 0 || totalInvestimento === 0) return 0;
    return (totalInvestimento / totalSpots) * 1000;
}

// =====================================================
// EDIÇÃO E ATUALIZAÇÃO
// =====================================================

function updateEmissora(index, field, value) {
    console.log(`🔴 UPDATE: index=${index}, field=${field}, value=${value}`);
    
    const emissora = proposalData.emissoras[index];
    if (!emissora) {
        console.error('❌ Emissora não encontrada:', index);
        return;
    }
    
    const oldValue = emissora[field];
    const newValue = parseFloat(value) || 0;
    
    emissora[field] = newValue;
    
    const changeKey = `${index}-${field}`;
    if (!proposalData.changes[changeKey]) {
        proposalData.changes[changeKey] = { 
            emissoraIndex: index,
            field: field,
            old: oldValue, 
            new: newValue 
        };
    } else {
        proposalData.changes[changeKey].new = newValue;
    }
    
    console.log(`📝 Emissora ${index} - ${field}: ${oldValue} → ${newValue}`);
    console.log('📊 Changes agora:', proposalData.changes);
    
    // NÃO chama renderSpotsTable, apenas atualiza estatísticas e gráficos
    updateStats();
    renderCharts();
    
    // Mostrar botão de salvar quando há alterações
    showUnsavedChanges();
}

function updateRowSelection() {
    // Função chamada quando um checkbox é marcado/desmarcado
    // Recalcula os totais baseado nas linhas selecionadas
    console.log('📝 Linha selecionada/desmarcada');
    updateStats();
    renderCharts();
    
    // Marcar como alteração - seleção de linhas também é uma mudança!
    showUnsavedChanges();
}

function toggleOcultarEmissora(checkbox) {
    // Se a flag está ativa, ignora este evento e desativa a flag
    if (ignoreNextCheckboxChange) {
        console.log('⏭️ Ignorando evento de checkbox (double trigger prevention)');
        ignoreNextCheckboxChange = false;
        return;
    }
    
    const emissoraId = checkbox.getAttribute('data-emissora-id');
    const emissoraIndex = parseInt(checkbox.getAttribute('data-emissora-index'));
    const emissora = proposalData.emissoras[emissoraIndex];
    
    console.log(`🔄 Alternando ocultamento de emissora: ${emissoraId}, marcado: ${checkbox.checked}`);
    console.log(`   Estado anterior - ocultasEmissoras:`, Array.from(proposalData.ocultasEmissoras));
    
    if (checkbox.checked) {
        // Marcar = REMOVER da lista (quando está marcado, mostra na proposta)
        // Se está marcado agora, significa que estava desmarcado antes (estava oculto)
        // Então precisamos removê-lo da lista de ocultos
        
        // Fazer a mudança IMEDIATAMENTE
        proposalData.ocultasEmissoras.delete(emissoraId);
        proposalData.changedEmissoras.add(emissoraId);
        
        console.log(`   Estado novo - ocultasEmissoras:`, Array.from(proposalData.ocultasEmissoras));
        
        // Atualizar visual da linha
        const row = document.getElementById(`emissora-row-${emissoraId}`);
        if (row) {
            row.classList.remove('emissora-oculta');
        }
        
        // Atualizar estatísticas
        updateStats();
        renderCharts();
        
        // Mostrar botão de salvar
        showUnsavedChanges();
        
        console.log(`✅ Emissora ${emissora?.emissora || emissoraId} ADICIONADA (será restaurada no Notion)`);
        console.log(`📊 Emissoras ocultas agora:`, Array.from(proposalData.ocultasEmissoras));
    } else {
        // Desmarcar = ADICIONAR à lista (quando está desmarcado, fica oculto na proposta)
        // Se está desmarcado agora, significa que estava marcado antes (estava visível)
        // Então precisamos adicioná-lo à lista de ocultos
        
        // Marcar ANTES de mostrar o modal para que o botão apareça
        proposalData.changedEmissoras.add(emissoraId);
        showUnsavedChanges();  // Mostrar botão de salvar
        
        console.log(`⚠️ Mostrando confirmação para remover ${emissoraId}`);
        showConfirmRemovalModal(checkbox, emissora, emissoraId);
        return;  // NÃO continua aqui, espera confirmação
    }
}

// ✅ FUNÇÃO DE SINCRONIZAÇÃO: Força o estado correto dos checkboxes baseado no proposalData
function syncCheckboxState() {
    console.log('🔄 SINCRONIZANDO ESTADO DOS CHECKBOXES...');
    console.log('   Emissoras ocultas no estado:', Array.from(proposalData.ocultasEmissoras));
    
    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
        if (checkbox) {
            const deveEstarVisivel = !proposalData.ocultasEmissoras.has(emissora.id);
            const estaChecked = checkbox.checked;
            
            console.log(`   ${emissora.emissora}: deveEstarVisivel=${deveEstarVisivel}, estaChecked=${estaChecked}`);
            
            if (deveEstarVisivel !== estaChecked) {
                console.log(`      ⚠️ DESSINCRONIZADO! Corrigindo...`);
                ignoreNextCheckboxChange = true;
                checkbox.checked = deveEstarVisivel;
                
                const row = document.getElementById(`emissora-row-${emissora.id}`);
                if (row) {
                    if (deveEstarVisivel) {
                        row.classList.remove('emissora-oculta');
                    } else {
                        row.classList.add('emissora-oculta');
                    }
                }
            }
        }
    });
    
    console.log('✅ Sincronização completa');
}
// =====================================================
// SALVAR ALTERAÇÕES
// =====================================================

async function saveChanges() {
    console.log('🔴 CLICOU EM SALVAR!');
    console.log('📊 proposalData.changes:', proposalData.changes);
    console.log('📊 Número de mudanças:', Object.keys(proposalData.changes).length);
    console.log('👤 Emissoras ocultas:', proposalData.ocultasEmissoras.size);
    console.log('👤 Emissoras alteradas:', proposalData.changedEmissoras.size);
    
    const temMudancas = Object.keys(proposalData.changes).length > 0;
    const temMudancasEmissoras = proposalData.changedEmissoras.size > 0;
    
    if (!temMudancas && !temMudancasEmissoras) {
        console.warn('⚠️ Nenhuma alteração para salvar!');
        alert('Nenhuma alteração para salvar!');
        return;
    }
    
    console.log('💾 Preparando alterações para visualização...');
    
    // Montar o resumo das alterações agrupadas por emissora
    showConfirmModal();
}

function showConfirmModal() {
    console.log('📋 Abrindo modal de confirmação...');
    
    const modal = document.getElementById('confirmModal');
    const modalBody = document.getElementById('confirmModalBody');
    
    // Agrupar alterações por emissora
    const changesByEmissora = {};
    
    for (const changeKey in proposalData.changes) {
        const change = proposalData.changes[changeKey];
        const emissora = proposalData.emissoras[change.emissoraIndex];
        
        if (!changesByEmissora[change.emissoraIndex]) {
            changesByEmissora[change.emissoraIndex] = [];
        }
        
        changesByEmissora[change.emissoraIndex].push({
            field: change.field,
            old: change.old,
            new: change.new,
            emissora: emissora
        });
    }
    
    // Montar HTML do modal
    let html = '';
    
    // Primeiro, mostrar as emissoras que serão removidas (ocultas)
    if (proposalData.ocultasEmissoras.size > 0) {
        html += `
            <div class="change-group" style="border-left-color: #dc2626; background-color: #fef2f2;">
                <div class="change-group-title" style="color: #dc2626;">
                    <i class="fas fa-trash"></i> Emissoras a Remover
                </div>
        `;
        
        for (const emissoraId of proposalData.ocultasEmissoras) {
            const emissora = proposalData.emissoras.find(e => e.id === emissoraId);
            if (emissora) {
                html += `
                    <div class="change-item" style="padding: 8px 0; color: #dc2626;">
                        <strong>${emissora.emissora}</strong>
                        <span style="font-size: 12px; color: #999;"> - será movida para "Lista de alternantes"</span>
                    </div>
                `;
            }
        }
        
        html += '</div>';
    }
    
    // Mostrar as emissoras que serão adicionadas (foram restauradas)
    // São aquelas que estão em changedEmissoras mas NÃO estão em ocultasEmissoras
    const emisssorasAdicionar = Array.from(proposalData.changedEmissoras).filter(
        emissoraId => !proposalData.ocultasEmissoras.has(emissoraId)
    );
    
    if (emisssorasAdicionar.length > 0) {
        html += `
            <div class="change-group" style="border-left-color: #10b981; background-color: #f0fdf4;">
                <div class="change-group-title" style="color: #10b981;">
                    <i class="fas fa-plus-circle"></i> Emissoras a Adicionar
                </div>
        `;
        
        for (const emissoraId of emisssorasAdicionar) {
            const emissora = proposalData.emissoras.find(e => e.id === emissoraId);
            if (emissora) {
                html += `
                    <div class="change-item" style="padding: 8px 0; color: #10b981;">
                        <strong>${emissora.emissora}</strong>
                        <span style="font-size: 12px; color: #999;"> - será incluída na proposta</span>
                    </div>
                `;
            }
        }
        
        html += '</div>';
    }
    
    // Depois, mostrar as mudanças de valores
    for (const emissoraIndex in changesByEmissora) {
        const changes = changesByEmissora[emissoraIndex];
        const emissora = proposalData.emissoras[emissoraIndex];
        const emissoraName = emissora?.emissora || 'Desconhecida';
        
        html += `
            <div class="change-group">
                <div class="change-group-title">
                    <i class="fas fa-radio"></i> ${emissoraName}
                </div>
        `;
        
        changes.forEach(change => {
            // Encontrar o label do produto
            let fieldLabel = change.field;
            const produto = PRODUTOS.find(p => 
                p.key === change.field || 
                p.tabelaKey === change.field || 
                p.negKey === change.field
            );
            
            if (produto) {
                if (change.field === produto.key) {
                    fieldLabel = `${produto.label}`;
                } else if (change.field === produto.tabelaKey) {
                    fieldLabel = `${produto.label} (Tabela)`;
                } else if (change.field === produto.negKey) {
                    fieldLabel = `${produto.label} (Negociado)`;
                }
            }
            
            // Formatar valores
            let oldValue = change.old;
            let newValue = change.new;
            
            // Se for valor monetário, formatar como moeda
            if (change.field.includes('valor') || change.field.includes('investimento')) {
                oldValue = formatCurrency(change.old);
                newValue = formatCurrency(change.new);
            }
            
            html += `
                <div class="change-item">
                    <span class="change-item-label">${fieldLabel}</span>
                    <div style="display: flex; align-items: center;">
                        <span class="change-old">${oldValue}</span>
                        <span class="change-arrow">→</span>
                        <span class="change-new">${newValue}</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    modalBody.innerHTML = html;
    modal.style.display = 'flex';
    
    console.log('✅ Modal aberto com sucesso!');
}

function closeConfirmModal() {
    console.log('❌ Fechando modal (editando novamente)');
    document.getElementById('confirmModal').style.display = 'none';
}

// =====================================================
// MODAL DE CONFIRMAÇÃO DE REMOÇÃO
// =====================================================

let pendingRemovalData = null;

function showConfirmRemovalModal(checkbox, emissora, emissoraId) {
    console.log('📋 Abrindo modal de confirmação de remoção...');
    
    // Salvar dados para confirmação
    pendingRemovalData = {
        checkbox: checkbox,
        emissora: emissora,
        emissoraId: emissoraId
    };
    
    const modal = document.getElementById('confirmRemovalModal');
    const modalBody = document.getElementById('confirmRemovalModalBody');
    
    // Montar HTML do modal
    const html = `
        <div class="change-group" style="padding: 20px; background: #fff3cd; border-left: 4px solid #ff6b6b; border-radius: 4px;">
            <div class="change-group-title" style="color: #d32f2f; margin-bottom: 12px;">
                <i class="fas fa-exclamation-triangle"></i> Confirmar Remoção de Emissora
            </div>
            <p style="margin: 12px 0; font-size: 15px;">
                Você está removendo a emissora <strong>${emissora.emissora}</strong> desta proposta.
            </p>
            <p style="margin: 12px 0; font-size: 14px; color: #666;">
                Esta emissora será excluída e não será contabilizada. Você poderá restaurá-la marcando novamente depois.
            </p>
        </div>
    `;
    
    modalBody.innerHTML = html;
    modal.style.display = 'flex';
}

function closeConfirmRemovalModal() {
    console.log('❌ Cancelando remoção');
    document.getElementById('confirmRemovalModal').style.display = 'none';
    
    // Restaurar checkbox para o estado anterior
    if (pendingRemovalData) {
        // Ativar flag para ignorar o próximo evento de checkbox
        ignoreNextCheckboxChange = true;
        pendingRemovalData.checkbox.checked = true;
    }
    
    pendingRemovalData = null;
}

function confirmRemoval() {
    console.log('✅ Confirmando remoção de emissora...');
    
    if (!pendingRemovalData) {
        console.error('❌ pendingRemovalData é nulo!');
        return;
    }
    
    const { checkbox, emissora, emissoraId } = pendingRemovalData;
    
    console.log(`   Estado ANTES de confirmar remoção:`);
    console.log(`   - ocultasEmissoras: ${Array.from(proposalData.ocultasEmissoras)}`);
    console.log(`   - checkbox.checked: ${checkbox.checked}`);
    
    // Adicionar à lista de excluídas
    proposalData.ocultasEmissoras.add(emissoraId);
    proposalData.changedEmissoras.add(emissoraId);  // Marcar como alterada
    
    console.log(`   Estado DEPOIS de confirmar remoção:`);
    console.log(`   - ocultasEmissoras: ${Array.from(proposalData.ocultasEmissoras)}`);
    console.log(`🗑️ Emissora ${emissoraId} REMOVIDA (marcada para exclusão)`);
    
    // Atualizar visual da linha
    const row = document.getElementById(`emissora-row-${emissoraId}`);
    if (row) {
        row.classList.add('emissora-oculta');
        console.log(`   ✅ Linha visual atualizada: ${emissoraId}`);
    } else {
        console.warn(`   ⚠️ Linha não encontrada para ${emissoraId}`);
    }
    
    // Atualizar estatísticas
    updateStats();
    renderCharts();
    
    // Marcar como alteração (precisa salvar)
    showUnsavedChanges();
    
    // Fechar modal
    document.getElementById('confirmRemovalModal').style.display = 'none';
    pendingRemovalData = null;
    
    console.log('📊 Emissoras removidas agora:', Array.from(proposalData.ocultasEmissoras));
}


function showUnsavedChanges() {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        const temMudancas = Object.keys(proposalData.changes).length > 0;
        const temMudancasEmissoras = proposalData.changedEmissoras.size > 0;
        
        const shouldShow = temMudancas || temMudancasEmissoras;
        
        console.log(`💾 showUnsavedChanges:`);
        console.log(`   Mudanças em campos: ${temMudancas}`);
        console.log(`   Mudanças em emissoras: ${temMudancasEmissoras} (${proposalData.changedEmissoras.size})`);
        console.log(`   Mostrar botão: ${shouldShow}`);
        console.log(`   Changes: ${JSON.stringify(proposalData.changes)}`);
        console.log(`   Emissoras alteradas: ${Array.from(proposalData.changedEmissoras)}`);
        
        saveBtn.style.display = shouldShow ? 'block' : 'none';
    } else {
        console.warn('❌ Botão saveBtn não encontrado!');
    }
}


async function confirmAndSave() {
    console.log('✅ Confirmando e salvando alterações...');
    
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'none';
    
    // ⚠️ USAR O ÚLTIMO ESTADO SALVO COM SUCESSO PARA ROLLBACK
    // Não criamos backup aqui, usamos o lastSuccessfulState que foi salvo
    // na última operação bem-sucedida (ou no carregamento inicial)
    console.log('🔄 Estado atual antes de salvar:', {
        ocultasEmissoras: Array.from(proposalData.ocultasEmissoras),
        changedEmissoras: Array.from(proposalData.changedEmissoras),
        changesCount: Object.keys(proposalData.changes).length
    });
    console.log('💾 Último estado salvo com sucesso (fallback):', {
        ocultasEmissoras: Array.from(proposalData.lastSuccessfulState.ocultasEmissoras),
        changesCount: Object.keys(proposalData.lastSuccessfulState.changes).length
    });
    
    try {
        const apiUrl = getApiUrl();
        console.log('📡 API URL:', apiUrl);
        
        // Sincronizar o estado "Excluir" com o Notion
        const dataToSave = {
            tableId: proposalData.tableId,
            emissoras: proposalData.emissoras,
            changes: proposalData.changes,
            ocultasEmissoras: Array.from(proposalData.ocultasEmissoras)  // Converter Set para Array
        };
        
        console.log('📤 Enviando dados:', dataToSave);
        console.log('👤 Emissoras ocultas:', dataToSave.ocultasEmissoras);
        
        const response = await fetch(`${apiUrl}?id=${proposalData.tableId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response ok:', response.ok);
        
        // ⚠️ VALIDAÇÃO RIGOROSA DA RESPOSTA
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Erro na resposta:', errorData);
            console.error('❌ Erro completo:', JSON.stringify(errorData, null, 2));
            
            // 🔄 ROLLBACK: Restaurar último estado salvo com sucesso
            console.log('🔄 FAZENDO ROLLBACK PARA ÚLTIMO ESTADO SALVO...');
            proposalData.ocultasEmissoras = new Set(proposalData.lastSuccessfulState.ocultasEmissoras);
            proposalData.changedEmissoras = new Set();  // Limpar mudanças pendentes
            proposalData.changes = JSON.parse(JSON.stringify(proposalData.lastSuccessfulState.changes));
            proposalData.emissoras = proposalData.lastSuccessfulState.emissoras.map(e => ({...e}));
            
            console.log('   Estado restaurado para:', {
                ocultasEmissoras: Array.from(proposalData.ocultasEmissoras),
                changesCount: Object.keys(proposalData.changes).length
            });
            
            // Restaurar visualmente todos os checkboxes baseado no último estado salvo
            proposalData.emissoras.forEach((emissora, index) => {
                const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
                if (checkbox) {
                    const shouldBeChecked = !proposalData.lastSuccessfulState.ocultasEmissoras.has(emissora.id);
                    ignoreNextCheckboxChange = true;
                    checkbox.checked = shouldBeChecked;
                    
                    const row = document.getElementById(`emissora-row-${emissora.id}`);
                    if (row) {
                        if (shouldBeChecked) {
                            row.classList.remove('emissora-oculta');
                        } else {
                            row.classList.add('emissora-oculta');
                        }
                    }
                }
            });
            
            updateStats();
            renderCharts();
            showUnsavedChanges();
            
            throw new Error(errorData.error || errorData.message || 'Erro ao salvar');
        }
        
        const result = await response.json();
        
        // ⚠️ VALIDAÇÃO: Verificar se resposta contém dados válidos
        if (!result || result.success === false) {
            console.error('❌ Resposta indicou falha:', result);
            
            // 🔄 ROLLBACK: Restaurar último estado salvo com sucesso
            console.log('🔄 FAZENDO ROLLBACK PARA ÚLTIMO ESTADO SALVO...');
            proposalData.ocultasEmissoras = new Set(proposalData.lastSuccessfulState.ocultasEmissoras);
            proposalData.changedEmissoras = new Set();  // Limpar mudanças pendentes
            proposalData.changes = JSON.parse(JSON.stringify(proposalData.lastSuccessfulState.changes));
            proposalData.emissoras = proposalData.lastSuccessfulState.emissoras.map(e => ({...e}));
            
            console.log('   Estado restaurado para:', {
                ocultasEmissoras: Array.from(proposalData.ocultasEmissoras),
                changesCount: Object.keys(proposalData.changes).length
            });
            
            // Restaurar visualmente todos os checkboxes baseado no último estado salvo
            proposalData.emissoras.forEach((emissora, index) => {
                const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
                if (checkbox) {
                    const shouldBeChecked = !proposalData.lastSuccessfulState.ocultasEmissoras.has(emissora.id);
                    ignoreNextCheckboxChange = true;
                    checkbox.checked = shouldBeChecked;
                    
                    const row = document.getElementById(`emissora-row-${emissora.id}`);
                    if (row) {
                        if (shouldBeChecked) {
                            row.classList.remove('emissora-oculta');
                        } else {
                            row.classList.add('emissora-oculta');
                        }
                    }
                }
            });
            
            updateStats();
            renderCharts();
            showUnsavedChanges();
            
            throw new Error(result.message || 'Falha desconhecida ao salvar');
        }
        
        // ⚠️ VALIDAÇÃO EXTRA: Verificar se houve FALHAS NAS ATUALIZAÇÕES ESPECÍFICAS
        // Mesmo que success: true, pode haver failedUpdates
        const failedUpdates = result.failedUpdates || 0;
        const details = result.details || [];
        
        console.log('📊 Resultado da operação:');
        console.log(`   - Sucesso total: ${result.success}`);
        console.log(`   - Atualizações bem-sucedidas: ${result.successfulUpdates || 0}`);
        console.log(`   - Atualizações falhadas: ${failedUpdates}`);
        console.log(`   - Detalhes:`, details);
        
        if (failedUpdates > 0) {
            console.error('❌ ATENÇÃO: Algumas atualizações falharam!');
            
            // Mostrar quais falharam
            details.forEach(detail => {
                if (!detail.success) {
                    console.error(`   ❌ ${detail.emissoraName} - Campo "${detail.field}" FALHOU:`, detail.error);
                }
            });
            
            // 🔄 ROLLBACK PARCIAL: Restaurar último estado salvo com sucesso
            console.log('🔄 FAZENDO ROLLBACK PARA ÚLTIMO ESTADO SALVO (falhas detectadas)...');
            proposalData.ocultasEmissoras = new Set(proposalData.lastSuccessfulState.ocultasEmissoras);
            proposalData.changedEmissoras = new Set();  // Limpar mudanças pendentes
            proposalData.changes = JSON.parse(JSON.stringify(proposalData.lastSuccessfulState.changes));
            proposalData.emissoras = proposalData.lastSuccessfulState.emissoras.map(e => ({...e}));
            
            console.log('   Estado restaurado para:', {
                ocultasEmissoras: Array.from(proposalData.ocultasEmissoras),
                changesCount: Object.keys(proposalData.changes).length
            });
            
            // Restaurar visualmente todos os checkboxes baseado no último estado salvo
            proposalData.emissoras.forEach((emissora, index) => {
                const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
                if (checkbox) {
                    const shouldBeChecked = !proposalData.lastSuccessfulState.ocultasEmissoras.has(emissora.id);
                    ignoreNextCheckboxChange = true;
                    checkbox.checked = shouldBeChecked;
                    
                    const row = document.getElementById(`emissora-row-${emissora.id}`);
                    if (row) {
                        if (shouldBeChecked) {
                            row.classList.remove('emissora-oculta');
                        } else {
                            row.classList.add('emissora-oculta');
                        }
                    }
                }
            });
            
            updateStats();
            renderCharts();
            showUnsavedChanges();
            
            // Mostrar erro com detalhes
            const failedEmissoras = details
                .filter(d => !d.success)
                .map(d => `${d.emissoraName} (${d.field})`)
                .join(', ');
            
            throw new Error(`Erro ao salvar alguns campos: ${failedEmissoras}. Estado foi revertido. Tente novamente.`);
        }
        
        console.log('✅ Alterações salvas!', result);
        console.log('🔍 debugLogs recebido:', result.debugLogs);
        
        // Exibir logs do servidor no console
        if (result.debugLogs && Array.isArray(result.debugLogs)) {
            console.log('═══════════════════════════════════════════════════════════');
            console.log('📋 LOGS DO SERVIDOR (Notion.js):');
            console.log('═══════════════════════════════════════════════════════════');
            result.debugLogs.forEach(log => console.log(log));
            console.log('═══════════════════════════════════════════════════════════');
        } else {
            console.warn('⚠️ debugLogs vazio ou não é array:', result.debugLogs);
        }
        
        // ✅ SÓ LIMPA ESTADO APÓS CONFIRMAÇÃO DE SUCESSO
        proposalData.changes = {};
        proposalData.initialOcultasEmissoras = new Set(proposalData.ocultasEmissoras);
        proposalData.changedEmissoras = new Set();  // Limpar emissoras alteradas
        
        // 💾 ATUALIZAR BACKUP DO ÚLTIMO ESTADO SALVO COM SUCESSO
        proposalData.lastSuccessfulState = {
            ocultasEmissoras: new Set(proposalData.ocultasEmissoras),
            changes: JSON.parse(JSON.stringify(proposalData.changes)),
            emissoras: proposalData.emissoras.map(e => ({...e}))
        };
        console.log('💾 Novo estado salvo como backup para rollback futuro:', {
            ocultasEmissoras: Array.from(proposalData.lastSuccessfulState.ocultasEmissoras),
            changesCount: Object.keys(proposalData.lastSuccessfulState.changes).length
        });
        
        // ✅ SALVAR O SALDO ATUAL COMO "SALDO ANTERIOR" PARA A PRÓXIMA PROPOSTA
        let totalInvestimentoTabela = 0;
        let totalInvestimentoNegociado = 0;
        
        proposalData.emissoras.forEach((emissora, index) => {
            const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
            if (checkbox && checkbox.checked) {
                PRODUTOS.forEach(produto => {
                    const spots = emissora[produto.key] || 0;
                    if (spots > 0) {
                        const valorTabela = emissora[produto.tabelaKey] || 0;
                        const valorNegociado = emissora[produto.negKey] || 0;
                        totalInvestimentoTabela += spots * valorTabela;
                        totalInvestimentoNegociado += spots * valorNegociado;
                    }
                });
            }
        });
        
        // Salvar no localStorage como "saldo anterior"
        setSaldoAnterior(totalInvestimentoNegociado, totalInvestimentoTabela);
        console.log('💾 Saldo anterior atualizado para próxima edição');
        
        // Ocultar botão de salvar já que não há mais alterações
        showUnsavedChanges();
        
        // Mostrar modal de sucesso
        showSuccessModal();
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        alert(`Erro ao salvar: ${error.message}`);
    }
}

function showSuccessModal() {
    console.log('🎉 Mostrando modal de sucesso...');
    
    // ✅ Sincronizar estado dos checkboxes após sucesso confirmado
    console.log('🔄 Sincronizando estado após sucesso...');
    syncCheckboxState();
    
    const successModal = document.getElementById('successModal');
    successModal.style.display = 'flex';
    
    // Auto-fechar após 5 segundos (opcional)
    setTimeout(() => {
        // Comentado para o usuário controlar quando fechar
        // closeSuccessModal();
    }, 5000);
}

function closeSuccessModal() {
    console.log('Fechando modal de sucesso');
    document.getElementById('successModal').style.display = 'none';
}

// ✅ FUNÇÃO DE DEBUG: Exibir estado atual completo
function debugState() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DEBUG STATE - Estado Completo da Aplicação');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 proposalData.changes:', proposalData.changes);
    console.log('👤 proposalData.ocultasEmissoras:', Array.from(proposalData.ocultasEmissoras));
    console.log('👤 proposalData.changedEmissoras:', Array.from(proposalData.changedEmissoras));
    console.log('📋 proposalData.initialOcultasEmissoras:', Array.from(proposalData.initialOcultasEmissoras));
    
    console.log('\n📋 ESTADO DOS CHECKBOXES:');
    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
        const isOculta = proposalData.ocultasEmissoras.has(emissora.id);
        const checkboxValue = checkbox ? checkbox.checked : 'NOT FOUND';
        const deveEstarVisivel = !isOculta;
        const estaSincronizado = checkboxValue === deveEstarVisivel;
        
        console.log(`   [${estaSincronizado ? '✅' : '❌'}] ${emissora.emissora}:`);
        console.log(`       - Checkbox: ${checkboxValue}`);
        console.log(`       - Deve estar visível: ${deveEstarVisivel}`);
        console.log(`       - Está oculta no estado: ${isOculta}`);
    });
    
    console.log('\n📱 ESTADO DO BOTÃO SALVAR:');
    const saveBtn = document.getElementById('saveBtn');
    console.log(`   - Visível: ${saveBtn ? saveBtn.style.display !== 'none' : 'NOT FOUND'}`);
    console.log(`   - Display: ${saveBtn ? saveBtn.style.display : 'NOT FOUND'}`);
    
    console.log('═══════════════════════════════════════════════════════════');
}

// ✅ FUNÇÃO DE FORÇA-SINCRONIZAÇÃO: Chamar manualmente se algo ficar dessincronizado
function forceSync() {
    console.log('🔴 FORÇA-SINCRONIZAÇÃO MANUAL ACIONADA!');
    console.log('   Estado ANTES:');
    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
        console.log(`   - ${emissora.emissora}: checkbox=${checkbox?.checked}, oculta=${proposalData.ocultasEmissoras.has(emissora.id)}`);
    });
    
    syncCheckboxState();
    updateStats();
    renderCharts();
    
    console.log('   Estado DEPOIS:');
    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);
        console.log(`   - ${emissora.emissora}: checkbox=${checkbox?.checked}, oculta=${proposalData.ocultasEmissoras.has(emissora.id)}`);
    });
    
    alert('✅ Sincronização forçada realizada! Verifique o console para detalhes.');
}

// =====================================================
// UTILITÁRIOS
// =====================================================

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function showError(message) {
    console.error('❌', message);
    alert(`Erro: ${message}`);
}

function goBack() {
    window.history.back();
}

window.addEventListener('resize', () => {
    Object.values(charts).forEach(chart => {
        if (chart) chart.resize();
    });
});
