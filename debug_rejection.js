const axios = require('axios');

async function debugRejection() {
  console.log('DEBUGGING FILTER REJECTIONS...');
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

    if (!res.data.data) {
        console.log('No data fetched.');
        return;
    }

    const rawStocks = res.data.data.map(i => ({
        ticker: i.d[0],
        lastPrice: i.d[1],
        volume: i.d[5],
        avgVolume: i.d[9],
        transactionValue: i.d[1] * i.d[5],
        tf30m: {
          close: i.d[10],
          volume: i.d[11],
          open: i.d[13], 
          high: i.d[14],
          low: i.d[15],
          change: i.d[12]
        }
    }));

    let failCounts = {
        volumeSpike: 0,
        compression: 0,
        pennyStock: 0, 
        liquidity: 0,
        highRisk: 0,
        distribution: 0
    };

    console.log(`\nScanning Top ${rawStocks.length} Volume Leaders:`);
    console.log('--------------------------------------------------');

    rawStocks.forEach(s => {
        const avg30mVolume = s.avgVolume / 13;
        const hasVolumeSpike = s.tf30m.volume > avg30mVolume * 0.5;
        const range30m = (s.tf30m.high - s.tf30m.low) / s.tf30m.low;
        const isCompressed = range30m < 0.035;
        const isNonPenny = s.lastPrice >= 200;
        const isLiquid = (s.transactionValue || 0) > 1_000_000_000;

        // Risk Score
        let riskScore = 0;
        if (s.lastPrice < 50) riskScore += 50;
        else if (s.lastPrice < 200) riskScore += 30;
        else if (s.lastPrice < 500) riskScore += 10;
        
        const vol30m = Math.abs(s.tf30m.change);
        if (vol30m > 5) riskScore += 30;
        else if (vol30m > 3) riskScore += 15;

        const volRatio = s.tf30m.volume / avg30mVolume;
        if (volRatio > 20 && vol30m < 1) riskScore += 20;

        const riskTooHigh = riskScore > 75;

        // Accumulation
        let accumStatus = 'Neutral';
        if (hasVolumeSpike) {
            if (s.tf30m.close > s.tf30m.open && s.tf30m.close >= s.tf30m.high * 0.98) {
                accumStatus = 'Accumulation';
            } else if (s.tf30m.close < s.tf30m.open || s.tf30m.close <= s.tf30m.low * 1.02) {
                accumStatus = 'Distribution';
            }
        }
        
        const isDistribution = accumStatus === 'Distribution';

        let reasons = [];
        if (!hasVolumeSpike) { failCounts.volumeSpike++; reasons.push('No Vol Spike'); }
        if (!isCompressed) { failCounts.compression++; reasons.push('Not Compressed'); }
        if (!isNonPenny) { failCounts.pennyStock++; reasons.push(`Penny Stock (${s.lastPrice})`); }
        if (!isLiquid) { failCounts.liquidity++; reasons.push(`Low Liq (${(s.transactionValue/1e9).toFixed(1)}M)`); }
        if (riskTooHigh) { failCounts.highRisk++; reasons.push(`High Risk (${riskScore})`); }
        if (isDistribution) { failCounts.distribution++; reasons.push('Distribution'); }

        if (reasons.length > 0) {
            console.log(`❌ ${s.ticker}: ${reasons.join(', ')}`);
        } else {
            console.log(`✅ ${s.ticker}: PASSED`);
        }
    });

    console.log('\nSUMMARY OF REJECTIONS:');
    console.log(failCounts);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugRejection();
