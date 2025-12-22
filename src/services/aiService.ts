import OpenAI from 'openai';
import { StockData, AIRecommendation } from '../types';
import { config } from '../config';

type AISignal = {
  ticker: string;
  action: 'BUY';
  entry: number;
  target: number;
  stop: number;
  reason: string;
  confidence: number;
  risk?: number;
  accum?: string;
};

export class AIService {
  private client: OpenAI;

  constructor() {
    if (!config.groq.apiKey) {
      throw new Error('GROQ_API_KEY missing');
    }

    this.client = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: config.groq.apiKey
    });
  }

  async analyzeMarket(stocks: StockData[]): Promise<AIRecommendation[]> {
    try {
      // =====================================
      // 1️⃣ COMPACT MARKET SNAPSHOT
      // =====================================
      const market = stocks.map(s => ({
        t: s.ticker,
        p: s.lastPrice,
        c: Number((s.changePercent ?? 0).toFixed(2)),
        v: s.volume,
        // 30m Snapshot Data
        tf30: s.tf30m ? {
          c: s.tf30m.close,
          v: s.tf30m.volume,
          ch: s.tf30m.change,
          r: Math.round(s.tf30m.rsi)
        } : null,
        // Intraday (Last 3 x 15m Candles) form Yahoo Finance
        candles: s.intraday ? s.intraday.slice(-3).map(c => ({
            o: c.open,
            c: c.close,
            h: c.high,
            v: c.volume
        })) : [],
        // Pressure
        bid: s.bid,
        off: s.offer,
        // Smart Risk
        risk: s.riskScore,
        accum: s.accumulationStatus
      }));

      // =====================================
      // 2️⃣ ANTIGRAVITY PROMPT (HYBRID)
      // =====================================
      const prompt = `
ROLE: Antigravity Ranking Engine (IDX)

TASK:
You are NOT an analyst. You are a RANKING ENGINE.
Your goal is to select the TOP 5 STOCKS most likely to BREAKOUT in the next 30-60 minutes.

DATA CONTEXT:
- "tf30": Snapshot of the LAST 30 MINUTES (TradingView).
- "candles": REAL Intraday 15m Candles (Yahoo Finance). [Oldest ... Newest]

CRITERIA (MUST HAVE):
1. VOLUME SPIKE: High volume in last 30m ("tf30.v") vs daily context.
2. INTRADAY TIMING: Look at "candles" (Last 3):
   - The LATEST candle (last in array) should be GREEN or strongly consolidating.
   - REJECT if the latest candle is a massive RED dump.
3. PRE-BREAKOUT: Price consolidating or pushing up, not yet over-extended.
78: 4. MOMENTUM: "tf30.ch" is positive but not exhausted.
79: 5. SMART RISK:
80:    - Prefer "accum" == "Accumulation".
81:    - Avoid "risk" > 80 (Gorengan/Manipulated).

STRICT RULES:
- RANK by probability of immediate move.
- MAX 5 RESULTS.
- IF UNCLEAR -> RETURN EMPTY [].
- IGNORE laggards.

DATA:
${JSON.stringify(market)}

OUTPUT:
RAW JSON ARRAY ONLY. NO MARKDOWN.

FORMAT:
[
  {
    "ticker": "CODE",
    "action": "BUY",
    "entry": number, // Current price or slightly above
    "target": number, // Scalping target (2-4%)
    "stop": number, // Tight stop
    "reason": "Vol Spike + Bid Dom", // Max 5 words
    "reason": "Vol Spike + Bid Dom", // Max 5 words
    "confidence": number, // 80-99
    "risk": number, // Pass through from data
    "accum": string // Pass through from data
  }
]
`;

      // =====================================
      // 🔄 MODEL ROTATION SYSTEM
      // =====================================
      const MODELS = [
        config.groq.model,           // Primary (Env)
        'llama-3.1-8b-instant',        // Fallback 1 (Fast)
        'mixtral-8x7b-32768',           // Fallback 2 (Stable)
        'gemma2-9b-it'               // Fallback 3 (Google)
      ];

      let completion = null;
      let usedModel = '';

      for (const model of MODELS) {
        try {
          usedModel = model;
          completion = await this.client.chat.completions.create({
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are a trading engine that outputs raw JSON arrays only.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.1,
            max_tokens: 800
          });
          
          if (completion) break; // Success

        } catch (err: any) {
          console.warn(`[AIService] Model ${model} failed (Status: ${err.status || 'Unknown'}). Switching...`);
          // If it's NOT a rate limit (e.g. invalid key), maybe stop? 
          // But for robustness, we just try next.
          continue;
        }
      }

      if (!completion) {
        console.error('[AIService] All models exhausted. Aborting scan.');
        return [];
      }

      const raw = completion.choices[0].message.content;
      console.log(`[AIService] Success with ${usedModel}`);

      // =====================================
      // 3️⃣ SAFE PARSE
      // =====================================
      const signals = this.safeParse<AISignal[]>(raw);
      if (!signals || signals.length === 0) return [];

      // =====================================
      // 4️⃣ HARD ANTIGRAVITY FILTERS
      // =====================================
      const filtered = signals
        // sanity check
        .filter(s =>
          s &&
          s.ticker &&
          s.entry > 0 &&
          s.target > 0 &&
          s.stop > 0
        )
        // confidence normalization + gate
        .filter(s => {
          const normalized =
            s.confidence <= 1 ? s.confidence * 100 : s.confidence;
          return normalized >= 75;
        })
        // risk / reward rule
        .filter(s => (s.target - s.entry) >= (s.entry - s.stop))
        // logical structure
        .filter(s => s.stop < s.entry && s.entry < s.target);

      if (filtered.length === 0) return [];

      // =====================================
      // 5️⃣ MAP TO APP INTERFACE
      // =====================================
      return filtered
        .map<AIRecommendation>(s => {
          const normalizedConfidence =
            s.confidence <= 1
              ? Math.round(s.confidence * 100)
              : Math.round(s.confidence);

          const originalStock = stocks.find(stock => stock.ticker === s.ticker);
          
          return {
            ticker: s.ticker,
            action: 'BUY',
            entryPrice: s.entry,
            targetPrice: s.target,
            stopLoss: s.stop,
            reasoning: s.reason,
            confidence: Math.min(normalizedConfidence, 95), // clamp anti-overconfidence
            transactionValue: originalStock?.transactionValue,
            riskScore: s.risk,
            accumulationStatus: s.accum
          };
        })
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    } catch (err) {
      console.error('[AIService] Antigravity failed:', err);
      return []; // ✅ FAIL SAFE = WAIT
    }
  }

  // =====================================
  // 🔒 SAFE JSON PARSER
  // =====================================
  private safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;

    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return null;

      const clean = match[0]
        .replace(/```json|```/gi, '')
        .trim();

      return JSON.parse(clean) as T;
    } catch {
      return null;
    }
  }
}
