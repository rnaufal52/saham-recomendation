import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  },
  scanner: {
    minVolume: parseInt(process.env.SCANNER_MIN_VOLUME || '5000', 10),
    minChange: parseFloat(process.env.SCANNER_MIN_CHANGE || '0.2'),
    topLimit: parseInt(process.env.SCANNER_TOP_LIMIT || '40', 10)
  }
};
