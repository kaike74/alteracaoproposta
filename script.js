// =====================================================
// PROPOSTA DE MÍDIA - JavaScript (NOVA VERSÃO)
// =====================================================

let proposalData = {
    id: null,
    region: '',
    uf: '',
    praca: '',
    emissora: '',
    spots: {
        spots30: 0,
        valorTabela30: 0,
        valorNegociado30: 0,
        spots60: 0,
        valorTabela60: 0,
        valorNegociado60: 0,
        spots5: 0,
        valorTabela5: 0,
        valorNegociado5: 0,
        spotsBlitz: 0,
        valorTabelaBlitz: 0,
        valorNegociadoBlitz: 0,
        spotsTest60: 0,
        valorTabelaTest60: 0,
        valorNegociadoTest60: 0
    },
    selected: true,
    changes: {}
};

let charts = {
    investment: null,
    impacts: null
};

// =====================================================
// INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando página de proposta...');
    
    try {
        const params = new URLSearchParams(window.location.search);
        proposalData.id = params.get('id');

        if (!proposalData.id) {
            showWelcomeMessage();
            throw new Error('Nenhuma proposta selecionada. Aguardando ID da proposta na URL.');
        }

        await loadProposalFromNotion(proposalData.id);
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
                    <p style="color: #374151; font-size: 1rem; line-height: 1.6;">
                        ℹ️ Nenhuma proposta foi carregada.<br><br>
                        Para visualizar e editar uma proposta, acesse a URL com o ID:<br><br>
                        <code style="background: white; padding: 10px; border-radius: 6px; display: inline-block; margin: 10px 0;">
                            ?id=SEU_ID_AQUI
                        </code>
                    </p>
                </div>
            </div>
        `;
    }
}

// =====================================================
// CARREGAMENTO DE DADOS
// =====================================================

async function loadProposalFromNotion(notionId) {
    console.log('📡 Carregando proposta do Notion:', notionId);
    console.log('📡 URL atual:', window.location.href);
    console.log('📡 Params recebidos:', new URLSearchParams(window.location.search));
    
    const apiUrl = getApiUrl();
    const finalUrl = `${apiUrl}?id=${notionId}`;
    
    console.log('📡 URL da API:', finalUrl);
    
    const response = await fetch(finalUrl);
    
    console.log('📊 Resposta bruta:', response);
    console.log('📊 Status:', response.status);
    console.log('📊 OK?:', response.ok);
    
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('❌ Erro detalhado:', errorBody);
        throw new Error(`Erro ao carregar dados: ${response.status} - ${errorBody.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Dados recebidos:', data);
    
    proposalData.region = data.region || '';
    proposalData.uf = data.uf || '';
    proposalData.praca = data.praca || '';
    proposalData.emissora = data.emissora || 'Proposta';
    proposalData.selected = data.selected !== false;
    
    proposalData.spots = {
        spots30: data.spots30 || 0,
        valorTabela30: data.valorTabela30 || 0,
        valorNegociado30: data.valorNegociado30 || 0,
        spots60: data.spots60 || 0,
        valorTabela60: data.valorTabela60 || 0,
        valorNegociado60: data.valorNegociado60 || 0,
        spots5: data.spots5 || 0,
        valorTabela5: data.valorTabela5 || 0,
        valorNegociado5: data.valorNegociado5 || 0,
        spotsBlitz: data.spotsBlitz || 0,
        valorTabelaBlitz: data.valorTabelaBlitz || 0,
        valorNegociadoBlitz: data.valorNegociadoBlitz || 0,
        spotsTest60: data.spotsTest60 || 0,
        valorTabelaTest60: data.valorTabelaTest60 || 0,
        valorNegociadoTest60: data.valorNegociadoTest60 || 0
    };
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
    
    document.getElementById('proposalTitle').textContent = proposalData.emissora;
    document.getElementById('locationInfo').textContent = 
        `${proposalData.region} / ${proposalData.uf} / ${proposalData.praca}`;
    
    renderSpotsTable();
    updateStats();
    renderCharts();
}

function renderSpotsTable() {
    const tbody = document.getElementById('spotsTableBody');
    tbody.innerHTML = '';
    
    const spotTypes = [
        { key: 'spots30', label: 'Spots 30"', tabelaKey: 'valorTabela30', negKey: 'valorNegociado30' },
        { key: 'spots60', label: 'Spots 60"', tabelaKey: 'valorTabela60', negKey: 'valorNegociado60' },
        { key: 'spots5', label: 'Spots 5"', tabelaKey: 'valorTabela5', negKey: 'valorNegociado5' },
        { key: 'spotsBlitz', label: 'Blitz', tabelaKey: 'valorTabelaBlitz', negKey: 'valorNegociadoBlitz' },
        { key: 'spotsTest60', label: 'Testemunhal 60"', tabelaKey: 'valorTabelaTest60', negKey: 'valorNegociadoTest60' }
    ];
    
    spotTypes.forEach(type => {
        const spots = proposalData.spots[type.key] || 0;
        const valorTabela = proposalData.spots[type.tabelaKey] || 0;
        const valorNegociado = proposalData.spots[type.negKey] || 0;
        
        if (spots === 0 && valorTabela === 0 && valorNegociado === 0) {
            return;
        }
        
        const investimentoTabela = spots * valorTabela;
        const investimentoNegociado = spots * valorNegociado;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${type.label}</strong></td>
            <td>
                <input 
                    type="number" 
                    value="${spots}" 
                    onchange="updateSpots('${type.key}', this.value)"
                    class="input-spots"
                    min="0"
                >
            </td>
            <td class="value-cell">R$ ${valorTabela.toFixed(2)}</td>
            <td class="value-cell">R$ ${investimentoTabela.toFixed(2)}</td>
            <td>
                <input 
                    type="number" 
                    value="${valorNegociado.toFixed(2)}" 
                    onchange="updateValor('${type.negKey}', this.value)"
                    class="input-valor"
                    min="0"
                    step="0.01"
                >
            </td>
            <td class="value-cell">R$ ${investimentoNegociado.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
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
    const ctx = document.getElementById('spotsChart').getContext('2d');
    
    const spotTypes = [
        { key: 'spots30', label: 'Spots 30"' },
        { key: 'spots60', label: 'Spots 60"' },
        { key: 'spots5', label: 'Spots 5"' },
        { key: 'spotsBlitz', label: 'Blitz' },
        { key: 'spotsTest60', label: 'Test 60"' }
    ];
    
    const labels = [];
    const data = [];
    
    spotTypes.forEach(type => {
        const spots = proposalData.spots[type.key] || 0;
        if (spots > 0) {
            labels.push(type.label);
            data.push(spots);
        }
    });
    
    charts.impacts = new Chart(ctx, {
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
    return (proposalData.spots.spots30 || 0) +
           (proposalData.spots.spots60 || 0) +
           (proposalData.spots.spots5 || 0) +
           (proposalData.spots.spotsBlitz || 0) +
           (proposalData.spots.spotsTest60 || 0);
}

function calculateTotalInvestimentoTabela() {
    const spotTypes = [
        { key: 'spots30', valorKey: 'valorTabela30' },
        { key: 'spots60', valorKey: 'valorTabela60' },
        { key: 'spots5', valorKey: 'valorTabela5' },
        { key: 'spotsBlitz', valorKey: 'valorTabelaBlitz' },
        { key: 'spotsTest60', valorKey: 'valorTabelaTest60' }
    ];
    
    let total = 0;
    spotTypes.forEach(type => {
        const spots = proposalData.spots[type.key] || 0;
        const valor = proposalData.spots[type.valorKey] || 0;
        total += spots * valor;
    });
    
    return total;
}

function calculateTotalInvestimentoNegociado() {
    const spotTypes = [
        { key: 'spots30', valorKey: 'valorNegociado30' },
        { key: 'spots60', valorKey: 'valorNegociado60' },
        { key: 'spots5', valorKey: 'valorNegociado5' },
        { key: 'spotsBlitz', valorKey: 'valorNegociadoBlitz' },
        { key: 'spotsTest60', valorKey: 'valorNegociadoTest60' }
    ];
    
    let total = 0;
    spotTypes.forEach(type => {
        const spots = proposalData.spots[type.key] || 0;
        const valor = proposalData.spots[type.valorKey] || 0;
        total += spots * valor;
    });
    
    return total;
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

function updateSpots(key, value) {
    const oldValue = proposalData.spots[key];
    const newValue = parseFloat(value) || 0;
    
    proposalData.spots[key] = newValue;
    
    if (!proposalData.changes[key]) {
        proposalData.changes[key] = { old: oldValue, new: newValue };
    } else {
        proposalData.changes[key].new = newValue;
    }
    
    console.log(`📝 ${key}: ${oldValue} → ${newValue}`);
    updateStats();
    renderCharts();
    showUnsavedChanges();
}

function updateValor(key, value) {
    const oldValue = proposalData.spots[key];
    const newValue = parseFloat(value) || 0;
    
    proposalData.spots[key] = newValue;
    
    if (!proposalData.changes[key]) {
        proposalData.changes[key] = { old: oldValue, new: newValue };
    } else {
        proposalData.changes[key].new = newValue;
    }
    
    console.log(`💰 ${key}: ${oldValue} → ${newValue}`);
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
            spots30: proposalData.spots.spots30,
            valorNegociado30: proposalData.spots.valorNegociado30,
            spots60: proposalData.spots.spots60,
            valorNegociado60: proposalData.spots.valorNegociado60,
            spots5: proposalData.spots.spots5,
            valorNegociado5: proposalData.spots.valorNegociado5,
            spotsBlitz: proposalData.spots.spotsBlitz,
            valorNegociadoBlitz: proposalData.spots.valorNegociadoBlitz,
            spotsTest60: proposalData.spots.spotsTest60,
            valorNegociadoTest60: proposalData.spots.valorNegociadoTest60,
            changes: proposalData.changes
        };
        
        const response = await fetch(`${apiUrl}?id=${proposalData.id}`, {
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
