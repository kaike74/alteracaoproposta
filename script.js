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
            
            // Usar os dados diretamente do Notion, sem transformação
            proposalData.emissoras = data;
            
            addDebug(`✅ ${proposalData.emissoras.length} emissoras carregadas com sucesso!`);
            addDebug(`✅ Primeira emissora: ${proposalData.emissoras[0].emissora}`);
            addDebug(`✅ Primeira emissora spots30: ${proposalData.emissoras[0].spots30}`);
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
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 📍 INICIANDO: renderInterface()');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('proposalData.emissoras:', proposalData.emissoras);
    console.log('proposalData.emissoras.length:', proposalData.emissoras ? proposalData.emissoras.length : 'UNDEFINED');
    
    console.log('🎨 Renderizando interface...');
    console.log('📊 Emissoras disponíveis:', proposalData.emissoras.length);
    
    // Atualizar título com a primeira emissora como referência
    const firstEmissora = proposalData.emissoras[0];
    console.log('🏢 Primeira emissora:', firstEmissora);
    document.getElementById('proposalTitle').textContent = firstEmissora ? firstEmissora.emissora : 'Proposta de Mídia';
    document.getElementById('locationInfo').textContent = firstEmissora ? `${firstEmissora.uf}` : '';
    
    console.log('🎯 Chamando renderSpotsTable...');
    renderSpotsTable();
    console.log('🎯 Chamando updateStats...');
    updateStats();
    console.log('🎯 Chamando renderCharts...');
    renderCharts();
    console.log('✅ renderInterface() finalizado!');
}

function renderSpotsTable() {
    console.log('\n🎯🎯🎯 renderSpotsTable() INICIADA 🎯🎯🎯');
    
    const tbody = document.getElementById('spotsTableBody');
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 📍 INICIANDO: renderSpotsTable()');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('✅ Procurando tbody #spotsTableBody...');
    console.log('✅ tbody encontrado?', !!tbody);
    console.log('✅ proposalData:', proposalData);
    console.log('✅ proposalData.emissoras:', proposalData.emissoras);
    console.log('✅ proposalData.emissoras.length:', proposalData.emissoras.length);
    
    if (!tbody) {
        console.error('❌ CRÍTICO: Elemento spotsTableBody não encontrado no DOM!');
        return;
    }
    
    if (!proposalData.emissoras || proposalData.emissoras.length === 0) {
        console.error('❌ CRÍTICO: proposalData.emissoras vazio ou indefinido!');
        return;
    }
    
    console.log('✅ Iniciando limpeza e preenchimento da tabela...');
    tbody.innerHTML = '';
    
    let totalLinhasAdicionadas = 0;
    
    // Renderizar cada emissora + cada produto como uma linha
    proposalData.emissoras.forEach((emissora, emissoraIndex) => {
        console.log(`\n📍 Processando emissora ${emissoraIndex}: ${emissora.emissora}`);
        
        // Renderizar cada produto para essa emissora
        PRODUTOS.forEach((produto, produtoIndex) => {
            // Puxar valores diretos do objeto emissora (vindo do Notion)
            const spots = emissora[produto.key] || 0;
            const valorTabela = emissora[produto.tabelaKey] || 0;
            const valorNegociado = emissora[produto.negKey] || 0;
            
            const invTabela = spots * valorTabela;
            const invNegociado = spots * valorNegociado;
            
            console.log(`  📦 ${produto.label}: spots=${spots}, tab=${valorTabela}, neg=${valorNegociado}`);
            
            const rowId = `row-${emissoraIndex}-${produtoIndex}`;
            const checkboxId = `check-${emissoraIndex}-${produtoIndex}`;
            
            const row = document.createElement('tr');
            row.id = rowId;
            row.className = 'spots-data-row';
            row.innerHTML = `
                <td>
                    <input 
                        type="checkbox" 
                        id="${checkboxId}"
                        checked
                        onchange="updateRowSelection()"
                        style="cursor: pointer;"
                    >
                </td>
                <td>${emissora.uf || '-'}</td>
                <td>${emissora.praca || '-'}</td>
                <td><strong>${emissora.emissora || '-'}</strong></td>
                <td><strong>${produto.label}</strong></td>
                <td>
                    <input 
                        type="number" 
                        value="${spots}" 
                        onchange="updateEmissora(${emissoraIndex}, '${produto.key}', this.value)"
                        class="input-spots"
                        min="0"
                        step="1"
                        style="width: 70px; padding: 4px; text-align: center;"
                    >
                </td>
                <td class="value-cell">R$ ${valorTabela.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="value-cell">R$ ${valorNegociado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="value-cell investment-tabela">R$ ${invTabela.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="value-cell investment-negociado">R$ ${invNegociado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            `;
            tbody.appendChild(row);
            totalLinhasAdicionadas++;
        });
    });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Tabela renderizada com sucesso! ${totalLinhasAdicionadas} linhas adicionadas`);
    console.log('═══════════════════════════════════════════════════════════');
    updateStats();
}

function updateStats() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 📍 INICIANDO: updateStats()');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('✅ Iniciando cálculos...');
    
    const totalInvTabela = calculateTotalInvestimentoTabela();
    const totalInvNegociado = calculateTotalInvestimentoNegociado();
    const totalSpots = calculateTotalSpots();
    const cpm = calculateCPM();
    const economia = totalInvTabela - totalInvNegociado;
    
    console.log('📊 Total Spots:', totalSpots);
    console.log('💰 Total Investimento Tabela:', totalInvTabela);
    console.log('💰 Total Investimento Negociado:', totalInvNegociado);
    console.log('📈 CPM:', cpm);
    console.log('💵 Economia:', economia);
    
    const statTotalSpots = document.getElementById('statTotalSpots');
    const statTabelaValue = document.getElementById('statTabelaValue');
    const statNegociadoValue = document.getElementById('statNegociadoValue');
    const statCPM = document.getElementById('statCPM');
    const statEconomia = document.getElementById('statEconomia');
    
    console.log('🔍 Elementos encontrados:', {
        statTotalSpots: !!statTotalSpots,
        statTabelaValue: !!statTabelaValue,
        statNegociadoValue: !!statNegociadoValue,
        statCPM: !!statCPM,
        statEconomia: !!statEconomia
    });
    
    if (statTotalSpots) statTotalSpots.textContent = totalSpots;
    if (statTabelaValue) statTabelaValue.textContent = formatCurrency(totalInvTabela);
    if (statNegociadoValue) statNegociadoValue.textContent = formatCurrency(totalInvNegociado);
    if (statCPM) statCPM.textContent = `R$ ${cpm.toFixed(2)}`;
    if (statEconomia) statEconomia.textContent = formatCurrency(economia);
    
    console.log('✅ Estatísticas atualizadas!\n');
}

function renderCharts() {
    console.log('📊 Renderizando gráficos...');
    
    try {
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        renderInvestmentChart();
        renderSpotTypesChart();
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
    
    const labels = ['Tabela', 'Negociado'];
    const data = [
        calculateTotalInvestimentoTabela(),
        calculateTotalInvestimentoNegociado()
    ];
    
    charts.investment = new Chart(canvasCtx, {
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
    renderSpotsTable();
    updateStats();
}

function updateRowSelection() {
    // Função chamada quando um checkbox é marcado/desmarcado
    // Recalcula os totais baseado nas linhas selecionadas
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
