// =====================================================
// PROPOSTA DE MÍDIA - JavaScript (MÚLTIPLAS EMISSORAS)
// =====================================================

let proposalData = {
    tableId: null,
    emissoras: [],  // Array de emissoras
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

async function loadProposalFromNotion(tableId) {
    console.log('📡 Carregando tabela de emissoras do Notion:', tableId);
    console.log('📡 URL atual:', window.location.href);
    
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
    const finalUrl = `${baseUrl}?id=${tableId}`;
    
    console.log('📡 URL da API final:', finalUrl);
    
    const response = await fetch(finalUrl);
    
    console.log('📊 Status:', response.status);
    
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('❌ Erro detalhado:', errorBody);
        throw new Error(`Erro ao carregar dados: ${response.status} - ${errorBody.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Dados recebidos:', data);
    
    // Espera um array de emissoras
    if (Array.isArray(data)) {
        proposalData.emissoras = data.map(row => ({
            id: row.id,
            emissora: row.emissora || '',
            uf: row.uf || '',
            spots30: parseFloat(row.spots30) || 0,
            valorTabela30: parseFloat(row.valorTabela30) || 0,
            valorNegociado30: parseFloat(row.valorNegociado30) || 0,
            spotsTest60: parseFloat(row.spotsTest60) || 0,
            valorTabelaTest60: parseFloat(row.valorTabelaTest60) || 0,
            valorNegociadoTest60: parseFloat(row.valorNegociadoTest60) || 0,
            investimento: parseFloat(row.investimento) || 0,
            investimentoTabela: parseFloat(row.investimentoTabela) || 0
        }));
        console.log('✅ Emissoras carregadas:', proposalData.emissoras);
    } else {
        throw new Error('Formato de dados inválido. Esperado array de emissoras.');
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
    tbody.innerHTML = '';
    
    proposalData.emissoras.forEach((emissora, index) => {
        const investimentoTabela = (emissora.spots30 * emissora.valorTabela30) + 
                                  (emissora.spotsTest60 * emissora.valorTabelaTest60);
        const investimentoNegociado = (emissora.spots30 * emissora.valorNegociado30) + 
                                     (emissora.spotsTest60 * emissora.valorNegociadoTest60);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${emissora.emissora}</strong></td>
            <td>${emissora.uf}</td>
            <td>
                <input 
                    type="number" 
                    value="${emissora.spots30}" 
                    onchange="updateEmissora(${index}, 'spots30', this.value)"
                    class="input-spots"
                    min="0"
                >
            </td>
            <td class="value-cell">R$ ${emissora.valorTabela30.toFixed(2)}</td>
            <td>
                <input 
                    type="number" 
                    value="${emissora.valorNegociado30.toFixed(2)}" 
                    onchange="updateEmissora(${index}, 'valorNegociado30', this.value)"
                    class="input-valor"
                    min="0"
                    step="0.01"
                >
            </td>
            <td>
                <input 
                    type="number" 
                    value="${emissora.spotsTest60}" 
                    onchange="updateEmissora(${index}, 'spotsTest60', this.value)"
                    class="input-spots"
                    min="0"
                >
            </td>
            <td class="value-cell">R$ ${emissora.valorTabelaTest60.toFixed(2)}</td>
            <td>
                <input 
                    type="number" 
                    value="${emissora.valorNegociadoTest60.toFixed(2)}" 
                    onchange="updateEmissora(${index}, 'valorNegociadoTest60', this.value)"
                    class="input-valor"
                    min="0"
                    step="0.01"
                >
            </td>
            <td class="value-cell">R$ ${investimentoTabela.toFixed(2)}</td>
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
    
    const labels = [];
    const data = [];
    
    proposalData.emissoras.forEach(emissora => {
        if (emissora.spots30 > 0) {
            labels.push(`${emissora.emissora} (30")`);
            data.push(emissora.spots30);
        }
        if (emissora.spotsTest60 > 0) {
            labels.push(`${emissora.emissora} (60")`);
            data.push(emissora.spotsTest60);
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
    return proposalData.emissoras.reduce((total, emissora) => {
        return total + (emissora.spots30 || 0) + (emissora.spotsTest60 || 0);
    }, 0);
}

function calculateTotalInvestimentoTabela() {
    return proposalData.emissoras.reduce((total, emissora) => {
        const inv30 = (emissora.spots30 || 0) * (emissora.valorTabela30 || 0);
        const invTest60 = (emissora.spotsTest60 || 0) * (emissora.valorTabelaTest60 || 0);
        return total + inv30 + invTest60;
    }, 0);
}

function calculateTotalInvestimentoNegociado() {
    return proposalData.emissoras.reduce((total, emissora) => {
        const inv30 = (emissora.spots30 || 0) * (emissora.valorNegociado30 || 0);
        const invTest60 = (emissora.spotsTest60 || 0) * (emissora.valorNegociadoTest60 || 0);
        return total + inv30 + invTest60;
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
