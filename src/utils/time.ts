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
 * Morning: 08:30 - 10:15
 * Afternoon: 12:30 - 14:30
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

  // Sesi 1: 08:30 - 11:30 (Extended slightly to catch late breakout)
  // Sesi 2: 12:30 - 14:50 (Pre-closing)
  // Sesi Malam: 21:00 - 22:00
  const isSesi1 = time >= 830 && time <= 1130;
  const isSesi2 = time >= 1230 && time <= 1450;
  const isNightSession = time >= 2100 && time <= 2200;

  return isSesi1 || isSesi2 || isNightSession;
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

/**
 * Returns the timestamp of the last Reset moment (Last Friday 16:00)
 */
export function getLastHistoryResetTime(): Date {
  const now = getJakartaDate();
  const day = now.getDay(); // 0 (Sun) - 6 (Sat)
  const hours = now.getHours();

  // Target: Friday (5) at 16:00
  const resetDay = 5;
  const resetHour = 16;

  let resetTime = new Date(now);
  resetTime.setHours(resetHour, 0, 0, 0);

  // If today is Friday
  if (day === resetDay) {
    // If before 16:00, then the last reset was LAST week's Friday
    if (hours < resetHour) {
      resetTime.setDate(now.getDate() - 7);
    }
    // If after 16:00, then the reset was TODAY at 16:00 (so we keep resetTime as is)
  }
  // If today is AFTER Friday (Saturday 6)
  else if (day > resetDay) {
    resetTime.setDate(now.getDate() - (day - resetDay));
  }
  // If today is BEFORE Friday (Sun 0 - Thu 4)
  else {
    // Calculate days to go back to previous Friday
    // e.g. Mon (1) -> go back 3 days to Fri
    // (1 + 7) - 5 = 3
    // Sun (0) -> go back 2 days to Fri
    // (0 + 7) - 5 = 2
    const daysSinceFriday = (day + 7) - resetDay;
    resetTime.setDate(now.getDate() - daysSinceFriday);
  }

  return resetTime;
}
