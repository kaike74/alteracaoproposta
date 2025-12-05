// =====================================================
// PROPOSTA DE MÍDIA - JavaScript (MÚLTIPLAS EMISSORAS)
// Build: 2025-11-19
// =====================================================

let proposalData = {
    tableId: null,
    proposalName: 'Proposta',  // Nome da proposta carregada da base de dados
    parentPageId: null,  // ID da página pai (parent page)
    emissoras: [],  // Array de emissoras
    changes: {},
    ocultasEmissoras: new Set(),  // Rastreia emissoras ocultas (por ID)
    initialOcultasEmissoras: new Set(),  // Estado inicial para detectar mudanças
    changedEmissoras: new Set(),  // Rastreia quais emissoras tiveram mudanças no status "Excluir"
    temMidia: false,  // Se tem produtos de Mídia Avulsa
    temPatrocinio: false,  // Se tem produtos de Patrocínio
    editorEmail: null,  // Email do editor que está fazendo as alterações
    availableProducts: {  // Produtos disponíveis carregados da base de dados
        midia: [],
        patrocinio: []
    }
};

// Flag para ignorar o próximo evento de checkbox (evita double trigger)
let ignoreNextCheckboxChange = false;

// Estado inicial dos totais (para comparação)
let initialStats = {
    investimentoTabela: 0,
    investimentoNegociado: 0,
    impactos: 0,
    descontoMedio: 0,
    cpm: 0,
    captured: false  // Flag para controlar se já foi capturado
};

// Flag para controlar se houve alguma mudança (para mostrar/ocultar comparações)
let hasChanges = false;


// Definição de todos os produtos disponíveis
const PRODUTOS = [
    // MÍDIA AVULSA
    { key: 'spots30', label: 'Spots 30"', type: 'midia', tabelaKey: 'valorTabela30', negKey: 'valorNegociado30' },
    { key: 'spots60', label: 'Spots 60"', type: 'midia', tabelaKey: 'valorTabela60', negKey: 'valorNegociado60' },
    { key: 'spotsBlitz', label: 'Blitz', type: 'midia', tabelaKey: 'valorTabelaBlitz', negKey: 'valorNegociadoBlitz' },
    { key: 'spots15', label: 'Spots 15"', type: 'midia', tabelaKey: 'valorTabela15', negKey: 'valorNegociado15' },
    { key: 'spots5', label: 'Spots 5"', type: 'midia', tabelaKey: 'valorTabela5', negKey: 'valorNegociado5' },
    { key: 'spotsTest30', label: 'Test 30"', type: 'midia', tabelaKey: 'valorTabelaTest30', negKey: 'valorNegociadoTest30' },
    { key: 'spotsTest60', label: 'Test 60"', type: 'midia', tabelaKey: 'valorTabelaTest60', negKey: 'valorNegociadoTest60' },
    { key: 'spotsFlash30', label: 'Flash 30"', type: 'midia', tabelaKey: 'valorTabelaFlash30', negKey: 'valorNegociadoFlash30' },
    { key: 'spotsFlash60', label: 'Flash 60"', type: 'midia', tabelaKey: 'valorTabelaFlash60', negKey: 'valorNegociadoFlash60' },
    { key: 'spotsMensham30', label: 'Mensham 30"', type: 'midia', tabelaKey: 'valorTabelaMensham30', negKey: 'valorNegociadoMensham30' },
    { key: 'spotsMensham60', label: 'Mensham 60"', type: 'midia', tabelaKey: 'valorTabelaMensham60', negKey: 'valorNegociadoMensham60' },
    
    // PATROCÍNIO
    { key: 'ins5', label: 'Ins 5"', type: 'patrocinio', quantidadeKey: 'ins5', tabelaKey: 'valorTabelaCota', negKey: 'valorNegociadoCota', isInsertion: true },
    { key: 'ins15', label: 'Ins 15"', type: 'patrocinio', quantidadeKey: 'ins15', tabelaKey: 'valorTabelaCota', negKey: 'valorNegociadoCota', isInsertion: true },
    { key: 'ins30', label: 'Ins 30"', type: 'patrocinio', quantidadeKey: 'ins30', tabelaKey: 'valorTabelaCota', negKey: 'valorNegociadoCota', isInsertion: true },
    { key: 'ins60', label: 'Ins 60"', type: 'patrocinio', quantidadeKey: 'ins60', tabelaKey: 'valorTabelaCota', negKey: 'valorNegociadoCota', isInsertion: true }
];

let charts = {
    investment: null
};

// =====================================================
// GERENCIAMENTO DE HISTÓRICO DE ALTERAÇÕES
// =====================================================

const HISTORY_STORAGE_KEY_PREFIX = 'proposal_history_';

function getHistoryStorageKey() {
    // Usa o nome da proposta para criar uma chave única
    const proposalKey = proposalData.proposalName ? proposalData.proposalName.replace(/\s+/g, '_') : 'default';
    return HISTORY_STORAGE_KEY_PREFIX + proposalKey;
}

function loadHistoryFromStorage() {
    const key = getHistoryStorageKey();
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
}

function saveHistoryToStorage(history) {
    const key = getHistoryStorageKey();
    localStorage.setItem(key, JSON.stringify(history));
}

function addToHistory(emissoraNome, campo, valorAnterior, novoValor) {
    const history = loadHistoryFromStorage();
    const now = new Date();
    const dataHora = now.toLocaleString('pt-BR');
    
    const entry = {
        dataHora,
        timestamp: now.getTime(),
        emissora: emissoraNome,
        campo,
        valorAnterior,
        novoValor
    };
    
    history.push(entry);
    saveHistoryToStorage(history);
    // renderHistoryTable(); // Desativado - histórico removido do site
}

function renderHistoryTable() {
    const history = loadHistoryFromStorage();
    const tbody = document.getElementById('historyTableBody');
    
    if (!tbody) return;
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #999; padding: 20px;">
                    Nenhuma alteração registrada ainda
                </td>
            </tr>
        `;
        return;
    }
    
    // Ordenar histórico por timestamp decrescente (mais recente primeiro)
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
    
    tbody.innerHTML = sorted.map((entry, index) => `
        <tr>
            <td style="font-size: 0.9rem; color: #666;">${entry.dataHora}</td>
            <td style="font-weight: 600; color: #06055b;">${entry.emissora}</td>
            <td style="color: #333;">${entry.campo}</td>
            <td style="color: #ef4444; font-weight: 500;">${entry.valorAnterior}</td>
            <td style="color: #10b981; font-weight: 600;">${entry.novoValor}</td>
        </tr>
    `).join('');
}

function clearHistory() {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
        const key = getHistoryStorageKey();
        localStorage.removeItem(key);
        // renderHistoryTable(); // Desativado - histórico removido do site
    }
}

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

// Função de debug visual - removida
// Todos os debugs agora vão apenas para console


// =====================================================
// INICIALIZAÇÃO
// =====================================================

// Script carregado

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const params = new URLSearchParams(window.location.search);
        proposalData.tableId = params.get('id');

        if (!proposalData.tableId) {
            showWelcomeMessage();
            throw new Error('Nenhuma tabela selecionada. Aguardando ID da tabela na URL.');
        }

        await loadProposalFromNotion(proposalData.tableId);
        updateProposalTitle();
        renderInterface();
    } catch (error) {
        //console.error('Erro ao carregar proposta:', error);
        showError(error.message);
    }
});

function showWelcomeMessage() {
    // Redirecionar automaticamente para https://emidiastec.com.br
    //console.log('⚠️ Nenhum ID de proposta fornecido. Redirecionando para emidiastec.com.br...');
    window.location.href = 'https://emidiastec.com.br';
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
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
    const finalUrl = `${baseUrl}?id=${tableId}`;
    
    try {
        const response = await fetch(finalUrl);
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar dados: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(`Erro da API: ${data.error}`);
        }
        
        let emissoras = Array.isArray(data) ? data : (data.emissoras || []);
        let ocultasEmissoras = data.ocultasEmissoras || [];
        let proposalName = data.proposalName || 'Proposta';
        let parentPageId = data.parentPageId || null;
        let availableProducts = data.availableProducts || { midia: [], patrocinio: [] };
        let temMidia = data.temMidia || false;
        let temPatrocinio = data.temPatrocinio || false;

        if (Array.isArray(emissoras) && emissoras.length > 0) {
            proposalData.emissoras = emissoras;
            proposalData.proposalName = proposalName;
            proposalData.parentPageId = parentPageId;
            proposalData.temMidia = temMidia;
            proposalData.temPatrocinio = temPatrocinio;
            proposalData.availableProducts = availableProducts;
            proposalData.ocultasEmissoras = new Set(ocultasEmissoras);
            proposalData.initialOcultasEmissoras = new Set(ocultasEmissoras);
            recalculateAllImpactos();
        } else {
            throw new Error('Nenhuma emissora encontrada');
        }
    } catch (error) {
        //console.error('Erro ao carregar proposta:', error);
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

function updateProposalTitle() {
    const titleElement = document.getElementById('proposalTitle');
    
    if (titleElement && proposalData.proposalName) {
        titleElement.textContent = proposalData.proposalName;
        document.title = `${proposalData.proposalName} - E-MÍDIAS`;
    }
}

function renderInterface() {
    let proposalName = proposalData.proposalName || 'Proposta de Mídia';

    if (proposalData.emissoras && proposalData.emissoras.length > 0) {
        const firstEmissora = proposalData.emissoras[0];

        if (firstEmissora.proposta && firstEmissora.proposta.trim()) {
            proposalName = firstEmissora.proposta;
        } else if (firstEmissora.empresa && firstEmissora.empresa.trim()) {
            proposalName = firstEmissora.empresa;
        } else {
            proposalName = firstEmissora.emissora || 'Proposta de Mídia';
        }
    }

    const locationInfo = document.getElementById('locationInfo');
    if (locationInfo && locationInfo.parentElement) {
        locationInfo.parentElement.style.display = 'none';
    }

    renderSpotsTable();
    updateStats();
    renderCharts();
    showUnsavedChanges();

    // Capturar estado inicial APÓS primeiro updateStats (mas não mostrar comparações ainda)
    captureInitialStats();
}

function renderSpotsTable() {
    const tbody = document.getElementById('spotsTableBody');
    const table = document.getElementById('spotsTable');
    
    if (!tbody || !table) {
        //console.error('Elementos da tabela não encontrados');
        return;
    }
    
    if (!proposalData.emissoras || proposalData.emissoras.length === 0) {
        //console.error('Nenhuma emissora disponível');
        return;
    }
    
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
    
    const temPatrocinioAtivo = proposalData.emissoras.some(e => e.cotasMeses > 0);
    
    // RECONSTRÓI os cabeçalhos da tabela
    const thead = table.querySelector('thead');
    if (thead) {
        thead.innerHTML = '';
        const headerRow = document.createElement('tr');
        
        // Cabeçalhos fixos
        headerRow.innerHTML = `
            <th>✓</th>
            <th>Região</th>
            <th>Praça</th>
            <th>Emissora</th>
        `;
        
        // Cabeçalhos dinâmicos por produto de MÍDIA AVULSA
        produtosAtivos.forEach(produtoKey => {
            const produto = PRODUTOS.find(p => p.key === produtoKey && p.type === 'midia');
            if (produto) {
                headerRow.innerHTML += `
                    <th colspan="2" style="text-align: center; border-bottom: 2px solid var(--primary);">
                        ${produto.label}
                    </th>
                `;
            }
        });
        
        // Cabeçalhos para PATROCÍNIO se existir
        if (temPatrocinioAtivo) {
            headerRow.innerHTML += `
                <th>Cotas / Meses</th>
            `;
            
            // Inserções
            const insercoes = ['ins5', 'ins15', 'ins30', 'ins60'];
            insercoes.forEach(insKey => {
                const ins = PRODUTOS.find(p => p.key === insKey);
                if (ins) {
                    headerRow.innerHTML += `
                        <th>${ins.label}</th>
                    `;
                }
            });
            
            headerRow.innerHTML += `
                <th>Valor Tabela por Cota</th>
                <th>Valor Negociado por Cota</th>
            `;
        }
        
        // Colunas finais de investimento e impactos
        headerRow.innerHTML += `
            <th>Inv. Tabela</th>
            <th>Inv. Negociado</th>
            <th>Desconto médio</th>
            <th>Impactos</th>
            <th>CPM</th>
        `;
        
        thead.appendChild(headerRow);
    }
    
    // LIMPA o tbody completamente
    tbody.innerHTML = '';
    
    let totalLinhasAdicionadas = 0;
    
    // Renderiza uma linha por emissora
    proposalData.emissoras.forEach((emissora, emissoraIndex) => {
        //console.log(`📍 Processando emissora ${emissoraIndex}: ${emissora.emissora}`);
        
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
        
        //console.log(`  Logo URL para ${emissora.emissora}: ${logoUrl}`);
        
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
                ${logoUrl ? `<img src="${logoUrl}" alt="${emissora.emissora}" class="emissora-logo" onerror="//console.error('Erro ao carregar logo de ${emissora.emissora}')">` : ''}
                <span class="emissora-name"><strong>${emissora.emissora || '-'}</strong></span>
            </td>
        `;
        
        // Colunas dinâmicas por produto de MÍDIA AVULSA
        //console.log(`  🔍 Emissora ${emissora.emissora} - Produtos ativos:`, Array.from(produtosAtivos));
        produtosAtivos.forEach(produtoKey => {
            const produto = PRODUTOS.find(p => p.key === produtoKey && p.type === 'midia');
            if (produto) {
                const spots = emissora[produto.key] || 0;
                const valorTabela = emissora[produto.tabelaKey] || 0;
                const valorNegociado = emissora[produto.negKey] || 0;
                
                //console.log(`     - ${produto.label}: ${spots} spots × R$ ${valorTabela} = R$ ${spots * valorTabela}`);
                
                // CALCULA O INVESTIMENTO PARA MÍDIA AVULSA
                investimentoTabelaEmissora += spots * valorTabela;
                investimentoNegociadoEmissora += spots * valorNegociado;
                
                row.innerHTML += `
                    <td class="spots-cell">
                        <input
                            type="number"
                            value="${spots}"
                            onchange="updateEmissora(${emissoraIndex}, '${produto.key}', this.value)"
                            class="input-spots"
                            min="0"
                            step="1"
                            style="padding: 4px; text-align: center;"
                        >
                    </td>
                    <td class="product-value-negociado">R$ ${valorNegociado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                `;
            }
        });
        
        // Colunas para PATROCÍNIO se existir
        if (temPatrocinioAtivo) {
            const cotasMeses = emissora.cotasMeses || 0;
            const valorTabelaCota = emissora.valorTabelaCota || 0;
            const valorNegociadoCota = emissora.valorNegociadoCota || 0;
            
            //console.log(`📋 PATROCÍNIO - Emissora ${emissoraIndex} (${emissora.emissora}):`);
            //console.log(`   - cotasMeses: ${cotasMeses}`);
            //console.log(`   - valorTabelaCota: ${valorTabelaCota}`);
            //console.log(`   - valorNegociadoCota: ${valorNegociadoCota}`);
            //console.log(`   - ins5: ${emissora.ins5}, ins15: ${emissora.ins15}, ins30: ${emissora.ins30}, ins60: ${emissora.ins60}`);
            
            // Investimento Patrocínio
            const invTabePatrocinio = cotasMeses * valorTabelaCota;
            const invNegPatrocinio = cotasMeses * valorNegociadoCota;
            
            //console.log(`   - Inv. Tabela Patrocínio: ${invTabePatrocinio}`);
            //console.log(`   - Inv. Negociado Patrocínio: ${invNegPatrocinio}`);
            
            investimentoTabelaEmissora += invTabePatrocinio;
            investimentoNegociadoEmissora += invNegPatrocinio;
            
            row.innerHTML += `
                <td class="spots-cell">
                    <input
                        type="number"
                        value="${cotasMeses}"
                        onchange="updateEmissora(${emissoraIndex}, 'cotasMeses', this.value)"
                        class="input-spots"
                        min="0"
                        step="1"
                        style="padding: 4px; text-align: center;"
                    >
                </td>
            `;

            // Inserções (SOMENTE LEITURA - não podem ser editadas)
            const insercoes = ['ins5', 'ins15', 'ins30', 'ins60'];
            insercoes.forEach(insKey => {
                const ins = emissora[insKey] || 0;
                row.innerHTML += `
                    <td class="spots-cell">
                        <input
                            type="number"
                            value="${ins}"
                            readonly
                            class="input-spots"
                            style="padding: 4px; text-align: center; background-color: #f0f0f0; cursor: not-allowed;"
                        >
                    </td>
                `;
            });
            
            row.innerHTML += `
                <td class="product-value-negociado">R$ ${valorTabelaCota.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="product-value-negociado">R$ ${valorNegociadoCota.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            `;
        }
        
        // Colunas de investimento
        const descontoMedio = investimentoTabelaEmissora > 0
            ? ((investimentoTabelaEmissora - investimentoNegociadoEmissora) / investimentoTabelaEmissora) * 100
            : 0;

        const cpm = (emissora.impactos || 0) > 0
            ? (investimentoNegociadoEmissora / (emissora.impactos || 1)) * 1000
            : 0;

        row.innerHTML += `
            <td class="investment-tabela">R$ ${investimentoTabelaEmissora.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="investment-negociado">R$ ${investimentoNegociadoEmissora.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="desconto-cell">
                ${descontoMedio.toFixed(0)}%
            </td>
            <td class="impactos-cell">
                ${(emissora.impactos || 0).toLocaleString('pt-BR')}
            </td>
            <td class="cpm-cell">
                R$ ${cpm.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
        `;
        
        tbody.appendChild(row);
        totalLinhasAdicionadas++;
    });

    // Adicionar linha de total discreta
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.style.borderTop = '2px solid var(--emidias-medium-gray)';

    // Calcular totais apenas das emissoras SELECIONADAS (não ocultas)
    let totalInvTabela = 0;
    let totalInvNegociado = 0;
    let totalImpactos = 0;
    let totalEmissorasSelecionadas = 0;

    proposalData.emissoras.forEach(emissora => {
        if (!proposalData.ocultasEmissoras.has(emissora.id)) {
            totalEmissorasSelecionadas++;

            // Calcular investimento de mídia avulsa
            produtosAtivos.forEach(produtoKey => {
                const produto = PRODUTOS.find(p => p.key === produtoKey && p.type === 'midia');
                if (produto) {
                    const spots = emissora[produto.key] || 0;
                    const valorTabela = emissora[produto.tabelaKey] || 0;
                    const valorNegociado = emissora[produto.negKey] || 0;
                    totalInvTabela += spots * valorTabela;
                    totalInvNegociado += spots * valorNegociado;
                }
            });

            // Calcular investimento de patrocínio
            if (temPatrocinioAtivo) {
                const cotasMeses = emissora.cotasMeses || 0;
                const valorTabelaCota = emissora.valorTabelaCota || 0;
                const valorNegociadoCota = emissora.valorNegociadoCota || 0;
                totalInvTabela += cotasMeses * valorTabelaCota;
                totalInvNegociado += cotasMeses * valorNegociadoCota;
            }

            totalImpactos += emissora.impactos || 0;
        }
    });

    // Montar linha de total
    // Primeira célula com "Emissoras: X"
    let totalCells = `<td colspan="${4 + (produtosAtivos.size * 2)}" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray); padding-left: 16px;">
        Emissoras: ${totalEmissorasSelecionadas}
    </td>`;

    // Se tem patrocínio, adiciona mais colunas vazias
    if (temPatrocinioAtivo) {
        totalCells += `<td colspan="${7}"></td>`; // cotasMeses + ins5 + ins15 + ins30 + ins60 + valorTabela + valorNeg
    }

    // Calcular desconto médio e CPM totais
    const descontoMedioTotal = totalInvTabela > 0
        ? ((totalInvTabela - totalInvNegociado) / totalInvTabela) * 100
        : 0;

    const cpmTotal = totalImpactos > 0
        ? (totalInvNegociado / totalImpactos) * 1000
        : 0;

    totalRow.innerHTML = `
        ${totalCells}
        <td class="investment-tabela" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">R$ ${totalInvTabela.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        <td class="investment-negociado" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">R$ ${totalInvNegociado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        <td class="desconto-cell" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">
            ${descontoMedioTotal.toFixed(0)}%
        </td>
        <td class="impactos-cell" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">
            ${totalImpactos.toLocaleString('pt-BR')}
        </td>
        <td class="cpm-cell" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">
            R$ ${cpmTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </td>
    `;

    tbody.appendChild(totalRow);

    //console.log('═══════════════════════════════════════════════════════════');
}

// Função para atualizar apenas a linha de total (sem re-renderizar toda a tabela)
function updateTotalRow() {
    const produtosAtivos = new Set();
    proposalData.emissoras.forEach(emissora => {
        PRODUTOS.forEach(produto => {
            const spots = emissora[produto.key] || 0;
            if (spots > 0) {
                produtosAtivos.add(produto.key);
            }
        });
    });

    const temPatrocinioAtivo = proposalData.emissoras.some(e => e.cotasMeses > 0);

    // Calcular totais apenas das emissoras SELECIONADAS (não ocultas)
    let totalInvTabela = 0;
    let totalInvNegociado = 0;
    let totalImpactos = 0;
    let totalEmissorasSelecionadas = 0;

    proposalData.emissoras.forEach(emissora => {
        if (!proposalData.ocultasEmissoras.has(emissora.id)) {
            totalEmissorasSelecionadas++;

            // Calcular investimento de mídia avulsa
            produtosAtivos.forEach(produtoKey => {
                const produto = PRODUTOS.find(p => p.key === produtoKey && p.type === 'midia');
                if (produto) {
                    const spots = emissora[produto.key] || 0;
                    const valorTabela = emissora[produto.tabelaKey] || 0;
                    const valorNegociado = emissora[produto.negKey] || 0;
                    totalInvTabela += spots * valorTabela;
                    totalInvNegociado += spots * valorNegociado;
                }
            });

            // Calcular investimento de patrocínio
            if (temPatrocinioAtivo) {
                const cotasMeses = emissora.cotasMeses || 0;
                const valorTabelaCota = emissora.valorTabelaCota || 0;
                const valorNegociadoCota = emissora.valorNegociadoCota || 0;
                totalInvTabela += cotasMeses * valorTabelaCota;
                totalInvNegociado += cotasMeses * valorNegociadoCota;
            }

            totalImpactos += emissora.impactos || 0;
        }
    });

    // Calcular desconto médio e CPM totais
    const descontoMedioTotal = totalInvTabela > 0
        ? ((totalInvTabela - totalInvNegociado) / totalInvTabela) * 100
        : 0;

    const cpmTotal = totalImpactos > 0
        ? (totalInvNegociado / totalImpactos) * 1000
        : 0;

    // Encontrar a linha de total existente e atualizar
    const totalRow = document.querySelector('.total-row');
    if (totalRow) {
        // Montar linha de total
        let totalCells = `<td colspan="${4 + (produtosAtivos.size * 2)}" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray); padding-left: 16px;">
            Emissoras: ${totalEmissorasSelecionadas}
        </td>`;

        // Se tem patrocínio, adiciona mais colunas vazias
        if (temPatrocinioAtivo) {
            totalCells += `<td colspan="${7}"></td>`;
        }

        totalRow.innerHTML = `
            ${totalCells}
            <td class="investment-tabela" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">R$ ${totalInvTabela.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="investment-negociado" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">R$ ${totalInvNegociado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="desconto-cell" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">
                ${descontoMedioTotal.toFixed(0)}%
            </td>
            <td class="impactos-cell" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">
                ${totalImpactos.toLocaleString('pt-BR')}
            </td>
            <td class="cpm-cell" style="font-weight: 400; font-size: 0.8rem; color: var(--emidias-dark-gray);">
                R$ ${cpmTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
        `;
    }
}

function captureInitialStats() {
    // Só captura se ainda não foi capturado
    if (initialStats.captured) {
        return;
    }

    //console.log('📸 Capturando estado inicial para comparação (primeira mudança)...');

    // Calcula o investimento total das emissoras selecionadas
    let totalInvestimentoTabela = 0;
    let totalInvestimentoNegociado = 0;
    let totalImpactos = 0;

    proposalData.emissoras.forEach((emissora, index) => {
        const checkbox = document.querySelector(`input[type="checkbox"][data-emissora-index="${index}"]`);

        if (checkbox && checkbox.checked) {
            PRODUTOS.forEach(produto => {
                if (produto.type === 'midia') {
                    const spots = emissora[produto.key] || 0;
                    if (spots > 0) {
                        const valorTabela = emissora[produto.tabelaKey] || 0;
                        const valorNegociado = emissora[produto.negKey] || 0;

                        totalInvestimentoTabela += spots * valorTabela;
                        totalInvestimentoNegociado += spots * valorNegociado;
                    }
                }
            });

            if (emissora.cotasMeses > 0) {
                const invTabePatrocinio = (emissora.cotasMeses || 0) * (emissora.valorTabelaCota || 0);
                const invNegPatrocinio = (emissora.cotasMeses || 0) * (emissora.valorNegociadoCota || 0);
                totalInvestimentoTabela += invTabePatrocinio;
                totalInvestimentoNegociado += invNegPatrocinio;
            }

            const impactosValue = emissora.impactos || 0;
            const impactosNum = typeof impactosValue === 'string'
                ? parseFloat(impactosValue.replace('.', '').replace(',', '.')) || 0
                : impactosValue;
            totalImpactos += impactosNum;
        }
    });

    // Calcular desconto médio
    const descontoMedioCard = totalInvestimentoTabela > 0
        ? ((totalInvestimentoTabela - totalInvestimentoNegociado) / totalInvestimentoTabela) * 100
        : 0;

    // Calcular CPM
    const cpmCard = totalImpactos > 0
        ? (totalInvestimentoNegociado / totalImpactos) * 1000
        : 0;

    // Salvar no objeto initialStats
    initialStats.investimentoTabela = totalInvestimentoTabela;
    initialStats.investimentoNegociado = totalInvestimentoNegociado;
    initialStats.impactos = totalImpactos;
    initialStats.descontoMedio = descontoMedioCard;
    initialStats.cpm = cpmCard;
    initialStats.captured = true;  // Marcar como capturado

    //console.log('✅ Estado inicial capturado:', initialStats);
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
    //console.log('\n╔════════════════════════════════════════════════════════════════╗');
    //console.log('║ 📍 INICIANDO: updateStats()');
    //console.log('╚════════════════════════════════════════════════════════════════╝');
    //console.log('✅ Iniciando cálculos apenas das emissoras SELECIONADAS...');
    
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
                // Diferencia cálculo para MÍDIA e PATROCÍNIO
                if (produto.type === 'midia') {
                    // MÍDIA: spots × valor por spot
                    const spots = emissora[produto.key] || 0;
                    if (spots > 0) {
                        const valorTabela = emissora[produto.tabelaKey] || 0;
                        const valorNegociado = emissora[produto.negKey] || 0;
                        
                        totalInvestimentoTabela += spots * valorTabela;
                        totalInvestimentoNegociado += spots * valorNegociado;
                        totalSpots += spots;
                    }
                } else if (produto.type === 'patrocinio') {
                    // PATROCÍNIO: contar inserções para total de spots
                    const inseracoes = emissora[produto.quantidadeKey] || 0;
                    if (inseracoes > 0) {
                        totalSpots += inseracoes;
                    }
                }
            });
            
            // Para Patrocínio, adicionar o investimento já calculado na tabela
            if (emissora.cotasMeses > 0) {
                const invTabePatrocinio = (emissora.cotasMeses || 0) * (emissora.valorTabelaCota || 0);
                const invNegPatrocinio = (emissora.cotasMeses || 0) * (emissora.valorNegociadoCota || 0);
                totalInvestimentoTabela += invTabePatrocinio;
                totalInvestimentoNegociado += invNegPatrocinio;
            }
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
    
    //console.log('📊 Total Spots:', totalSpots);
    //console.log('💰 Total Investimento Tabela:', totalInvestimentoTabela);
    //console.log('💰 Total Investimento Negociado:', totalInvestimentoNegociado);
    //console.log('📈 Total Impactos:', totalImpactos);
    //console.log('💵 Economia (R$):', economia);
    //console.log('💵 Desconto (%):', percentualDesconto);
    
    const statTabelaValue = document.getElementById('statTabelaValue');
    const statNegociadoValue = document.getElementById('statNegociadoValue');
    const statTotalImpacts = document.getElementById('statTotalImpacts');
    const statDescontoMedio = document.getElementById('statDescontoMedio');
    const statCPM = document.getElementById('statCPM');

    // Calcular Desconto médio: ((Tabela - Negociado) / Tabela) * 100
    const descontoMedioCard = totalInvestimentoTabela > 0
        ? ((totalInvestimentoTabela - totalInvestimentoNegociado) / totalInvestimentoTabela) * 100
        : 0;

    // Calcular CPM: (Investimento Negociado / Impactos) * 1000
    const cpmCard = totalImpactos > 0
        ? (totalInvestimentoNegociado / totalImpactos) * 1000
        : 0;

    //console.log('🔍 Elementos encontrados:', {
        statTabelaValue: !!statTabelaValue,
        statNegociadoValue: !!statNegociadoValue,
        statTotalImpacts: !!statTotalImpacts,
        statDescontoMedio: !!statDescontoMedio,
        statCPM: !!statCPM
    });

    if (statTabelaValue) statTabelaValue.textContent = formatCurrencyCompact(totalInvestimentoTabela);
    if (statNegociadoValue) statNegociadoValue.textContent = formatCurrencyCompact(totalInvestimentoNegociado);
    if (statTotalImpacts) statTotalImpacts.textContent = formatNumberCompact(totalImpactos);
    if (statDescontoMedio) statDescontoMedio.textContent = descontoMedioCard.toFixed(0) + '%';
    if (statCPM) statCPM.textContent = formatCurrency(cpmCard);

    // Atualizar linhas de comparação (antes/depois)
    updateComparisonLines(totalInvestimentoTabela, totalInvestimentoNegociado, totalImpactos, descontoMedioCard, cpmCard);

    // Atualizar lista de produtos ativos
    updateActiveProducts();

    // Atualizar tabela comparativa "Sua Proposta" - Desativado
    // updateComparisonTable(totalInvestimentoNegociado, totalInvestimentoTabela);

    //console.log('✅ Estatísticas atualizadas!\n');
}

function updateComparisonLines(currentTabela, currentNegociado, currentImpactos, currentDesconto, currentCPM) {
    // Se não houve mudanças ainda, não mostrar comparações
    if (!hasChanges) {
        //console.log('⏭️ Nenhuma mudança ainda, pulando comparações...');
        return;
    }

    // Se o estado inicial ainda não foi capturado, não mostrar comparações
    if (!initialStats.captured) {
        //console.log('⏭️ Estado inicial não capturado, pulando comparações...');
        return;
    }

    //console.log('📊 Atualizando linhas de comparação...');

    // Função auxiliar para formatar a diferença
    function formatDiff(initial, current, type) {
        const diff = current - initial;

        // Se não há diferença, ocultar
        if (Math.abs(diff) < 0.01) {
            return { text: '', show: false };
        }

        const arrow = diff > 0 ? '↑' : '↓';
        let diffText = '';
        let colorClass = 'neutral';

        switch (type) {
            case 'currency': // Valor Tabela, Valor Negociado
                const percentChange = initial !== 0 ? ((diff / initial) * 100) : 0;
                diffText = `${arrow} ${diff > 0 ? '+' : '-'} ${formatCurrency(Math.abs(diff))} (${Math.abs(percentChange).toFixed(0)}%)`;
                colorClass = 'neutral';
                break;

            case 'impacts': // Impactos
                diffText = `${arrow} ${diff > 0 ? '+' : ''}${formatNumberCompact(diff)}`;
                colorClass = diff > 0 ? 'positive' : 'negative';
                break;

            case 'percentage': // Desconto médio
                diffText = `${arrow} ${diff > 0 ? '+' : ''}${Math.abs(diff).toFixed(0)}%`;
                colorClass = 'neutral';
                break;

            case 'cpm': // CPM
                diffText = `${arrow} ${diff > 0 ? '+' : ''}${formatCurrency(diff)}`;
                colorClass = diff > 0 ? 'negative' : 'positive'; // Aumentar CPM é ruim (vermelho), diminuir é bom (verde)
                break;
        }

        return { text: diffText, show: true, colorClass };
    }

    // Atualizar cada stat-diff
    const statTabelaDiff = document.getElementById('statTabelaDiff');
    const statNegociadoDiff = document.getElementById('statNegociadoDiff');
    const statImpactsDiff = document.getElementById('statImpactsDiff');
    const statDescontoDiff = document.getElementById('statDescontoDiff');
    const statCPMDiff = document.getElementById('statCPMDiff');

    // Valor Tabela
    if (statTabelaDiff) {
        const diff = formatDiff(initialStats.investimentoTabela, currentTabela, 'currency');
        statTabelaDiff.textContent = diff.text;
        statTabelaDiff.style.display = diff.show ? 'block' : 'none';
        statTabelaDiff.className = `stat-diff ${diff.colorClass}`;
    }

    // Valor Negociado
    if (statNegociadoDiff) {
        const diff = formatDiff(initialStats.investimentoNegociado, currentNegociado, 'currency');
        statNegociadoDiff.textContent = diff.text;
        statNegociadoDiff.style.display = diff.show ? 'block' : 'none';
        statNegociadoDiff.className = `stat-diff ${diff.colorClass}`;
    }

    // Impactos
    if (statImpactsDiff) {
        const diff = formatDiff(initialStats.impactos, currentImpactos, 'impacts');
        statImpactsDiff.textContent = diff.text;
        statImpactsDiff.style.display = diff.show ? 'block' : 'none';
        statImpactsDiff.className = `stat-diff ${diff.colorClass}`;
    }

    // Desconto médio
    if (statDescontoDiff) {
        const diff = formatDiff(initialStats.descontoMedio, currentDesconto, 'percentage');
        statDescontoDiff.textContent = diff.text;
        statDescontoDiff.style.display = diff.show ? 'block' : 'none';
        statDescontoDiff.className = `stat-diff ${diff.colorClass}`;
    }

    // CPM
    if (statCPMDiff) {
        const diff = formatDiff(initialStats.cpm, currentCPM, 'cpm');
        statCPMDiff.textContent = diff.text;
        statCPMDiff.style.display = diff.show ? 'block' : 'none';
        statCPMDiff.className = `stat-diff ${diff.colorClass}`;
    }

    //console.log('✅ Linhas de comparação atualizadas!');
}

function updateComparisonTable(negociado, tabela) {
    // Obtém os elementos da tabela
    const compNegociado = document.getElementById('compNegociado');
    const compNegociadoAtual = document.getElementById('compNegociadoAtual');
    const compTabela = document.getElementById('compTabela');
    const compTabelaAtual = document.getElementById('compTabelaAtual');

    // Valor anterior (sempre 0 ou pode vir de proposalData se existir dados anteriores)
    const negociadoAnterior = proposalData.negociadoAnterior || 0;
    const tabelaAnterior = proposalData.tabelaAnterior || 0;

    // Atualiza os valores
    if (compNegociado) compNegociado.textContent = formatCurrency(negociadoAnterior);
    if (compNegociadoAtual) compNegociadoAtual.textContent = formatCurrency(negociado);
    if (compTabela) compTabela.textContent = formatCurrency(tabelaAnterior);
    if (compTabelaAtual) compTabelaAtual.textContent = formatCurrency(tabela);
}

function renderCharts() {
    //console.log('📊 Renderizando gráficos...');
    
    try {
        // Destroi os gráficos antigos se existirem
        if (charts.investment) {
            // charts.investment.destroy(); // Desativado - gráfico removido do site
            // charts.investment = null;
        }
        
        // renderInvestmentChart(); // Desativado - gráfico removido do site
        //console.log('✅ Estatísticas renderizadas com sucesso!');
    } catch (error) {
        //console.error('⚠️ Erro ao renderizar gráficos (não crítico):', error);
    }
}

function renderInvestmentChart() {
    const ctx = document.getElementById('investmentChart');
    if (!ctx) {
        //console.warn('⚠️ Elemento investmentChart não encontrado');
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
    
    //console.log('📊 Gráfico investimento - Tabela:', totalTabela, 'Negociado:', totalNegociado);
    
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
    //console.log('  ↳ getSelectedRows() chamada');
    // Retorna array de checkboxes selecionados
    const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]:checked');
    //console.log('  ↳ Checkboxes selecionados:', checkboxes.length);
    return checkboxes;
}

function calculateTotalSpots() {
    //console.log('  ↳ calculateTotalSpots() chamada');
    let total = 0;
    getSelectedRows().forEach(checkbox => {
        const row = checkbox.closest('tr');
        const input = row.querySelector('input[type="number"]');
        if (input) {
            total += parseFloat(input.value) || 0;
        }
    });
    //console.log('  ↳ Total spots calculado:', total);
    return total;
}

function calculateTotalInvestimentoTabela() {
    //console.log('  ↳ calculateTotalInvestimentoTabela() chamada');
    let total = 0;
    getSelectedRows().forEach(checkbox => {
        const row = checkbox.closest('tr');
        const investCell = row.querySelector('.investment-tabela');
        if (investCell) {
            const value = investCell.textContent.replace('R$ ', '').replace(',', '.');
            total += parseFloat(value) || 0;
        }
    });
    //console.log('  ↳ Total investimento tabela calculado:', total);
    return total;
}

function calculateTotalInvestimentoNegociado() {
    //console.log('  ↳ calculateTotalInvestimentoNegociado() chamada');
    let total = 0;
    getSelectedRows().forEach(checkbox => {
        const row = checkbox.closest('tr');
        const investCell = row.querySelector('.investment-negociado');
        if (investCell) {
            const value = investCell.textContent.replace('R$ ', '').replace(',', '.');
            total += parseFloat(value) || 0;
        }
    });
    //console.log('  ↳ Total investimento negociado calculado:', total);
    return total;
}

function calculateCPM() {
    //console.log('  ↳ calculateCPM() chamada');
    const totalSpots = calculateTotalSpots();
    const totalInvestimento = calculateTotalInvestimentoNegociado();
    
    //console.log('  ↳ CPM: spots=', totalSpots, 'investimento=', totalInvestimento);
    
    if (totalSpots === 0 || totalInvestimento === 0) return 0;
    return (totalInvestimento / totalSpots) * 1000;
}

// =====================================================
// CÁLCULO DINÂMICO DE IMPACTOS
// =====================================================
// Fórmula: (Spots30 * PMM) + (Test60 * PMM * 2) + (Spots60 * PMM * 2) + (Spots15 * PMM / 2) + (Spots5 * PMM / 6)

function calculateImpactosForEmissora(emissora) {
    /**
     * Calcula impactos dinamicamente usando as fórmulas exatas do Notion:
     * 
     * MÍDIA AVULSA:
     * (Spots30 * PMM) + (Test60 * PMM * 2) + (Spots60 * PMM * 2) + (Spots15 * PMM / 2) + (Spots5 * PMM / 6)
     * 
     * PATROCÍNIO:
     * ((Ins30 * PMM) + (Ins60 * PMM * 2) + (Ins15 * PMM / 2) + (Ins5 * PMM / 6)) * CotasMeses
     */
    
    if (!emissora) return 0;
    
    const pmm = emissora.PMM || parseFloat(emissora.PMM) || 0;
    
    // MÍDIA AVULSA - Spots
    const spots30 = parseFloat(emissora.spots30) || 0;
    const test60 = parseFloat(emissora.spotsTest60) || 0;  // Test 60ʺ
    const spots60 = parseFloat(emissora.spots60) || 0;
    const spots15 = parseFloat(emissora.spots15) || 0;
    const spots5 = parseFloat(emissora.spots5) || 0;
    
    // PATROCÍNIO - Inserções e Cotas
    const ins5 = parseFloat(emissora.ins5) || 0;
    const ins15 = parseFloat(emissora.ins15) || 0;
    const ins30 = parseFloat(emissora.ins30) || 0;
    const ins60 = parseFloat(emissora.ins60) || 0;
    const cotasMeses = parseFloat(emissora.cotasMeses) || 0;
    
    // Aplicar a fórmula para MÍDIA AVULSA
    const impactosMedia = 
        (spots30 * pmm) +
        (test60 * pmm * 2) +
        (spots60 * pmm * 2) +
        (spots15 * pmm / 2) +
        (spots5 * pmm / 6);
    
    // Aplicar a fórmula para PATROCÍNIO
    // ((Ins30 * PMM) + (Ins60 * PMM * 2) + (Ins15 * PMM / 2) + (Ins5 * PMM / 6)) * CotasMeses
    const impactosPatrocinio = 
        ((ins30 * pmm) + (ins60 * pmm * 2) + (ins15 * pmm / 2) + (ins5 * pmm / 6)) * cotasMeses;
    
    // Soma total de impactos (mídia + patrocínio)
    const impactos = impactosMedia + impactosPatrocinio;
    
    return Math.round(impactos); // Arredondar para inteiro
}

function recalculateAllImpactos() {
    /**
     * Recalcula impactos para TODAS as emissoras
     * Deve ser chamado sempre que um spot ou PMM muda
     */
    //console.log('🔄 Recalculando impactos para todas as emissoras...');
    
    proposalData.emissoras.forEach((emissora, index) => {
        const impactosAntigos = emissora.impactos;
        emissora.impactos = calculateImpactosForEmissora(emissora);
        
        if (impactosAntigos !== emissora.impactos) {
            //console.log(`   📊 Emissora ${index} (${emissora.emissora}): ${impactosAntigos} → ${emissora.impactos}`);
        }
    });
    
    //console.log('✅ Impactos recalculados!');
}

// =====================================================
// EDIÇÃO E ATUALIZAÇÃO
// =====================================================

function updateEmissora(index, field, value) {
    //console.log(`🔴 UPDATE: index=${index}, field=${field}, value=${value}`);

    // Marcar que houve mudança (para mostrar comparações)
    hasChanges = true;

    const emissora = proposalData.emissoras[index];
    if (!emissora) {
        //console.error('❌ Emissora não encontrada:', index);
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

    //console.log(`📝 Emissora ${index} - ${field}: ${oldValue} → ${newValue}`);
    //console.log('📊 Changes agora:', proposalData.changes);

    // Recalcular impactos se foi alterado um campo de spot ou PMM
    const spotFields = ['spots30', 'spots60', 'spotsBlitz', 'spots15', 'spots5', 'spotsTest30', 'spotsTest60', 'spotsFlash30', 'spotsFlash60', 'spotsMensham30', 'spotsMensham60', 'PMM'];
    if (spotFields.includes(field)) {
        //console.log(`   📊 Campo ${field} alterado - recalculando impactos...`);
        recalculateAllImpactos();
    }

    // NÃO chama renderSpotsTable, apenas atualiza estatísticas e gráficos
    updateStats();
    updateTotalRow(); // Atualizar linha de total
    renderCharts();

    // Mostrar botão de salvar quando há alterações
    showUnsavedChanges();
}

function updateRowSelection() {
    // Função chamada quando um checkbox é marcado/desmarcado
    // Recalcula os totais baseado nas linhas selecionadas
    //console.log('📝 Linha selecionada/desmarcada');
    updateStats();
    renderCharts();
    
    // Marcar como alteração - seleção de linhas também é uma mudança!
    showUnsavedChanges();
}

function toggleOcultarEmissora(checkbox) {
    // Se a flag está ativa, ignora este evento e desativa a flag
    if (ignoreNextCheckboxChange) {
        //console.log('⏭️ Ignorando evento de checkbox (double trigger prevention)');
        ignoreNextCheckboxChange = false;
        return;
    }

    // Marcar que houve mudança (para mostrar comparações)
    hasChanges = true;

    const emissoraId = checkbox.getAttribute('data-emissora-id');
    const emissoraIndex = parseInt(checkbox.getAttribute('data-emissora-index'));
    const emissora = proposalData.emissoras[emissoraIndex];

    //console.log(`🔄 Alternando ocultamento de emissora: ${emissoraId}, marcado: ${checkbox.checked}`);
    
    if (checkbox.checked) {
        // Marcar = REMOVER da lista (quando está marcado, mostra na proposta)
        // Se está marcado agora, significa que estava desmarcado antes (estava oculto)
        // Então precisamos removê-lo da lista de ocultos
        
        // Fazer a mudança IMEDIATAMENTE
        proposalData.ocultasEmissoras.delete(emissoraId);
        proposalData.changedEmissoras.add(emissoraId);
        
        // Atualizar visual da linha
        const row = document.getElementById(`emissora-row-${emissoraId}`);
        if (row) {
            row.classList.remove('emissora-oculta');
        }
        
        // Atualizar estatísticas
        updateStats();
        updateTotalRow(); // Atualizar linha de total
        renderCharts();

        // Mostrar botão de salvar
        showUnsavedChanges();

        //console.log(`✅ Emissora ${emissora?.emissora || emissoraId} ADICIONADA (será restaurada no Notion)`);
        //console.log(`📊 Emissoras ocultas agora:`, Array.from(proposalData.ocultasEmissoras));
    } else {
        // Desmarcar = ADICIONAR à lista (quando está desmarcado, fica oculto na proposta)
        // Se está desmarcado agora, significa que estava marcado antes (estava visível)
        // Então precisamos adicioná-lo à lista de ocultos

        // Fazer a mudança IMEDIATAMENTE (sem pop-up)
        proposalData.ocultasEmissoras.add(emissoraId);
        proposalData.changedEmissoras.add(emissoraId);

        // Atualizar visual da linha
        const row = document.getElementById(`emissora-row-${emissoraId}`);
        if (row) {
            row.classList.add('emissora-oculta');
        }

        // Atualizar estatísticas
        updateStats();
        updateTotalRow(); // Atualizar linha de total
        renderCharts();

        // Mostrar botão de salvar
        showUnsavedChanges();

        //console.log(`✅ Emissora ${emissora?.emissora || emissoraId} REMOVIDA (será excluída no Notion)`);
        //console.log(`📊 Emissoras ocultas agora:`, Array.from(proposalData.ocultasEmissoras));
    }
}
// =====================================================
// SALVAR ALTERAÇÕES
// =====================================================

async function saveChanges() {
    //console.log('🔴 CLICOU EM SALVAR!');
    //console.log('📊 proposalData.changes:', proposalData.changes);
    //console.log('📊 Número de mudanças:', Object.keys(proposalData.changes).length);
    //console.log('👤 Emissoras ocultas:', proposalData.ocultasEmissoras.size);
    //console.log('👤 Emissoras alteradas:', proposalData.changedEmissoras.size);
    
    const temMudancas = Object.keys(proposalData.changes).length > 0;
    const temMudancasEmissoras = proposalData.changedEmissoras.size > 0;
    
    if (!temMudancas && !temMudancasEmissoras) {
        //console.warn('⚠️ Nenhuma alteração para salvar!');
        alert('Nenhuma alteração para salvar!');
        return;
    }
    
    //console.log('💾 Abrindo modal para capturar email...');
    
    // Mostrar modal de email
    const emailModal = document.getElementById('emailModal');
    emailModal.style.display = 'flex';
}

function showConfirmModal() {
    //console.log('%c🎯 PRÓXIMO PASSO: CLIQUE NO BOTÃO "CONFIRMAR" NO MODAL!', 'color: #dc2626; background: #fef2f2; padding: 10px 15px; font-size: 14px; font-weight: bold; border-radius: 5px;');
    //console.log('📋 Abrindo modal de confirmação...');
    
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
    
    //console.log('✅ Modal aberto com sucesso!');
}

function closeEmailModal() {
    //console.log('❌ Fechando modal de email');
    document.getElementById('emailModal').style.display = 'none';
    document.getElementById('editorEmail').value = '';
}

function proceedWithEmail() {
    const emailInput = document.getElementById('editorEmail');
    const email = emailInput.value.trim();
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        alert('Por favor, insira um email válido!');
        emailInput.focus();
        return;
    }
    
    //console.log('✅ Email validado:', email);
    
    // Armazenar email no proposalData para usar depois
    proposalData.editorEmail = email;
    
    // Fechar modal de email
    closeEmailModal();
    
    // Abrir modal de confirmação
    showConfirmModal();
}

function closeConfirmModal() {
    //console.log('❌ Fechando modal (editando novamente)');
    document.getElementById('confirmModal').style.display = 'none';
}

// =====================================================
// MODAL DE CONFIRMAÇÃO DE REMOÇÃO
// =====================================================

let pendingRemovalData = null;

function showConfirmRemovalModal(checkbox, emissora, emissoraId) {
    //console.log('📋 Abrindo modal de confirmação de remoção...');
    
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
    //console.log('❌ Cancelando remoção');
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
    //console.log('✅ Confirmando remoção de emissora...');
    
    if (!pendingRemovalData) return;
    
    const { checkbox, emissora, emissoraId } = pendingRemovalData;
    
    // Adicionar à lista de excluídas
    proposalData.ocultasEmissoras.add(emissoraId);
    proposalData.changedEmissoras.add(emissoraId);  // Marcar como alterada
    //console.log(`🗑️ Emissora ${emissoraId} REMOVIDA (marcada para exclusão)`);
    
    // Atualizar visual da linha
    const row = document.getElementById(`emissora-row-${emissoraId}`);
    if (row) {
        row.classList.add('emissora-oculta');
    }
    
    // Atualizar estatísticas
    updateStats();
    renderCharts();
    
    // Marcar como alteração (precisa salvar)
    showUnsavedChanges();
    
    // Fechar modal
    document.getElementById('confirmRemovalModal').style.display = 'none';
    pendingRemovalData = null;
    
    //console.log('📊 Emissoras removidas agora:', Array.from(proposalData.ocultasEmissoras));
}


function showUnsavedChanges() {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        const temMudancas = Object.keys(proposalData.changes).length > 0;
        const temMudancasEmissoras = proposalData.changedEmissoras.size > 0;
        
        const shouldShow = temMudancas || temMudancasEmissoras;
        
        //console.log(`💾 showUnsavedChanges:`);
        //console.log(`   Mudanças em campos: ${temMudancas}`);
        //console.log(`   Mudanças em emissoras: ${temMudancasEmissoras} (${proposalData.changedEmissoras.size})`);
        //console.log(`   Mostrar botão: ${shouldShow}`);
        //console.log(`   Changes: ${JSON.stringify(proposalData.changes)}`);
        //console.log(`   Emissoras alteradas: ${Array.from(proposalData.changedEmissoras)}`);
        
        saveBtn.style.display = shouldShow ? 'block' : 'none';
    } else {
        //console.warn('❌ Botão saveBtn não encontrado!');
    }
}


async function confirmAndSave() {
    //console.log('✅ Confirmando e salvando alterações...');
    
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'none';
    
    try {
        const apiUrl = getApiUrl();
        //console.log('📡 API URL:', apiUrl);
        
        // Sincronizar o estado "Excluir" com o Notion
        const dataToSave = {
            tableId: proposalData.tableId,
            emissoras: proposalData.emissoras,
            changes: proposalData.changes,
            ocultasEmissoras: Array.from(proposalData.ocultasEmissoras),  // Converter Set para Array
            editorEmail: proposalData.editorEmail || 'desconhecido@email.com'  // Incluir email do editor
        };
        
        //console.log('📤 Enviando dados:', dataToSave);
        //console.log('👤 Email do editor:', dataToSave.editorEmail);
        //console.log('👤 Emissoras ocultas:', dataToSave.ocultasEmissoras);
        
        const response = await fetch(`${apiUrl}?id=${proposalData.tableId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        
        //console.log('📥 Response status:', response.status);
        //console.log('📥 Response ok:', response.ok);
        
        if (!response.ok) {
            const error = await response.json();
            //console.error('❌ Erro na resposta:', error);
            //console.error('❌ Erro completo:', JSON.stringify(error, null, 2));
            throw new Error(error.error || error.message || 'Erro ao salvar');
        }
        
        const result = await response.json();
        //console.log('✅ Alterações salvas!', result);
        //console.log('🔍 debugLogs recebido:', result.debugLogs);
        
        // Exibir logs do servidor no console
        if (result.debugLogs && Array.isArray(result.debugLogs)) {
            //console.log('═══════════════════════════════════════════════════════════');
            //console.log('📋 LOGS DO SERVIDOR (Notion.js):');
            //console.log('═══════════════════════════════════════════════════════════');
            result.debugLogs.forEach(log => {
                //console.log(log);
                // Destacar logs de email
                if (log.includes('[EMAIL]')) {
                    //console.warn('%c📧 EMAIL LOG: ' + log, 'color: #ec4899; font-weight: bold; background: #fecdd3; padding: 2px 6px; border-radius: 3px;');
                }
            });
            //console.log('═══════════════════════════════════════════════════════════');
        } else {
            //console.warn('⚠️ debugLogs vazio ou não é array:', result.debugLogs);
        }
        
        // Procurar por logs de email nos debugLogs
        const emailLogs = result.debugLogs ? result.debugLogs.filter(log => log.includes('[EMAIL]')) : [];
        if (emailLogs.length > 0) {
            //console.warn('%c🎯 RESUMO DOS LOGS DE EMAIL:', 'color: #dc2626; font-weight: bold; font-size: 14px;');
            emailLogs.forEach(log => {
                if (log.includes('✅')) {
                    //console.log('%c✅ ' + log, 'color: #10b981; font-weight: bold;');
                } else if (log.includes('❌')) {
                    //console.error('%c❌ ' + log, 'color: #dc2626; font-weight: bold;');
                } else {
                    //console.log('%c📧 ' + log, 'color: #f59e0b; font-weight: bold;');
                }
            });
        } else {
            //console.warn('%c⚠️ NENHUM LOG DE EMAIL ENCONTRADO NOS LOGS DO SERVIDOR', 'color: #f59e0b; font-weight: bold; font-size: 12px;');
        }
        
        // Adicionar alterações ao histórico
        Object.values(proposalData.changes).forEach(change => {
            const emissoraNome = proposalData.emissoras[change.emissoraIndex]?.emissora || 'Desconhecida';
            addToHistory(emissoraNome, change.field, change.old, change.new);
        });
        
        proposalData.changes = {};
        
        // Atualizar estado inicial das emissoras ocultas após salvar
        proposalData.initialOcultasEmissoras = new Set(proposalData.ocultasEmissoras);
        proposalData.changedEmissoras = new Set();  // Limpar emissoras alteradas

        // Limpar linhas de comparação (resetar initialStats)
        clearComparisonLines();

        // Ocultar botão de salvar já que não há mais alterações
        showUnsavedChanges();

        // Mostrar modal de sucesso
        showSuccessModal();
    } catch (error) {
        //console.error('❌ Erro:', error);
        alert(`Erro ao salvar: ${error.message}`);
    }
}

function clearComparisonLines() {
    //console.log('🧹 Limpando linhas de comparação...');

    // Ocultar todos os stat-diff
    const statTabelaDiff = document.getElementById('statTabelaDiff');
    const statNegociadoDiff = document.getElementById('statNegociadoDiff');
    const statImpactsDiff = document.getElementById('statImpactsDiff');
    const statDescontoDiff = document.getElementById('statDescontoDiff');
    const statCPMDiff = document.getElementById('statCPMDiff');

    if (statTabelaDiff) statTabelaDiff.style.display = 'none';
    if (statNegociadoDiff) statNegociadoDiff.style.display = 'none';
    if (statImpactsDiff) statImpactsDiff.style.display = 'none';
    if (statDescontoDiff) statDescontoDiff.style.display = 'none';
    if (statCPMDiff) statCPMDiff.style.display = 'none';

    // Resetar flags
    hasChanges = false;
    initialStats.captured = false;

    // Recapturar estado inicial após salvar
    setTimeout(() => {
        captureInitialStats();
    }, 100);

    //console.log('✅ Linhas de comparação limpas! Flags resetadas.');
}

function showSuccessModal() {
    //console.log('🎉 Mostrando modal de sucesso...');
    const successModal = document.getElementById('successModal');
    successModal.style.display = 'flex';

    // Recarregar página após 3 segundos
    setTimeout(() => {
        //console.log('🔄 Recarregando página...');
        window.location.reload();
    }, 3000);
}

function closeSuccessModal() {
    //console.log('Fechando modal de sucesso');
    document.getElementById('successModal').style.display = 'none';
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

// Formata valores monetários com abreviações (MI e Mil) para cards
function formatCurrencyCompact(value) {
    if (value >= 1000000) {
        // Milhões - usa 2 casas decimais
        const millions = value / 1000000;
        return `R$ ${millions.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MI`;
    } else if (value >= 1000) {
        // Milhares - usa 1 casa decimal
        const thousands = value / 1000;
        return `R$ ${thousands.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mil`;
    } else {
        // Valores menores que 1000 - formato normal
        return formatCurrency(value);
    }
}

// Formata números grandes com abreviações (sem símbolo de moeda)
function formatNumberCompact(value) {
    if (value >= 1000000) {
        const millions = value / 1000000;
        return `${millions.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MI`;
    } else if (value >= 1000) {
        const thousands = value / 1000;
        return `${thousands.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mil`;
    } else {
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
}

function showError(message) {
    //console.error('❌', message);
    alert(`Erro: ${message}`);
}

function goBack() {
    /**
     * Redireciona para a página pai da proposta (parent page)
     * URL: https://hub.emidiastec.com.br/NOME-PROPOSTA-PARENT-PAGE-ID
     * Fallback: https://emidiastec.com.br
     */

    const proposalName = proposalData.proposalName ? proposalData.proposalName.trim().replace(/\s+/g, '-') : '';
    const parentPageId = proposalData.parentPageId || '';

    // Construir URL com parent page ID
    const urlPath = `${proposalName}-${parentPageId}`;

    // URL principal: hub.emidiastec.com.br
    const hubUrl = `https://hub.emidiastec.com.br/${urlPath}`;

    // Fallback: emidiastec.com.br
    const fallbackUrl = 'https://emidiastec.com.br';

    //console.log(`🔗 Redirecionando para página pai: ${hubUrl}`);
    //console.log(`⚠️ Fallback disponível: ${fallbackUrl}`);

    // Verificar se temos os dados necessários
    if (proposalName && parentPageId) {
        // Redirecionar para URL do hub com parent page
        window.location.href = hubUrl;
    } else {
        // Se faltam dados, ir para o fallback
        //console.warn('⚠️ Parent page ID não disponível, redirecionando para fallback');
        window.location.href = fallbackUrl;
    }
}

window.addEventListener('resize', () => {
    Object.values(charts).forEach(chart => {
        if (chart) chart.resize();
    });
});

// =====================================================
// EXPORTAÇÃO PARA EXCEL
// =====================================================

function exportToExcel() {
    //console.log('📊 Iniciando exportação para Excel...');
    
    // Criar workbook XLSX
    const workbook = XLSX.utils.book_new();
    
    // Preparar dados da tabela
    const tableData = [];
    
    // Cabeçalho
    const headers = [
        '✓',
        'Região',
        'Praça',
        'Emissora'
    ];
    
    // Adicionar cabeçalhos dos produtos dinâmicos
    const produtosAtivos = new Set();
    proposalData.emissoras.forEach(emissora => {
        PRODUTOS.forEach(produto => {
            const spots = emissora[produto.key] || 0;
            if (spots > 0) {
                produtosAtivos.add(produto.key);
            }
        });
    });
    
    produtosAtivos.forEach(produtoKey => {
        const produto = PRODUTOS.find(p => p.key === produtoKey && p.type === 'midia');
        if (produto) {
            headers.push(`${produto.label} (Spots)`, `${produto.label} (Valor)`);
        }
    });
    
    // Verificar se tem patrocínio
    const temPatrocinioAtivo = proposalData.emissoras.some(e => e.cotasMeses > 0);
    if (temPatrocinioAtivo) {
        headers.push('Cotas/Meses');
        headers.push('Ins 5"', 'Ins 15"', 'Ins 30"', 'Ins 60"');
        headers.push('Valor Tabela por Cota', 'Valor Negociado por Cota');
    }
    
    // Adicionar colunas finais
    headers.push('Inv. Tabela', 'Inv. Negociado', 'Impactos');
    
    tableData.push(headers);
    
    // Preencher dados das emissoras
    proposalData.emissoras.forEach((emissora) => {
        const row = [
            proposalData.ocultasEmissoras.has(emissora.id) ? '' : '✓',
            emissora.uf || '-',
            emissora.praca || '-',
            emissora.emissora || '-'
        ];
        
        // Produtos dinâmicos
        let investimentoTabelaEmissora = 0;
        let investimentoNegociadoEmissora = 0;
        
        produtosAtivos.forEach(produtoKey => {
            const produto = PRODUTOS.find(p => p.key === produtoKey && p.type === 'midia');
            if (produto) {
                const spots = emissora[produto.key] || 0;
                const valorTabela = emissora[produto.tabelaKey] || 0;
                const valorNegociado = emissora[produto.negKey] || 0;
                
                const invTabela = spots * valorTabela;
                const invNegociado = spots * valorNegociado;
                
                investimentoTabelaEmissora += invTabela;
                investimentoNegociadoEmissora += invNegociado;
                
                row.push(spots);
                row.push(valorNegociado);
            }
        });
        
        // Patrocínio
        if (temPatrocinioAtivo) {
            const cotasMeses = emissora.cotasMeses || 0;
            const valorTabelaCota = emissora.valorTabelaCota || 0;
            const valorNegociadoCota = emissora.valorNegociadoCota || 0;
            
            const invTabePatrocinio = cotasMeses * valorTabelaCota;
            const invNegPatrocinio = cotasMeses * valorNegociadoCota;
            
            investimentoTabelaEmissora += invTabePatrocinio;
            investimentoNegociadoEmissora += invNegPatrocinio;
            
            row.push(cotasMeses);
            row.push(emissora.ins5 || 0);
            row.push(emissora.ins15 || 0);
            row.push(emissora.ins30 || 0);
            row.push(emissora.ins60 || 0);
            row.push(valorTabelaCota);
            row.push(valorNegociadoCota);
        }
        
        // Investimentos e impactos
        row.push(investimentoTabelaEmissora);
        row.push(investimentoNegociadoEmissora);
        row.push(emissora.impactos || 0);
        
        tableData.push(row);
    });
    
    // Adicionar linha de totais
    const totalsRow = ['TOTAL'];
    
    let totalSpots = 0;
    let totalInvTabela = 0;
    let totalInvNegociado = 0;
    let totalImpactos = 0;
    
    proposalData.emissoras.forEach(emissora => {
        if (!proposalData.ocultasEmissoras.has(emissora.id)) {
            // Total de spots
            PRODUTOS.forEach(produto => {
                if (produto.type === 'midia') {
                    totalSpots += emissora[produto.key] || 0;
                } else if (produto.type === 'patrocinio') {
                    totalSpots += emissora[produto.quantidadeKey] || 0;
                }
            });
            
            // Totais de investimento
            let invTabela = 0;
            let invNegociado = 0;
            
            PRODUTOS.forEach(produto => {
                if (produto.type === 'midia') {
                    const spots = emissora[produto.key] || 0;
                    invTabela += spots * (emissora[produto.tabelaKey] || 0);
                    invNegociado += spots * (emissora[produto.negKey] || 0);
                }
            });
            
            if (emissora.cotasMeses > 0) {
                invTabela += (emissora.cotasMeses || 0) * (emissora.valorTabelaCota || 0);
                invNegociado += (emissora.cotasMeses || 0) * (emissora.valorNegociadoCota || 0);
            }
            
            totalInvTabela += invTabela;
            totalInvNegociado += invNegociado;
            totalImpactos += emissora.impactos || 0;
        }
    });
    
    // Preencher totals row com espaços vazios até as colunas de totais
    while (totalsRow.length < headers.length - 3) {
        totalsRow.push('');
    }
    
    totalsRow.push(totalInvTabela);
    totalsRow.push(totalInvNegociado);
    totalsRow.push(totalImpactos);
    
    tableData.push(totalsRow);
    
    // Converter para worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(tableData);
    
    // Ajustar largura das colunas
    worksheet['!cols'] = [
        { wch: 5 },      // ✓
        { wch: 12 },     // Região
        { wch: 15 },     // Praça
        { wch: 20 },     // Emissora
    ];
    
    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proposta');
    
    // Gerar nome do arquivo
    const fileName = `${proposalData.proposalName || 'Proposta'}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
    
    // Salvar arquivo
    XLSX.writeFile(workbook, fileName);
    
    //console.log('✅ Arquivo Excel exportado:', fileName);
}


