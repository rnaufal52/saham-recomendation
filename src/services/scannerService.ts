import axios from 'axios';
import { StockData } from '../types';
import { config } from '../config';

/**
 * TYPE GUARD
 * Meyakinkan TypeScript bahwa field-field penting PASTI ADA
 */
function isValidStock(
  s: StockData
): s is StockData & {
  avgVolume: number;
  tf30m: {
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
  };
} {
  return (
    typeof s.avgVolume === 'number' &&
    s.avgVolume > 0 &&
    !!s.tf30m &&
    typeof s.tf30m.open === 'number' &&
    typeof s.tf30m.close === 'number' &&
    typeof s.tf30m.high === 'number' &&
    typeof s.tf30m.low === 'number' &&
    typeof s.tf30m.volume === 'number'
  );
}

export class ScannerService {
  async scanMarket(): Promise<StockData[]> {
    console.log('[Scanner] Fetching top active IDX stocks...');

    try {
      const res = await axios.post(
        'https://scanner.tradingview.com/indonesia/scan',
        {
          filter: [
            { left: 'exchange', operation: 'equal', right: 'IDX' },
            { left: 'active_symbol', operation: 'equal', right: true }
          ],
          columns: [
            'name',
            'close',
            'change',
            'change_abs',
            'RSI',
            'volume',
            'open',
            'high',
            'low',
            'average_volume_30d_calc',
            'close|30',
            'volume|30',
            'change|30',
            'RSI|30',
            'open|30',
            'high|30',
            'low|30'
          ],
          sort: { sortBy: 'volume', sortOrder: 'desc' },
          range: [0, 50]
        }
      );

      if (!res.data?.data) return [];

      const rawStocks: StockData[] = res.data.data.map((i: any) => ({
        ticker: i.d[0],
        lastPrice: i.d[1],
        changePercent: i.d[2],
        change: i.d[3],
        rsi: i.d[4] || 50,
        volume: i.d[5],
        open: i.d[6],
        high: i.d[7],
        low: i.d[8],
        avgVolume: i.d[9],
        transactionValue: i.d[1] * i.d[5],
        tf30m: {
          close: i.d[10],
          volume: i.d[11],
          change: i.d[12],
          rsi: i.d[13] || 50,
          open: i.d[14],
          high: i.d[15],
          low: i.d[16]
        }
      }));

      // ============================================
      // FILTER + TYPE GUARD
      // ============================================
      const filtered = rawStocks
        .filter(isValidStock)
        .filter((s) => {
          // 1️⃣ Volume spike (30m LEADING indicator)
          // Adjusted to 0.5x to catch EARLY moves & quiet accumulation
          const avg30mVolume = s.avgVolume / 13;
          const hasVolumeSpike = s.tf30m.volume > avg30mVolume * 0.5;

          // Compression Check
          const range30m = (s.tf30m.high - s.tf30m.low) / s.tf30m.low;
          const isCompressed = range30m < 0.035;

          // ============================================
          // 4️⃣ SMART RISK SCORING (ANTI-GORENGAN)
          // ============================================
          let riskScore = 0;

          // A. Price Risk (50%)
          if (s.lastPrice < 50) riskScore += 50;       // ZOMBIE
          else if (s.lastPrice < 200) riskScore += 30; // PENNY
          else if (s.lastPrice < 500) riskScore += 10; // SECOND LINER
          
          // B. Volatility Risk (30%)
          const vol30m = Math.abs(s.tf30m.change);
          if (vol30m > 5) riskScore += 30;    // Extreme move > 5% in 30m
          else if (vol30m > 3) riskScore += 15;

          // C. Volume Anomaly Risk (20%) - "Fake Pump" check
          // If volume is 20x average but price doesn't move -> suspicious
          const volRatio = s.tf30m.volume / avg30mVolume;
          if (volRatio > 20 && vol30m < 1) riskScore += 20;

          s.riskScore = Math.min(riskScore, 100);

          // ============================================
          // 5️⃣ ACCUMULATION vs DISTRIBUTION
          // ============================================
          let accumStatus: 'Accumulation' | 'Distribution' | 'Neutral' = 'Neutral';
          
          if (hasVolumeSpike) {
              const range = s.tf30m.high - s.tf30m.low;
              const bottom25 = s.tf30m.low + (range * 0.25);
              
              // ACCUMULATION: Green Candle & Close near High
              if (s.tf30m.close > s.tf30m.open && s.tf30m.close >= s.tf30m.high * 0.98) {
                  accumStatus = 'Accumulation';
              } 
              // DISTRIBUTION: Red Candle & Close in Bottom 25% of range
              else if (s.tf30m.close < s.tf30m.open && s.tf30m.close <= bottom25) {
                  accumStatus = 'Distribution';
              }
          }
          s.accumulationStatus = accumStatus;

          // ============================================
          // FINAL FILTER DECISION
          // ============================================
          
          // 1. Must have basic Volume Spike & Compression
          if (!hasVolumeSpike || !isCompressed) return false;

          // 2. REJECT High Risk (> 75)
          if (s.riskScore > 75) return false;

          // 3. REJECT Distribution (Selling Climax)
          if (accumStatus === 'Distribution') return false;

          // 4. Liquidity Check (Min 1B Transaction)
          const isLiquid = (s.transactionValue || 0) > 1_000_000_000;
          if (!isLiquid) return false;

          return true;
        });

      // ============================================
      // RANKING → TOP 8 ONLY
      // ============================================
      filtered.sort((a, b) => {
        const aScore = a.tf30m.volume / (a.avgVolume / 13);
        const bScore = b.tf30m.volume / (b.avgVolume / 13);
        return bScore - aScore;
      });

      console.log(
        `[Scanner] Fetched ${rawStocks.length}, Filtered ${filtered.length}. Fetching Intraday for Top 15...`
      );

      // ============================================
      // HYBRID VALIDATION (YAHOO FINANCE)
      // ============================================
      // ============================================
      // HYBRID VALIDATION (YAHOO FINANCE)
      // ============================================
      // Increased to 25 to catch "High Quality" stocks pushed down by penny stock volume spikes
      const topCandidates = filtered.slice(0, 25);
      const validated: StockData[] = [];

      for (const stock of topCandidates) {
        // ... (loop content remains same, just ensuring context) ...
        // Delay to prevent rate limiting (nice to have)
        await new Promise(r => setTimeout(r, 200)); 
        
        try {
            const candles = await this.getIntradayCandles(stock.ticker);
            if (candles && candles.length > 0) {
                // TREND CHECK (Last 3 Candles)
                // Avoid "Dead Cat Bounce" (Green last candle but downtrend)
                const recentCandles = candles.slice(-3);
                let dumpCount = 0;
                
                recentCandles.forEach((c: any) => {
                    const chg = (c.close - c.open) / c.open;
                    if (chg < -0.01) dumpCount++; // Count candles dropping > 1%
                });

                // Signal Check: Check last closed candle
                const lastCandle = candles[candles.length - 1];
                const lastChange = (lastCandle.close - lastCandle.open) / lastCandle.open;
                
                // Rule 1: Last candle should not be a massive dump (> -1.5%)
                const isSafeLast = lastChange > -0.015;
                
                // Rule 2: Trend should not be bearish (max 1 dump allowed in last 3)
                const isTrendSafe = dumpCount < 2;
                
                if (isSafeLast && isTrendSafe) {
                    stock.intraday = candles;
                    validated.push(stock);
                    console.log(`[Scanner] ${stock.ticker} validated. (Last: ${(lastChange*100).toFixed(2)}%, Dumps: ${dumpCount})`);
                } else {
                    console.log(`[Scanner] ${stock.ticker} rejected. (Last: ${(lastChange*100).toFixed(2)}%, Dumps: ${dumpCount})`);
                }
            } else {
                console.warn(`[Scanner] No intraday data for ${stock.ticker} (Empty/Null)`);
            }
        } catch (e) {
            console.warn(`[Scanner] Failed to validate ${stock.ticker}:`, (e as Error).message);
        }
      }

      return validated.slice(0, 12); // Send Top 12 to AI (giving more options)
    } catch (err) {
      console.error('[Scanner] Failed', err);
      return [];
    }
  }

  /**
   * Fetch Real 15m Candles from Yahoo Finance
   */
  private async getIntradayCandles(ticker: string) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.JK?interval=15m&range=5d`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const result = data.chart.result[0];
        if (!result || !result.timestamp) return null;

        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;

        return timestamps.map((t: number, i: number) => ({
            date: new Date(t * 1000),
            open: quote.open[i],
            high: quote.high[i],
            low: quote.low[i],
            close: quote.close[i],
            volume: quote.volume[i]
        })).filter((c: any) => c.close !== null); // Filter nulls
    } catch (error) {
        console.warn(`[Scanner] Yahoo API Error for ${ticker}:`, (error as Error).message);
        return null; // Silent fail
    }
  }
}
