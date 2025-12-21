import * as fs from 'fs';
import * as path from 'path';
import { ScannerService } from './scannerService';
import { AIService } from './aiService';
import { AIRecommendation } from '../types';

export class MarketService {
  private scanner = new ScannerService();
  private ai = new AIService();

  private lastScanTime = new Date(0);
  private lastRecommendations: AIRecommendation[] = [];
  private isScanning = false;
  
  // Cooldown: Ticker -> Expiry Timestamp
  private cooldowns = new Map<string, number>();
  private readonly COOLDOWN_MS = 15 * 60 * 1000; // 15 Minutes
  
  // History
  private history: (AIRecommendation & { time: Date })[] = [];
  private readonly HISTORY_FILE = path.join(process.cwd(), 'data', 'history.json');

  constructor() {
    this.loadHistory();
  }

  async getMarketAdvice(forceScan = false) {
    const now = new Date();
    const hour = now.getHours();

    const isProduction = process.env.NODE_ENV === 'production';
    
    // Golden Hours Strategy (IDX)
    // Sesi 1: 09:00 - 10:15 (Morning Volatility)
    // Sesi 2: 13:30 - 14:30 (Afternoon Re-open)
    const isMorningGold = hour === 9 || (hour === 10 && now.getMinutes() <= 15);
    const isAfternoonGold = hour === 13 && now.getMinutes() >= 30 || hour === 14 && now.getMinutes() <= 30;

    const isTradingHours =
      !isProduction || isMorningGold || isAfternoonGold || forceScan;

    const shouldScan =
      isTradingHours &&
      !this.isScanning &&
      now.getTime() - this.lastScanTime.getTime() > 60_000;

    if (shouldScan) {
      this.runScan();
    }

    if (this.lastRecommendations.length === 0 && this.isScanning) {
      await this.waitInitialScan();
    }

    return {
      recommendations: this.lastRecommendations,
      history: this.history, // ✅ Return history
      lastUpdate: this.lastScanTime,
      isTradingHours
    };
  }

  private async runScan() {
    this.isScanning = true;
    console.log('[MarketService] Scanning market...');

    try {
      const stocks = await this.scanner.scanMarket();
      if (!stocks.length) return;

      // 1. Clean expired cooldowns
      const nowTs = Date.now();
      for (const [ticker, expiry] of this.cooldowns) {
        if (nowTs > expiry) this.cooldowns.delete(ticker);
      }

      // 2. Filter Scanner Results (Ignore cooled down tickers)
      const freshStocks = stocks.filter(s => !this.cooldowns.has(s.ticker));

      if (freshStocks.length === 0) {
          console.log('[MarketService] All top candidates are on cooldown.');
          return;
      }

      // anti rate-limit Groq
      await new Promise(r => setTimeout(r, 800));

      const recommendations = await this.ai.analyzeMarket(freshStocks);

      // 3. Update Cooldowns & History
      recommendations.forEach(rec => {
        this.cooldowns.set(rec.ticker, Date.now() + this.COOLDOWN_MS);
        
        // Add to history
        this.history.unshift({ ...rec, time: new Date() });
      });

      // Keep history size manageable (max 50)
      if (this.history.length > 50) {
        this.history = this.history.slice(0, 50);
      }
      
      this.saveHistory(); // ✅ Persist to disk

      // 4. Update Cache
      this.lastRecommendations = recommendations;
      this.lastScanTime = new Date();

      console.log(`[MarketService] Scan complete. Found: ${recommendations.length}`);
    } catch (err) {
      console.error('[MarketService] Scan failed', err);
    } finally {
      this.isScanning = false;
    }
  }

  private async waitInitialScan() {
    let attempts = 0;
    while (this.isScanning && attempts < 10) {
      await new Promise(r => setTimeout(r, 500));
      attempts++;
    }
  }

  // ============================
  // 💾 PERSISTENCE HELPER
  // ============================
  private loadHistory() {
    try {
      if (fs.existsSync(this.HISTORY_FILE)) {
        const raw = fs.readFileSync(this.HISTORY_FILE, 'utf-8');
        const data = JSON.parse(raw);
        
        const todayStr = new Date().toDateString();

        // Re-hydrate & Filter for TODAY only
        this.history = data
          .map((d: any) => ({ ...d, time: new Date(d.time) }))
          .filter((d: any) => d.time.toDateString() === todayStr);

        // If data was filtered out (old days removed), save the clean file
        if (this.history.length < data.length) {
          console.log('[MarketService] Old history cleaned. Starting fresh for today.');
          this.saveHistory();
        }
      }
    } catch (e) {
      console.error('[MarketService] Failed to load history:', e);
      this.history = [];
    }
  }

  private saveHistory() {
    try {
      const dir = path.dirname(this.HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.HISTORY_FILE, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('[MarketService] Failed to save history:', e);
    }
  }
}
