export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export interface SplitItem {
  userId: number;
  amount?: number;
  percentage?: number;
  shares?: number;
}

export interface ComputedSplit {
  userId: number;
  shareAmount: number;
}

/**
 * computeSplits – converts split intent into an array of { userId, shareAmount }.
 * All amounts are in INR (already converted before this call).
 * Uses two decimal places for paisa precision. Remaining fractional paisas go to the first user.
 */
export function computeSplits(
  splitType: SplitType | string,
  totalAmountInr: number,
  splitData: {
    userIds?: number[];
    splits?: SplitItem[];
  }
): ComputedSplit[] {
  const total = Math.round(Number(totalAmountInr) * 100) / 100; // normalize input to paisa

  switch (splitType) {
    case 'EQUAL': {
      const { userIds } = splitData;
      if (!userIds || !userIds.length) {
        throw new Error('EQUAL split requires userIds array');
      }
      
      const base = Math.floor((total / userIds.length) * 100) / 100; // round down to paisa
      const allocated = base * userIds.length;
      const remainder = Math.round((total - allocated) * 100) / 100;

      return userIds.map((userId, idx) => ({
        userId,
        // The first person (index 0) gets the rounded remainder
        shareAmount: idx === 0 ? Math.round((base + remainder) * 100) / 100 : base,
      }));
    }

    case 'EXACT': {
      const { splits } = splitData;
      if (!splits || !splits.length) {
        throw new Error('EXACT split requires splits array');
      }
      
      const sum = splits.reduce((s, r) => s + Math.round(Number(r.amount || 0) * 100) / 100, 0);
      const roundedSum = Math.round(sum * 100) / 100;

      if (Math.abs(roundedSum - total) > 0.01) {
        throw new Error(`EXACT splits sum (₹${roundedSum}) does not match total (₹${total})`);
      }

      return splits.map((s) => ({
        userId: s.userId,
        shareAmount: Math.round(Number(s.amount || 0) * 100) / 100,
      }));
    }

    case 'PERCENTAGE': {
      const { splits } = splitData;
      if (!splits || !splits.length) {
        throw new Error('PERCENTAGE split requires splits array');
      }

      const sumPct = splits.reduce((s, r) => s + Number(r.percentage || 0), 0);
      if (Math.abs(sumPct - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100, got ${sumPct}`);
      }

      const result = splits.map((s) => {
        const share = Math.floor((total * Number(s.percentage || 0)) / 100 * 100) / 100;
        return {
          userId: s.userId,
          shareAmount: share,
        };
      });

      const allocated = result.reduce((s, r) => s + r.shareAmount, 0);
      const remainder = Math.round((total - allocated) * 100) / 100;
      
      if (result.length > 0) {
        result[0].shareAmount = Math.round((result[0].shareAmount + remainder) * 100) / 100;
      }

      return result;
    }

    case 'SHARES': {
      const { splits } = splitData;
      if (!splits || !splits.length) {
        throw new Error('SHARES split requires splits array');
      }

      const totalShares = splits.reduce((s, r) => s + Number(r.shares || 0), 0);
      if (totalShares <= 0) {
        throw new Error('Total shares must be greater than zero');
      }

      const result = splits.map((s) => {
        const share = Math.floor((total * Number(s.shares || 0)) / totalShares * 100) / 100;
        return {
          userId: s.userId,
          shareAmount: share,
        };
      });

      const allocated = result.reduce((s, r) => s + r.shareAmount, 0);
      const remainder = Math.round((total - allocated) * 100) / 100;

      if (result.length > 0) {
        result[0].shareAmount = Math.round((result[0].shareAmount + remainder) * 100) / 100;
      }

      return result;
    }

    default:
      throw new Error(`Unknown splitType: ${splitType}`);
  }
}
