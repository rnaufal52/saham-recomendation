export interface StockData {
  ticker: string;
  lastPrice: number;
  changePercent: number;
  change: number;
  rsi?: number;
  volume: number;
}

export interface AIRecommendation {
  ticker: string;
  action: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  reasoning: string;
  confidence: number; // 0-100
}

export interface MarketAnalysisResult {
  timestamp: Date;
  recommendations: AIRecommendation[];
}
