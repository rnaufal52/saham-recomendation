const axios = require('axios');

const TICKER = 'ANTM'; 

async function debugTicker() {
  console.log(`DEBUGGING SPECIFIC TICKER: ${TICKER}...`);
  try {
    // 1. FETCH TRADINGVIEW
    const res = await axios.post(
      'https://scanner.tradingview.com/indonesia/scan',
      {
          symbols: { tickers: [`IDX:${TICKER}`], query: { types: [] } },
          columns: [
            'name', 'close', 'change', 'change_abs', 'RSI', 'volume', 'open', 'high', 'low',
            'average_volume_30d_calc', 'close|30', 'volume|30', 'change|30', 'open|30', 'high|30', 'low|30'
          ]
      }
    );

    if (!res.data.data || res.data.data.length === 0) {
        console.log('❌ TradingView: Ticker not found or no data.');
        return;
    }

    const i = res.data.data[0];
    const s = {
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
    };

    console.log(`\n1. DAILY DATA (${s.ticker})`);
    console.log(`Price: ${s.lastPrice}`);
    console.log(`Volume 30m: ${s.tf30m.volume}`);
    console.log(`Avg Vol 30m (Est): ${(s.avgVolume/13).toFixed(0)}`);
    
    // 2. CHECK SCANNERS FILTERS
    const avg30mVolume = s.avgVolume / 13;
    const hasVolumeSpike = s.tf30m.volume > avg30mVolume * 0.5;

    const bodySize = Math.abs(s.tf30m.close - s.tf30m.open) / s.tf30m.open;
    const isAccumulation = bodySize < 0.02; 

    // Re-calc range30m
    const range30m = (s.tf30m.high - s.tf30m.low) / s.tf30m.low;
    const isCompressed = range30m < 0.035;

    console.log(`\n2. FILTER CHECK`);
    console.log(`- Volume Spike (>0.5x): ${hasVolumeSpike} (${(s.tf30m.volume / avg30mVolume).toFixed(2)}x)`);
    console.log(`- Accumulation (<2%): ${isAccumulation} (${(bodySize*100).toFixed(2)}%)`);
    console.log(`- Compression (<3.5%): ${isCompressed} (${(range30m*100).toFixed(2)}%)`);

    if (!hasVolumeSpike || !isAccumulation || !isCompressed) {
        console.log('❌ FAILED SCANNER FILTERS');
        return;
    }
    console.log('✅ PASSED SCANNER FILTERS');

    // 3. CHECK INTRADAY (YAHOO)
    console.log(`\n3. INTRADAY CHECK (Yahoo Finance)...`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}.JK?interval=15m&range=1d`;
    const yfRes = await axios.get(url);
    const result = yfRes.data.chart.result[0];
    
    if (!result || !result.timestamp) {
         console.log('❌ Yahoo Finance: No Intraday Data');
         return;
    }

    const quotes = result.indicators.quote[0];
    const candles = result.timestamp.map((t, idx) => ({
        date: new Date(t * 1000).toLocaleTimeString(),
        open: quotes.open[idx],
        high: quotes.high[idx],
        low: quotes.low[idx],
        close: quotes.close[idx],
        volume: quotes.volume[idx]
    })).filter(c => c.close !== null);

    const recentCandles = candles.slice(-3);
    console.log('Last 3 Candles:');
    let dumpCount = 0;
    recentCandles.forEach(c => {
        const chg = (c.close - c.open) / c.open;
        console.log(`- ${c.date}: O:${c.open} C:${c.close} (${(chg*100).toFixed(2)}%)`);
        if (chg < -0.01) dumpCount++;
    });

    const lastCandle = candles[candles.length - 1];
    const lastChange = (lastCandle.close - lastCandle.open) / lastCandle.open;

    const isSafeLast = lastChange > -0.015;
    const isTrendSafe = dumpCount < 2;

    console.log(`\n4. HYBRID LOGIC`);
    console.log(`- Last Candle Safe (>${-1.5}%): ${isSafeLast}`);
    console.log(`- Trend Safe (Max 1 Dump): ${isTrendSafe} (Count: ${dumpCount})`);

    if (isSafeLast && isTrendSafe) {
        console.log('✅ VALIDATED - READY FOR AI');
    } else {
        console.log('❌ REJECTED BY INTRADAY LOGIC');
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugTicker();
