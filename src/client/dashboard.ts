interface Signal {
    ticker: string;
    action: string;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    reasoning: string;
    confidence: number;
    transactionValue?: number;
    riskScore?: number;
    accumulationStatus?: string;
}

interface WebResponse {
    recommendations: Signal[];
    history: (Signal & { time: string })[]; // Add history type
    lastUpdate: string;
    isTradingHours: boolean;
}

async function fetchSignals() {
    const grid = document.getElementById('signals-grid');
    const historyList = document.getElementById('history-list');
    
    if (!grid) return;

    try {
        const res = await fetch('/api/market-advice');
        const data: WebResponse = await res.json();
        
        renderHeader(data);
        
        // Render Active Signals
        if (data.recommendations.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20">
                    <h3 class="text-xl font-medium text-gray-300">No Signals Found</h3>
                    <p class="text-gray-500">Market conditions do not meet criteria.</p>
                </div>`;
        } else {
            grid.innerHTML = data.recommendations.map(rec => createCard(rec)).join('');
        }

        // Render History
        if (historyList) {
            if (data.history && data.history.length > 0) {
                historyList.innerHTML = data.history.map(row => createHistoryRow(row)).join('');
                applyFilter(); // ✅ Re-apply filter after render
            } else {
                historyList.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-gray-500 italic">Belum ada riwayat sinyal hari ini.</td></tr>`;
            }
        }

    } catch (error) {
        console.error('Fetch failed', error);
        grid.innerHTML = `<div class="col-span-full text-center text-red-500">Connection Error. Retrying...</div>`;
    }
}

function renderHeader(data: WebResponse) {
    const statusDot = document.getElementById('status-dot');
    const statusPing = document.getElementById('status-ping');
    const marketStatus = document.getElementById('market-status');
    const lastUpdate = document.getElementById('last-update');

    if (lastUpdate) {
        const date = new Date(data.lastUpdate);
        // If year is 1970, show waiting
        if (date.getFullYear() === 1970) {
            lastUpdate.innerText = "--:--:--";
        } else {
            lastUpdate.innerText = date.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
        }
    }

    if (data.isTradingHours) {
        statusDot?.classList.remove('bg-gray-500', 'bg-yellow-500');
        statusDot?.classList.add('bg-green-500', 'animate-pulse');
        statusPing?.classList.remove('hidden');
        if (marketStatus) marketStatus.innerHTML = `<span class="text-gray-400">STATUS:</span> <span class="text-green-400 font-bold">MARKET OPEN</span>`;
    } else {
        statusDot?.classList.remove('bg-green-500', 'animate-pulse');
        statusDot?.classList.add('bg-yellow-500');
        statusPing?.classList.add('hidden');
        if (marketStatus) marketStatus.innerHTML = `<span class="text-gray-400">STATUS:</span> <span class="text-yellow-500 font-bold">DEV / CLOSED</span>`;
    }
}

function formatValue(val?: number): string {
    if (!val) return '-';
    if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + ' M'; // Milyar
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(0) + ' jt'; // Juta
    return (val / 1_000).toFixed(0) + ' K';
}

function createHistoryRow(rec: Signal & { time: string }): string {
    const time = new Date(rec.time).toLocaleTimeString('id-ID', { 
        timeZone: 'Asia/Jakarta',
        hour: '2-digit', 
        minute: '2-digit' 
    });
    const actionColor = rec.action === 'BUY' ? 'text-green-400' : 'text-gray-400';
    
    return `
    <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 key-row animate-fade-in">
        <td class="p-4 font-mono text-gray-400">${time}</td>
        <td class="p-4 font-bold text-white">${rec.ticker}</td>
        <td class="p-4 font-bold ${actionColor}">${rec.action}</td>
        <td class="p-4 font-mono text-indigo-300">${formatValue(rec.transactionValue)}</td>
        <td class="p-4 font-mono text-yellow-500">${rec.entryPrice}</td>
        <td class="p-4 font-mono text-green-400">${rec.targetPrice}</td>
        <td class="p-4 font-mono text-red-400">${rec.stopLoss}</td>
        <td class="p-4">${getRiskBadge(rec.riskScore)}</td>
        <td class="p-4">
             <div class="flex items-center gap-2">
                <div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500" style="width: ${rec.confidence}%"></div>
                </div>
                <span class="text-xs text-blue-400 font-bold">${rec.confidence}%</span>
             </div>
        </td>
    </tr>
    `;
}

// ... renderHeader ...

// Helper for badges
function getRiskBadge(score?: number): string {
    if (score === undefined) return '';
    let color = 'green';
    let label = 'LOW RISK';
    
    if (score > 60) { color = 'red'; label = 'HIGH RISK'; }
    else if (score > 30) { color = 'yellow'; label = 'MED RISK'; }

    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-${color}-500/10 text-${color}-400 border border-${color}-500/20">${label} (${score})</span>`;
}

function getAccumBadge(status?: string): string {
    if (!status || status === 'Neutral') return '';
    const color = status === 'Accumulation' ? 'emerald' : 'rose';
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-${color}-500/10 text-${color}-400 border border-${color}-500/20">${status.toUpperCase()}</span>`;
}

function createCard(rec: Signal): string {
    let actionColor = 'gray';
    if (rec.action.includes('BUY')) actionColor = 'green';
    else if (rec.action.includes('SELL')) actionColor = 'red';

    return `
    <div class="glass-panel rounded-xl p-5 relative overflow-hidden group hover:border-${actionColor}-500/50 transition-all duration-300">
        <div class="absolute top-4 right-4">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-${actionColor}-500/10 text-${actionColor}-400 border border-${actionColor}-500/20">
                ${rec.action.replace('_', ' ')}
            </span>
        </div>

        <div class="mb-4">
            <h3 class="text-2xl font-black text-white tracking-tight">${rec.ticker}</h3>
            <div class="flex flex-wrap items-center gap-2 mt-2">
                 ${getRiskBadge(rec.riskScore)}
                 ${getAccumBadge(rec.accumulationStatus)}
            </div>
            <div class="flex items-center gap-2 text-xs text-gray-500 font-mono mt-2">
                <span>IDX STOCK</span>
                <span class="text-gray-700">•</span>
                <span class="text-indigo-400 font-bold">Val: ${formatValue(rec.transactionValue)}</span>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-2 mb-4 text-center">
            <div class="bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Entry</div>
                <div class="font-mono text-sm text-yellow-500 font-bold">${rec.entryPrice}</div>
            </div>
            <div class="bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Target</div>
                <div class="font-mono text-sm text-green-400 font-bold">${rec.targetPrice}</div>
            </div>
            <div class="bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Stop</div>
                <div class="font-mono text-sm text-red-400 font-bold">${rec.stopLoss}</div>
            </div>
        </div>

        <div class="bg-gray-900/30 p-3 rounded-lg border border-gray-800/50 mb-4">
            <p class="text-xs text-gray-300 leading-relaxed italic border-l-2 border-${actionColor}-500 pl-2">
                "${rec.reasoning}"
            </p>
        </div>

        <div class="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-wider">
            <span>Confidence</span>
            <div class="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-${actionColor}-500 rounded-full" style="width: ${rec.confidence}%"></div>
            </div>
            <span class="text-${actionColor}-400 font-bold">${rec.confidence}%</span>
        </div>
    </div>
    `;
}

// Init
document.getElementById('refresh-btn')?.addEventListener('click', () => {
    fetchSignals();
});

// Modal Logic
const modal = document.getElementById('about-modal');
const openBtn = document.getElementById('about-btn');
const closeBtn = document.getElementById('close-modal-btn');

openBtn?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
});

closeBtn?.addEventListener('click', () => {
    modal?.classList.add('hidden');
});

// Close on backdrop click
modal?.addEventListener('click', (e) => {
    if (e.target === modal || (e.target as HTMLElement).nextElementSibling === null) { 
        // Simple check if clicking the backdrop wrapper
        // Correct way often involves checking target === backdrop. 
        // Because of nesting, checking matching ID is safest logic here if backdrop has ID, but wrapper has ID.
        // Let's simpler:
    }
});
// Better backdrop click:
document.querySelectorAll('#about-modal .fixed.inset-0.bg-gray-950\\/80').forEach(el => {
    el.addEventListener('click', () => {
        modal?.classList.add('hidden');
    });
});


// Search Filter Logic
const searchInput = document.getElementById('history-search') as HTMLInputElement;

function applyFilter() {
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    const rows = document.querySelectorAll('#history-list tr.key-row');
    
    rows.forEach(row => {
        const text = row.textContent?.toLowerCase() || '';
        if (text.includes(term)) {
            (row as HTMLElement).style.display = '';
        } else {
            (row as HTMLElement).style.display = 'none';
        }
    });
}

searchInput?.addEventListener('input', applyFilter);

// Auto Refresh
setInterval(fetchSignals, 60000);
fetchSignals();
