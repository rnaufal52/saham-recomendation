export const TIMEZONE = 'Asia/Jakarta';

/**
 * Returns the current date/time in Jakarta (WIB)
 */
export function getJakartaDate(): Date {
  const now = new Date();
  const jakartaStr = now.toLocaleString('en-US', { timeZone: TIMEZONE, hour12: false });
  return new Date(jakartaStr);
}

/**
 * Checks if current Jakarta time is within Golden Hours
 * Morning: 09:00 - 10:15
 * Afternoon: 13:30 - 14:30
 */
export function isJakartaTradingHour(force = false): boolean {
  if (force) return true;
  
  // DEVELOPMENT: Scan Continuously
  // "jika tidak development dia bisa scan terus" -> interpreted as:
  // IF DEV -> SCAN TERUS
  // IF PROD -> FOLLOW GOLDEN HOUR
  if (process.env.NODE_ENV === 'development') return true; 

  const now = getJakartaDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 100 + minute;

  // GOLDEN HOUR RULES (PRODUCTION)
  // Sesi 1: 09:00 - 11:30 (Extended slightly to catch late breakout)
  // Sesi 2: 13:30 - 14:50 (Pre-closing)
  const isSesi1 = time >= 900 && time <= 1130;
  const isSesi2 = time >= 1330 && time <= 1450;

  return isSesi1 || isSesi2;
}

/**
 * Returns formatted Jakarta time string (HH:MM)
 */
export function getJakartaTimeStr(): string {
  return new Date().toLocaleTimeString('id-ID', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });
}

/**
 * Returns formatted Jakarta Date string (YYYY-MM-DD or similar for comparison)
 */
export function getJakartaDateStr(dateInput?: Date | string): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  return date.toLocaleDateString('en-US', { timeZone: TIMEZONE });
}
