import { Request, Response } from 'express';
import { MarketService } from '../services/marketService';

// Singleton instance of the service
const marketService = new MarketService();

export const getDashboard = async (req: Request, res: Response) => {
  const forceScan = req.query.force === 'true'; 

  // Delegate all business logic to the service
  const { recommendations, history, lastUpdate, isTradingHours } = await marketService.getMarketAdvice(forceScan);

  // Return JSON for the client-side app
  res.json({
    recommendations,
    history,
    lastUpdate,
    isTradingHours
  });
};
