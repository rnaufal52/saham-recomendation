
import { ScannerService } from './src/services/scannerService';
import { AIService } from './src/services/aiService';
import { config } from './src/config';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('--- STARTING HYBRID TEST ---');
    
    // MOCK AI to save tokens, we just want to test the Scanner flow first
    const scanner = new ScannerService();
    
    console.log('1. Scanning Market (TradingView + Yahoo Finance)...');
    const stocks = await scanner.scanMarket();
    
    console.log(`2. Result: ${stocks.length} candidates.`);
    stocks.forEach(s => {
        console.log(`   [${s.ticker}] Price: ${s.lastPrice} | Intraday Candles: ${s.intraday ? s.intraday.length : 0}`);
        if (s.intraday && s.intraday.length > 0) {
            const last = s.intraday[s.intraday.length-1];
            console.log(`       Last 15m: O:${last.open} C:${last.close} V:${last.volume}`);
        }
    });
}

run();
