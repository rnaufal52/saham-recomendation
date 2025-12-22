const axios = require('axios');

async function testYF() {
  const symbol = 'BBCA.JK';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=1d`;
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const result = data.chart.result[0];
    const quote = result.indicators.quote[0];
    
    console.log('Success!');
    console.log('Symbol:', result.meta.symbol);
    console.log('Candles:', result.timestamp.length);
    console.log('Last Close:', quote.close[quote.close.length - 1]);
    
  } catch (err) {
    console.error('YF Failed:', err.message);
    if (err.response) console.error('Status:', err.response.status);
  }
}

testYF();
