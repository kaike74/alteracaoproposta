// =====================================================
// PROPOSTA DE MÍDIA - JavaScript (MÚLTIPLAS EMISSORAS)
// =====================================================

let proposalData = {
    tableId: null,
    emissoras: [],  // Array de emissoras
    changes: {}
};

// Definição de todos os produtos disponíveis
const PRODUTOS = [
    { key: 'spots30', label: 'Spots 30"', tabelaKey: 'valorTabela30', negKey: 'valorNegociado30' },
    { key: 'spots60', label: 'Spots 60"', tabelaKey: 'valorTabela60', negKey: 'valorNegociado60' },
    { key: 'spotsBlitz', label: 'Blitz', tabelaKey: 'valorTabelaBlitz', negKey: 'valorNegociadoBlitz' },
    { key: 'spots15', label: 'Spots 15"', tabelaKey: 'valorTabela15', negKey: 'valorNegociado15' },
    { key: 'spots5', label: 'Spots 5"', tabelaKey: 'valorTabela5', negKey: 'valorNegociado5' },
    { key: 'spotsTest60', label: 'Test 60"', tabelaKey: 'valorTabelaTest60', negKey: 'valorNegociadoTest60' },
    { key: 'spotsFlash30', label: 'Flash 30"', tabelaKey: 'valorTabelaFlash30', negKey: 'valorNegociadoFlash30' },
    { key: 'spotsFlash60', label: 'Flash 60"', tabelaKey: 'valorTabelaFlash60', negKey: 'valorNegociadoFlash60' },
    { key: 'spotsMensham30', label: 'Mensham 30"', tabelaKey: 'valorTabelaMensham30', negKey: 'valorNegociadoMensham30' },
    { key: 'spotsMensham60', label: 'Mensham 60"', tabelaKey: 'valorTabelaMensham60', negKey: 'valorNegociadoMensham60' }
];

let charts = {
    investment: null,
    impacts: null
};

// Função de debug visual
function addDebug(message) {
    console.log(message);
    const debugPanel = document.getElementById('debugPanel');
    const debugContent = document.getElementById('debugContent');
    if (debugPanel && debugContent) {
        debugPanel.style.display = 'block';
        const line = document.createElement('div');
        line.textContent = message;
        line.style.marginBottom = '5px';
        debugContent.appendChild(line);
    }
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
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
    addDebug('🚀 Iniciando carregamento...');
    addDebug(`📌 ID da tabela: ${tableId}`);
    
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
    const finalUrl = `${baseUrl}?id=${tableId}`;
    
    addDebug(`📡 URL final: ${finalUrl}`);
    
    try {
        const response = await fetch(finalUrl);
        
        addDebug(`📊 Status HTTP: ${response.status}`);
        addDebug(`✅ OK: ${response.ok}`);
        
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            addDebug(`❌ Erro: ${JSON.stringify(errorBody)}`);
            throw new Error(`Erro ao carregar dados: ${response.status}`);
        }

        const data = await response.json();
        addDebug(`📦 Dados tipo: ${typeof data}`);
        addDebug(`📦 Dados é array? ${Array.isArray(data)}`);
        addDebug(`📦 Dados tem .error? ${'error' in data}`);
        addDebug(`📦 Dados completo: ${JSON.stringify(data).substring(0, 500)}`);
        
        // Se recebeu erro, mostrar
        if (data.error) {
          addDebug(`❌ API retornou erro: ${data.error}`);
          addDebug(`📋 Debug info: ${JSON.stringify(data.debug || {})}`);
          throw new Error(`Erro da API: ${data.error}`);
        }
        
        addDebug(`📊 É array? ${Array.isArray(data)}`);
        addDebug(`📊 Tamanho: ${Array.isArray(data) ? data.length : 'N/A'}`);
        
        if (Array.isArray(data) && data.length > 0) {
            addDebug(`✅ Processando ${data.length} emissoras`);
            addDebug(`📋 Primeiro item chaves: ${Object.keys(data[0]).join(', ')}`);
            addDebug(`📋 Primeiro emissora: ${data[0].emissora || 'SEM NOME'}`);
            
            // Log detalhado dos nomes dos campos
            addDebug('');
            addDebug('🔍 NOMES EXATOS DOS CAMPOS:');
            const firstRecord = data[0];
            Object.keys(firstRecord).sort().forEach(key => {
                const value = firstRecord[key];
                addDebug(`  "${key}": ${JSON.stringify(value).substring(0, 50)}`);
            });
            addDebug('');
            
            proposalData.emissoras = data.map(row => ({
                id: row.id,
                emissora: row.emissora || '',
                praca: row.praca || '',
                dial: row.dial || '',
                uf: row.uf || '',
                
                // Spots 30"
                spots30: parseFloat(row.spots30) || 0,
                valorTabela30: parseFloat(row.valorTabela30) || 0,
                valorNegociado30: parseFloat(row.valorNegociado30) || 0,
                
                // Spots 60"
                spots60: parseFloat(row.spots60) || 0,
                valorTabela60: parseFloat(row.valorTabela60) || 0,
                valorNegociado60: parseFloat(row.valorNegociado60) || 0,
                
                // Blitz
                spotsBlitz: parseFloat(row.spotsBlitz) || 0,
                valorTabelaBlitz: parseFloat(row.valorTabelaBlitz) || 0,
                valorNegociadoBlitz: parseFloat(row.valorNegociadoBlitz) || 0,
                
                // Spots 15"
                spots15: parseFloat(row.spots15) || 0,
                valorTabela15: parseFloat(row.valorTabela15) || 0,
                valorNegociado15: parseFloat(row.valorNegociado15) || 0,
                
                // Spots 5"
                spots5: parseFloat(row.spots5) || 0,
                valorTabela5: parseFloat(row.valorTabela5) || 0,
                valorNegociado5: parseFloat(row.valorNegociado5) || 0,
                
                // Test 60"
                spotsTest60: parseFloat(row.spotsTest60) || 0,
                valorTabelaTest60: parseFloat(row.valorTabelaTest60) || 0,
                valorNegociadoTest60: parseFloat(row.valorNegociadoTest60) || 0,
                
                // Flash 30"
                spotsFlash30: parseFloat(row.spotsFlash30) || 0,
                valorTabelaFlash30: parseFloat(row.valorTabelaFlash30) || 0,
                valorNegociadoFlash30: parseFloat(row.valorNegociadoFlash30) || 0,
                
                // Flash 60"
                spotsFlash60: parseFloat(row.spotsFlash60) || 0,
                valorTabelaFlash60: parseFloat(row.valorTabelaFlash60) || 0,
                valorNegociadoFlash60: parseFloat(row.valorNegociadoFlash60) || 0,
                
                // Mensham 30"
                spotsMensham30: parseFloat(row.spotsMensham30) || 0,
                valorTabelaMensham30: parseFloat(row.valorTabelaMensham30) || 0,
                valorNegociadoMensham30: parseFloat(row.valorNegociadoMensham30) || 0,
                
                // Mensham 60"
                spotsMensham60: parseFloat(row.spotsMensham60) || 0,
                valorTabelaMensham60: parseFloat(row.valorTabelaMensham60) || 0,
                valorNegociadoMensham60: parseFloat(row.valorNegociadoMensham60) || 0
            }));
            
            addDebug(`✅ ${proposalData.emissoras.length} emissoras carregadas com sucesso!`);
        } else {
            addDebug('⚠️ Array vazio ou inválido');
            throw new Error('Nenhuma emissora encontrada');
        }
    } catch (error) {
        addDebug(`❌ Erro na função: ${error.message}`);
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
    console.log('🎨 Renderizando interface...');
    
    // Atualizar título com a primeira emissora como referência
    const firstEmissora = proposalData.emissoras[0];
    document.getElementById('proposalTitle').textContent = firstEmissora ? firstEmissora.emissora : 'Proposta de Mídia';
    document.getElementById('locationInfo').textContent = firstEmissora ? `${firstEmissora.uf}` : '';
    
    renderSpotsTable();
    updateStats();
    renderCharts();
}

function renderSpotsTable() {
    const tbody = document.getElementById('spotsTableBody');
    addDebug(`🔍 Procurando tbody: ${tbody ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
    if (!tbody) {
        addDebug('❌ Elemento spotsTableBody não encontrado!');
        return;
    }
    
    addDebug(`📊 Renderizando ${proposalData.emissoras.length} emissoras`);
    tbody.innerHTML = '';
    
    // Renderizar cada emissora como um grupo
    proposalData.emissoras.forEach((emissora, index) => {
        // Header com info da emissora
        const headerRow = document.createElement('tr');
        headerRow.className = 'emissora-header-row';
        headerRow.innerHTML = `
            <td colspan="6" style="background: #f3f4f6; font-weight: bold; padding: 12px; border-top: 2px solid #6366f1;">
                📻 ${emissora.emissora} | 📍 ${emissora.praca} | 📡 ${emissora.dial || 'N/A'}
            </td>
        `;
        tbody.appendChild(headerRow);
        addDebug(`  ✅ Emissora renderizada: ${emissora.emissora}`);
        
        // Linhas de produtos
        let produtosRenderizados = 0;
        PRODUTOS.forEach(produto => {
            const spots = emissora[produto.key] || 0;
            const valorTabela = emissora[produto.tabelaKey] || 0;
            const valorNegociado = emissora[produto.negKey] || 0;
            
            // Verificar se o produto foi selecionado (qualquer valor > 0)
            const temSelecionado = spots > 0 || valorTabela > 0 || valorNegociado > 0;
            
            if (!temSelecionado) return; // Pular produtos não selecionados
            
            produtosRenderizados++;
            
            const invTabela = spots * valorTabela;
            const invNegociado = spots * valorNegociado;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${produto.label}</strong></td>
                <td>
                    <input 
                        type="number" 
                        value="${spots}" 
                        onchange="updateEmissora(${index}, '${produto.key}', this.value)"
                        class="input-spots"
                        min="0"
                    >
                </td>
                <td class="value-cell">R$ ${valorTabela.toFixed(2)}</td>
                <td class="value-cell">R$ ${invTabela.toFixed(2)}</td>
                <td>
                    <input 
                        type="number" 
                        value="${valorNegociado.toFixed(2)}" 
                        onchange="updateEmissora(${index}, '${produto.negKey}', this.value)"
                        class="input-valor"
                        min="0"
                        step="0.01"
                    >
                </td>
                <td class="value-cell">R$ ${invNegociado.toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
        
        addDebug(`  📦 Produtos renderizados: ${produtosRenderizados}`);
    });
    
    addDebug(`✅ Tabela renderizada com sucesso!`);
}

function updateStats() {
    const totalInvTabela = calculateTotalInvestimentoTabela();
    const totalInvNegociado = calculateTotalInvestimentoNegociado();
    const totalSpots = calculateTotalSpots();
    const cpm = calculateCPM();
    
    document.getElementById('statTotalSpots').textContent = totalSpots;
    document.getElementById('statTabelaValue').textContent = formatCurrency(totalInvTabela);
    document.getElementById('statNegociadoValue').textContent = formatCurrency(totalInvNegociado);
    document.getElementById('statCPM').textContent = `R$ ${cpm.toFixed(2)}`;
    document.getElementById('statEconomia').textContent = formatCurrency(totalInvTabela - totalInvNegociado);
}

function renderCharts() {
    console.log('📊 Renderizando gráficos...');
    
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    renderInvestmentChart();
    renderSpotTypesChart();
}

function renderInvestmentChart() {
    const ctx = document.getElementById('investmentChart').getContext('2d');
    
    const labels = ['Tabela', 'Negociado'];
    const data = [
        calculateTotalInvestimentoTabela(),
        calculateTotalInvestimentoNegociado()
    ];
    
    charts.investment = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ef4444', '#10b981'],
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

function renderSpotTypesChart() {
    const ctx = document.getElementById('spotsChart');
    if (!ctx) return;
    
    const canvasCtx = ctx.getContext('2d');
    
    const labels = [];
    const data = [];
    
    proposalData.emissoras.forEach(emissora => {
        PRODUTOS.forEach(produto => {
            const spots = emissora[produto.key] || 0;
            if (spots > 0) {
                labels.push(`${emissora.emissora} - ${produto.label}`);
                data.push(spots);
            }
        });
    });
    
    if (charts.impacts) {
        charts.impacts.destroy();
    }
    
    charts.impacts = new Chart(canvasCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantidade de Spots',
                data: data,
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderColor: '#6366f1',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// =====================================================
// CÁLCULOS
// =====================================================

function calculateTotalSpots() {
    return proposalData.emissoras.reduce((total, emissora) => {
        return total + PRODUTOS.reduce((subtotal, produto) => {
            return subtotal + (emissora[produto.key] || 0);
        }, 0);
    }, 0);
}

function calculateTotalInvestimentoTabela() {
    return proposalData.emissoras.reduce((total, emissora) => {
        return total + PRODUTOS.reduce((subtotal, produto) => {
            const spots = emissora[produto.key] || 0;
            const valor = emissora[produto.tabelaKey] || 0;
            return subtotal + (spots * valor);
        }, 0);
    }, 0);
}

function calculateTotalInvestimentoNegociado() {
    return proposalData.emissoras.reduce((total, emissora) => {
        return total + PRODUTOS.reduce((subtotal, produto) => {
            const spots = emissora[produto.key] || 0;
            const valor = emissora[produto.negKey] || 0;
            return subtotal + (spots * valor);
        }, 0);
    }, 0);
}

function calculateCPM() {
    const totalSpots = calculateTotalSpots();
    const totalInvestimento = calculateTotalInvestimentoNegociado();
    
    if (totalSpots === 0 || totalInvestimento === 0) return 0;
    return (totalInvestimento / totalSpots) * 1000;
}

// =====================================================
// EDIÇÃO E ATUALIZAÇÃO
// =====================================================

function updateEmissora(index, field, value) {
    const emissora = proposalData.emissoras[index];
    if (!emissora) return;
    
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
    updateStats();
    renderCharts();
    showUnsavedChanges();
}

function showUnsavedChanges() {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.style.display = Object.keys(proposalData.changes).length > 0 ? 'block' : 'none';
    }
}

// =====================================================
// SALVAR ALTERAÇÕES
// =====================================================

async function saveChanges() {
    if (Object.keys(proposalData.changes).length === 0) {
        alert('Nenhuma alteração para salvar!');
        return;
    }
    
    console.log('💾 Salvando alterações...', proposalData.changes);
    
    const changeCount = Object.keys(proposalData.changes).length;
    const confirmSave = confirm(`Deseja salvar ${changeCount} alteração(ões)?`);
    
    if (!confirmSave) return;
    
    try {
        const apiUrl = getApiUrl();
        const dataToSave = {
            tableId: proposalData.tableId,
            emissoras: proposalData.emissoras,
            changes: proposalData.changes
        };
        
        const response = await fetch(`${apiUrl}?id=${proposalData.tableId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao salvar');
        }
        
        const result = await response.json();
        console.log('✅ Alterações salvas!', result);
        
        proposalData.changes = {};
        showUnsavedChanges();
        
        alert('✅ Proposta atualizada com sucesso no Notion!');
    } catch (error) {
        console.error('❌ Erro:', error);
        alert(`Erro ao salvar: ${error.message}`);
    }
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
