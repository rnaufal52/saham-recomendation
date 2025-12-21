import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { getDashboard } from './controllers/dashboardController';
import { config } from './config';

dotenv.config();

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app: Application = express();
// Port handled in config

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"], // Tailwind CDN
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(cors());
app.use(express.json());

// Serve static files (Compiled JS from dist/client)
// If running via ts-node (src), we need to point to ../dist/client
// If running via node (dist), we point to ./client
const isTsNode = __dirname.includes('src');
const clientDir = isTsNode 
    ? path.join(__dirname, '../dist/client') 
    : path.join(__dirname, 'client');

app.use('/js', express.static(clientDir));
// Serve specific HTML entry point
app.get('/', (req: Request, res: Response) => {
    // We send the source HTML directly as it doesn't need compilation
    // In ts-node: src/client/index.html
    // In node dist: ../src/client/index.html (since we only compile TS)
    // Actually, simpler to just resolve from process.cwd()
    res.sendFile(path.join(process.cwd(), 'src/client/index.html'));
});

// API Routes
app.get('/api/market-advice', getDashboard);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
