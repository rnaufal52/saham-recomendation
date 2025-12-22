const axios = require('axios');

async function debugRank() {
  console.log('DEBUGGING RANKING LEADERBOARD...');
  try {
    const res = await axios.post(
      'https://scanner.tradingview.com/indonesia/scan',
      {
          filter: [
            { left: 'exchange', operation: 'equal', right: 'IDX' },
            { left: 'active_symbol', operation: 'equal', right: true }
          ],
          columns: [
            'name', 'close', 'change', 'change_abs', 'RSI', 'volume', 'open', 'high', 'low',
            'average_volume_30d_calc', 'close|30', 'volume|30', 'change|30', 'open|30', 'high|30', 'low|30'
          ],
          sort: { sortBy: 'volume', sortOrder: 'desc' },
          range: [0, 50] 
      }
    );

    const rawStocks = res.data.data.map(i => ({
        ticker: i.d[0],
        lastPrice: i.d[1],
        avgVolume: i.d[9],
        tf30m: {
          close: i.d[10],
          volume: i.d[11],
          open: i.d[13], 
          high: i.d[14],
          low: i.d[15]
        }
    }));

    // 1. FILTER
    const filtered = rawStocks.filter(s => {
        const avg30mVolume = s.avgVolume / 13;
        const hasVolumeSpike = s.tf30m.volume > avg30mVolume * 0.5;
        
        const bodySize = Math.abs(s.tf30m.close - s.tf30m.open) / s.tf30m.open;
        const isAccumulation = bodySize < 0.02;

        const range30m = (s.tf30m.high - s.tf30m.low) / s.tf30m.low;
        const isCompressed = range30m < 0.035;

        return hasVolumeSpike && isAccumulation && isCompressed;
    });

    // 2. SCORE & SORT
    filtered.sort((a, b) => {
        const aScore = a.tf30m.volume / (a.avgVolume / 13);
        const bScore = b.tf30m.volume / (b.avgVolume / 13);
        return bScore - aScore;
    });

    console.log(`\nLEADERBOARD (Top 20 of ${filtered.length} candidates):`);
    console.log(`Cutoff is Rank #8`);
    console.log('--------------------------------------------------');
    
    filtered.slice(0, 20).forEach((s, idx) => {
        const score = s.tf30m.volume / (s.avgVolume / 13);
        const mark = s.ticker === 'ANTM' ? '<<<< ANTM IS HERE' : '';
        console.log(`#${idx + 1} ${s.ticker} | Score: ${score.toFixed(2)}x | Vol: ${s.tf30m.volume} ${mark}`);
    });

    const antmFound = filtered.find(s => s.ticker === 'ANTM');
    if (!antmFound) {
        console.log('\n❌ ANTM did not pass the base filters (Volume/Accum/Compression).');
    } else {
        const rank = filtered.findIndex(s => s.ticker === 'ANTM') + 1;
        if (rank > 8) {
             console.log(`\n⚠️ ANTM passed filters but is Rank #${rank}. It is cut off (Limit: 8).`);
        } else {
             console.log(`\n✅ ANTM is Rank #${rank}. It should be sent to AI.`);
        }
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugRank();
