import * as fs from 'fs';
import * as path from 'path';
import { ScannerService } from './scannerService';
import { AIService } from './aiService';
import { AIRecommendation } from '../types';
import * as TimeUtils from '../utils/time';

export class MarketService {
  private scanner = new ScannerService();
  private ai = new AIService();

  private lastScanTime = new Date();
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
    const shouldScan =
      TimeUtils.isJakartaTradingHour(forceScan) &&
      !this.isScanning &&
      Date.now() - this.lastScanTime.getTime() > 60_000;
      
    // ... rest of method

    if (shouldScan) {
      this.runScan();
    }

    if (this.lastRecommendations.length === 0 && this.isScanning) {
      await this.waitInitialScan();
    }

    return {
      recommendations: this.lastRecommendations,
      history: this.history, 
      lastUpdate: this.lastScanTime,
      isTradingHours: TimeUtils.isJakartaTradingHour(forceScan)
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

      console.log(`[MarketService] Sending ${freshStocks.length} fresh candidates to AI...`);
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
        if (!raw || raw.trim() === '') {
            this.history = [];
            return;
        }

        const data = JSON.parse(raw);
        
        // Target: Last Friday 16:00
        const lastResetTime = TimeUtils.getLastHistoryResetTime();

        // Re-hydrate & Filter for CURRENT WEEK (Since last reset)
        this.history = data
          .map((d: any) => ({ ...d, time: new Date(d.time) }))
          .filter((d: any) => {
             // Keep if data time is AFTER the last reset time
             return d.time > lastResetTime;
          });

        // If data was filtered out (old days removed), save the clean file
        if (this.history.length < data.length) {
          console.log('[MarketService] Weekly history cleaned (Friday 16:00 Reset). Starting fresh cycle.');
          this.saveHistory();
        }
      }
    } catch (e) {
      console.warn('[MarketService] History corrupted or invalid. Starting fresh. Error:', (e as Error).message);
      this.history = [];
      this.saveHistory(); // Auto-fix file
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
