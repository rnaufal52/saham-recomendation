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
  confidence: number; // bisa 0–1 ATAU 0–100 (dinormalisasi)
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
        r: Math.round(s.rsi ?? 50),
        v: s.volume
      }));

      // =====================================
      // 2️⃣ ANTIGRAVITY PROMPT (STRICT)
      // =====================================
      const prompt = `
ROLE: Antigravity Scalping Engine (IDX)

PRINCIPLES:
- Capital preservation first
- WAIT is always acceptable
- Do NOT force trades

ALLOWED SETUPS:
1. Momentum:
   - Strong price move
   - High relative volume
   - RSI > 50 (not exhausted)
2. Reversal:
   - Sharp drop
   - RSI < 30
   - Clear rejection

REJECT IF:
- Sideways market
- Weak volume
- RSI 35–65 without momentum
- Poor Risk/Reward
- Entry not clear

RULES:
- Timeframe: 1–15 minutes
- Max 5 signals
- If no strong setup exists, return EMPTY ARRAY []

DATA:
${JSON.stringify(market)}

OUTPUT:
RAW JSON ARRAY ONLY
NO markdown
NO text
NO backticks

FORMAT:
[
  {
    "ticker": "CODE",
    "action": "BUY",
    "entry": number,
    "target": number,
    "stop": number,
    "reason": "max 8 words",
    "confidence": number (0–100)
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

          return {
            ticker: s.ticker,
            action: 'BUY',
            entryPrice: s.entry,
            targetPrice: s.target,
            stopLoss: s.stop,
            reasoning: s.reason,
            confidence: Math.min(normalizedConfidence, 95) // clamp anti-overconfidence
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
