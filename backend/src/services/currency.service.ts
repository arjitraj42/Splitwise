import axios from 'axios';

const rateCache = new Map<string, number>();

// A realistic fallback rate map for offline/API failures
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { INR: 83.3, USD: 1.0 },
  INR: { USD: 1 / 83.3, INR: 1.0 },
};

export async function getExchangeRate(from: string, to: string, date: Date | string): Promise<number> {
  const fromCurr = from.trim().toUpperCase();
  const toCurr = to.trim().toUpperCase();

  if (fromCurr === toCurr) return 1.0;

  const dateStr = typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
  const cacheKey = `${fromCurr}_${toCurr}_${dateStr}`;

  if (rateCache.has(cacheKey)) {
    return rateCache.get(cacheKey)!;
  }

  try {
    const key = process.env.EXCHANGE_RATE_API_KEY || '';
    // Modern exchangerate.host URL or a standard free converter
    const url = `https://api.exchangerate.host/${dateStr}?access_key=${key}&base=${fromCurr}&symbols=${toCurr}`;
    const { data } = await axios.get(url, { timeout: 1500 });
    const rate = data?.rates?.[toCurr];

    if (!rate || isNaN(Number(rate))) {
      throw new Error('Invalid rate in response');
    }

    rateCache.set(cacheKey, rate);
    return rate;
  } catch (err: any) {
    // Graceful fallback to static rate map
    const fallbackVal = FALLBACK_RATES[fromCurr]?.[toCurr];
    if (fallbackVal !== undefined) {
      console.warn(`[currency] API error for ${fromCurr}→${toCurr} on ${dateStr}: ${err.message}. Using fallback: ${fallbackVal}`);
      return fallbackVal;
    }
    console.warn(`[currency] API error and no fallback rate configured for ${fromCurr}→${toCurr} on ${dateStr}: ${err.message}. Using 1.0.`);
    return 1.0;
  }
}
