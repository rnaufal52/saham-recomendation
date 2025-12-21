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
  if (process.env.NODE_ENV !== 'production') return true; // Dev always active

  const now = getJakartaDate();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const isMorningGold = hour === 9 || (hour === 10 && minute <= 15);
  const isAfternoonGold = hour === 13 && minute >= 30 || hour === 14 && minute <= 30;

  return isMorningGold || isAfternoonGold;
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
