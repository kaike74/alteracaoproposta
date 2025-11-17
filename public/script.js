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
    { key: 'spotsTest30', label: 'Test 30"', tabelaKey: 'valorTabelaTest30', negKey: 'valorNegociadoTest30' },
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

// Função de debug visual - removida
// Todos os debugs agora vão apenas para console


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
        
        console.log(`📊 É array? ${Array.isArray(data)}`);
        console.log(`📊 Tamanho: ${Array.isArray(data) ? data.length : 'N/A'}`);
        
        if (Array.isArray(data) && data.length > 0) {
            console.log(`✅ Processando ${data.length} emissoras`);
            console.log(`📋 Primeiro emissora: ${data[0].emissora || 'SEM NOME'}`);
            
            // Usar os dados diretamente do Notion, sem transformação
            proposalData.emissoras = data;
            
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
    document.getElementById('proposalTitle').textContent = proposalName;
    
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
    console.log('✅ renderInterface() finalizado!');
}

function renderSpotsTable() {
    console.log('\n🎯🎯🎯 renderSpotsTable() INICIADA 🎯🎯🎯');
    
    const tbody = document.getElementById('spotsTableBody');
    
    console.log('✅ Procurando tbody #spotsTableBody...');
    console.log('✅ tbody encontrado?', !!tbody);
    console.log('✅ proposalData.emissoras.length:', proposalData.emissoras.length);
    
    if (!tbody) {
        console.error('❌ CRÍTICO: Elemento spotsTableBody não encontrado no DOM!');
        return;
    }
    
    if (!proposalData.emissoras || proposalData.emissoras.length === 0) {
        console.error('❌ CRÍTICO: proposalData.emissoras vazio ou indefinido!');
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
    
    console.log('🔍 Produtos ativos encontrados:', Array.from(produtosAtivos));
    
    // LIMPA o tbody completamente
    tbody.innerHTML = '';
    
    let totalLinhasAdicionadas = 0;
    
    // Renderiza uma linha por emissora (não por produto)
    proposalData.emissoras.forEach((emissora, emissoraIndex) => {
        console.log(`📍 Processando emissora ${emissoraIndex}: ${emissora.emissora}`);
        
        // Calcula investimentos para esta emissora
        let investimentoTabelaEmissora = 0;
        let investimentoNegociadoEmissora = 0;
        
        const row = document.createElement('tr');
        row.className = 'spots-data-row';
        row.innerHTML = `
            <td>
                <input 
                    type="checkbox" 
                    onchange="updateRowSelection()"
                    style="cursor: pointer;"
                    checked
                >
            </td>
            <td>${emissora.uf || '-'}</td>
            <td>${emissora.praca || '-'}</td>
            <td><strong>${emissora.emissora || '-'}</strong></td>
        `;
        
        // Adiciona colunas para cada produto ativo
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
                <td style="text-align: center; padding: 8px;">
                    <input 
                        type="number" 
                        value="${spots}" 
                        onchange="updateEmissora(${emissoraIndex}, '${produto.key}', this.value)"
                        class="input-spots"
                        min="0"
                        step="1"
                        style="width: 50px; padding: 4px; text-align: center;"
                    >
                </td>
                <td style="text-align: right; padding: 8px;">R$ ${valorTabela.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="text-align: right; padding: 8px;">R$ ${valorNegociado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            `;
        });
        
        // Adiciona colunas de investimento total
        row.innerHTML += `
            <td class="value-cell" style="text-align: right;">R$ ${investimentoTabelaEmissora.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="value-cell" style="text-align: right;">R$ ${investimentoNegociadoEmissora.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        `;
        
        tbody.appendChild(row);
        totalLinhasAdicionadas++;
    });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Tabela renderizada com sucesso! ${totalLinhasAdicionadas} emissoras exibidas`);
    console.log('═══════════════════════════════════════════════════════════');
}

function updateStats() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 📍 INICIANDO: updateStats()');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('✅ Iniciando cálculos...');
    
    // Calcula o investimento total (soma de todos os produtos × valores)
    let totalInvestimentoTabela = 0;
    let totalInvestimentoNegociado = 0;
    let totalSpots = 0;
    
    // Percorre todas as emissoras e produtos para calcular totais
    proposalData.emissoras.forEach(emissora => {
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
    });
    
    const cpm = totalSpots > 0 ? (totalInvestimentoNegociado / totalSpots) * 1000 : 0;
    const economia = totalInvestimentoTabela - totalInvestimentoNegociado;
    
    console.log('📊 Total Spots:', totalSpots);
    console.log('💰 Total Investimento Tabela:', totalInvestimentoTabela);
    console.log('💰 Total Investimento Negociado:', totalInvestimentoNegociado);
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
    if (statTabelaValue) statTabelaValue.textContent = formatCurrency(totalInvestimentoTabela);
    if (statNegociadoValue) statNegociadoValue.textContent = formatCurrency(totalInvestimentoNegociado);
    if (statCPM) statCPM.textContent = `R$ ${cpm.toFixed(2)}`;
    if (statEconomia) statEconomia.textContent = formatCurrency(economia);
    
    console.log('✅ Estatísticas atualizadas!\n');
}

function renderCharts() {
    console.log('📊 Renderizando gráficos...');
    
    try {
        // Destroi os gráficos antigos se existirem
        if (charts.investment) {
            charts.investment.destroy();
            charts.investment = null;
        }
        if (charts.impacts) {
            charts.impacts.destroy();
            charts.impacts = null;
        }
        
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
    
    // Itera apenas pelas linhas selecionadas
    const rows = document.querySelectorAll('#spotsTableBody tr');
    const produtosAtivos = new Set();
    
    // Primeiro, descobre quais produtos têm dados
    proposalData.emissoras.forEach(emissora => {
        PRODUTOS.forEach(produto => {
            const spots = emissora[produto.key] || 0;
            if (spots > 0) {
                produtosAtivos.add(produto.label);
            }
        });
    });
    
    // Agora conta spots apenas das linhas selecionadas
    const spotsPorProduto = {};
    
    rows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            // Obtém o nome da emissora (4ª coluna)
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
                const emissoraName = cells[3].textContent.trim();
                
                // Encontra a emissora correspondente
                const emissora = proposalData.emissoras.find(e => e.emissora === emissoraName);
                if (emissora) {
                    PRODUTOS.forEach(produto => {
                        const spots = emissora[produto.key] || 0;
                        if (spots > 0) {
                            const chave = `${emissoraName} - ${produto.label}`;
                            spotsPorProduto[chave] = spots;
                        }
                    });
                }
            }
        }
    });
    
    // Monta arrays de labels e data
    Object.entries(spotsPorProduto).forEach(([label, spots]) => {
        labels.push(label);
        data.push(spots);
    });
    
    console.log('📊 Gráfico spots - Produtos encontrados:', labels.length);
    
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
    
    // NÃO chama renderSpotsTable, apenas atualiza estatísticas e gráficos
    updateStats();
    renderCharts();
    showUnsavedChanges();
}

function updateRowSelection() {
    // Função chamada quando um checkbox é marcado/desmarcado
    // Recalcula os totais baseado nas linhas selecionadas
    console.log('📝 Linha selecionada/desmarcada');
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
