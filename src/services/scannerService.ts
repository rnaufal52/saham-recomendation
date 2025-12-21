import axios from 'axios';
import { StockData } from '../types';
import { config } from '../config';

export class ScannerService {
  async scanMarket(): Promise<StockData[]> {
    console.log('[Scanner] Fetching top active IDX stocks...');

    try {
      // Fetch a larger pool initially (e.g., 40) explicitly to allow for filtering
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
            'volume'
          ],
          sort: { sortBy: 'volume', sortOrder: 'desc' },
          range: [0, config.scanner.topLimit] 
        }
      );

      if (!res.data?.data) return [];

      const rawStocks = res.data.data.map((i: any): StockData => ({
        ticker: i.d[0],
        lastPrice: i.d[1],
        changePercent: i.d[2],
        change: i.d[3],
        rsi: i.d[4] || 50, // Default to 50 if null
        volume: i.d[5]
      }));

      // ============================================
      // STRICT FILTERING (ANTIGRAVITY RULES)
      // ============================================
      const filtered = rawStocks.filter((s: StockData) => {
        const absChange = Math.abs(s.changePercent);
        const hasMomentum = absChange >= config.scanner.minChange;
        const hasVolume = s.volume >= config.scanner.minVolume;
        
        return hasMomentum && hasVolume;
      });

      console.log(`[Scanner] Fetched ${rawStocks.length}, Filtered to ${filtered.length} valid candidates.`);
      
      // Return top 20 of the valid ones
      return filtered.slice(0, 20);

    } catch (err) {
      console.error('[Scanner] Failed', err);
      return [];
    }
  }
}
