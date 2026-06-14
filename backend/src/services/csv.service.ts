import { parse } from 'csv-parse/sync';
import * as fs from 'fs';

export function parseAmount(amountStr: any): number {
  if (amountStr === null || amountStr === undefined || amountStr === '') return NaN;
  const clean = String(amountStr).replace(/[^0-9.-]/g, '');
  const val = Number(clean);
  return isNaN(val) ? NaN : val;
}

export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  // e.g. "March-28" or "Mar 28"
  const m1 = clean.toLowerCase().match(/^([a-z]{3,9})[-/\s](\d{1,2})$/);
  if (m1) {
    const month = monthMap[m1[1].slice(0, 3)];
    const day = m1[2].padStart(2, '0');
    if (month) {
      return new Date(`2026-${String(month).padStart(2, '0')}-${day}`);
    }
  }

  // e.g. "28-March" or "28 Mar"
  const m2 = clean.toLowerCase().match(/^(\d{1,2})[-/\s]([a-z]{3,9})$/);
  if (m2) {
    const day = m2[1].padStart(2, '0');
    const month = monthMap[m2[2].slice(0, 3)];
    if (month) {
      return new Date(`2026-${String(month).padStart(2, '0')}-${day}`);
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [_, day, month, year] = dmyMatch;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const [_, year, month, day] = ymdMatch;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

export interface ParsedCsvRow {
  date: string;
  description: string;
  amount: string;
  currency: string;
  paid_by: string;
  split_with?: string;
  [key: string]: any; // Allow custom columns
}

/**
 * parseCSV(filePath) -> Array of normalized objects
 */
export function parseCSV(filePath: string): ParsedCsvRow[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: false,
  });

  return records.map((r: any) => {
    const normalised: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      normalised[k.toLowerCase().replace(/\s+/g, '_')] = String(v);
    }
    return normalised as any as ParsedCsvRow;
  });
}
