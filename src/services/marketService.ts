import { ScannerService } from './scannerService';
import { AIService } from './aiService';
import { AIRecommendation } from '../types';
import * as TimeUtils from '../utils/time';
import { redis } from '../utils/redis';

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
  private readonly REDIS_KEY = 'market:history';

  constructor() {
    // Initial load no longer synchronous
  }

  async getMarketAdvice(forceScan = false) {
    // Ensure history is loaded at least once or refreshed
    if (this.history.length === 0) {
      await this.loadHistory();
    }

    const shouldScan =
      TimeUtils.isJakartaTradingHour(forceScan) &&
      !this.isScanning &&
      Date.now() - this.lastScanTime.getTime() > 60_000;
      
    if (shouldScan) {
      // Don't await runScan to prevent blocking the response too long?
      // But the user might want current results. The original code didn't await runScan in the if block?
      // Original: 
      // if (shouldScan) { this.runScan(); } 
      // It was fire-and-forget (async method called without await).
      // I'll keep it fire-and-forget but catch errors.
      this.runScan().catch(e => console.error('[MarketService] Background scan error:', e));
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
      
      await this.saveHistory(); // ✅ Persist to Redis

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
  // 💾 PERSISTENCE HELPER (REDIS)
  // ============================
  private async loadHistory() {
    try {
      const raw = await redis.get<(AIRecommendation & { time: string })[]>(this.REDIS_KEY);
      
      if (!raw || !Array.isArray(raw)) {
        this.history = [];
        return;
      }

      // Target: Last Friday 16:00
      const lastResetTime = TimeUtils.getLastHistoryResetTime();

      // Re-hydrate & Filter for CURRENT WEEK (Since last reset)
      // Note: Redis JSON returns strings for Dates usually, need to re-parse
      this.history = raw
        .map(d => ({ ...d, time: new Date(d.time) }))
        .filter(d => {
           // Keep if data time is AFTER the last reset time
           return d.time > lastResetTime;
        });

      // If data was filtered out (old days removed), save the clean list
      if (this.history.length < raw.length) {
        console.log('[MarketService] Weekly history cleaned (Friday 16:00 Reset). Starting fresh cycle.');
        await this.saveHistory();
      }
    } catch (e) {
      console.warn('[MarketService] History corrupted or invalid. Starting fresh. Error:', (e as Error).message);
      this.history = [];
      await this.saveHistory(); 
    }
  }

  private async saveHistory() {
    try {
      await redis.set(this.REDIS_KEY, this.history);
    } catch (e) {
      console.error('[MarketService] Failed to save history to Redis:', e);
    }
  }
}
