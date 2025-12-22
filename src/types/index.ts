export interface StockData {
  ticker: string;
  lastPrice: number;
  changePercent: number;
  change: number;
  rsi?: number;
  volume: number;
  // Extra fields for Antigravity rules
  open?: number;
  high?: number;
  low?: number;
  bid?: number;
  offer?: number;
  avgVolume?: number;
  transactionValue?: number; // Price * Volume
  // Timeframe specific data (30m)
  tf30m?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    rsi: number;
  };
  // Hybrid Intraday Data (Yahoo Finance 15m)
  intraday?: {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  // Risk & Analysis
  riskScore?: number;
  accumulationStatus?: 'Accumulation' | 'Distribution' | 'Neutral';
}

export interface AIRecommendation {
  ticker: string;
  action: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  reasoning: string;
  confidence: number; // 0-100
  transactionValue?: number;
  riskScore?: number;
  accumulationStatus?: string;
}

export interface MarketAnalysisResult {
  timestamp: Date;
  recommendations: AIRecommendation[];
}
