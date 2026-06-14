import { parseAmount, parseDate, ParsedCsvRow } from './csv.service';

export interface AnomalyResult {
  detector: string;
  severity: 'WARNING' | 'ERROR';
  suggestedAction: string;
}

export const SETTLEMENT_KEYWORDS = ['paid back', 'settle', 'repay', 'reimburs', 'transfer', 'returned', 'sent back', 'refunded'];
const SUPPORTED_CURRENCIES = ['INR', 'USD'];

function normalizeName(name: string): string {
  if (!name) return '';
  const lower = name.trim().toLowerCase();
  // Align with existing seed/import controller aliases
  if (lower === 'priya s' || lower === 'priya') return 'Priya';
  if (lower === 'rohan') return 'Rohan';
  if (lower === 'aisha') return 'Aisha';
  if (lower === 'meera') return 'Meera';
  if (lower === 'dev') return 'Dev';
  if (lower === 'sam') return 'Sam';
  return name.trim();
}

export function runAnomalyDetectors(
  row: ParsedCsvRow,
  allRows: ParsedCsvRow[],
  groupMembers: { userId: number; user: { name: string }; joinedAt: Date; leftAt: Date | null }[],
  allUsers: { id: number; name: string }[],
  groupExpenses: { date: Date; amount: number; currency: string; description: string; paidById: number }[],
  groupSettlements: { settlementDate: Date; amount: number; currency: string; fromUserId: number; toUserId: number }[]
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];

  const rawDesc = row.description || '';
  const cleanDesc = rawDesc.trim();
  const rawPayer = row.paid_by || '';
  const cleanPayer = rawPayer.trim();
  const rawDate = row.date || '';
  const cleanDate = rawDate.trim();
  const rawAmount = row.amount || '';
  const cleanAmount = rawAmount.trim();
  const rawCurrency = row.currency || '';
  const cleanCurrency = rawCurrency.trim().toUpperCase();

  // 1. Missing required fields
  const missingFields: string[] = [];
  if (!cleanDate) missingFields.push('date');
  if (!cleanPayer) missingFields.push('paid_by');
  if (!cleanAmount) missingFields.push('amount');
  if (missingFields.length > 0) {
    anomalies.push({
      detector: 'missing_fields',
      severity: 'ERROR',
      suggestedAction: `Reject: required field(s) missing: ${missingFields.join(', ')}.`,
    });
    // If essential fields are missing, return early since other detectors will fail
    return anomalies;
  }

  // 2. Empty description
  if (!cleanDesc) {
    anomalies.push({
      detector: 'empty_description',
      severity: 'WARNING',
      suggestedAction: 'Review: description is blank. Will default to "Imported Expense" if approved.',
    });
  }

  // 3. Invalid date
  const parsedDate = parseDate(cleanDate);
  if (!parsedDate) {
    anomalies.push({
      detector: 'bad_date_format',
      severity: 'ERROR',
      suggestedAction: `Reject: "${cleanDate}" is not a recognisable date format. Expected DD-MM-YYYY or YYYY-MM-DD.`,
    });
  }

  // 4. Future date
  if (parsedDate && parsedDate.getTime() > Date.now()) {
    anomalies.push({
      detector: 'future_date',
      severity: 'WARNING',
      suggestedAction: `Review: transaction date ${parsedDate.toISOString().slice(0, 10)} is in the future. Verify if correct.`,
    });
  }

  // 5. Invalid amount (non-numeric)
  const amountVal = parseAmount(cleanAmount);
  if (isNaN(amountVal)) {
    anomalies.push({
      detector: 'invalid_amount',
      severity: 'ERROR',
      suggestedAction: `Reject: "${cleanAmount}" is not a valid numeric amount.`,
    });
  }

  // 6. Zero amount
  if (!isNaN(amountVal) && amountVal === 0) {
    anomalies.push({
      detector: 'zero_amount',
      severity: 'ERROR',
      suggestedAction: 'Reject: amount is zero. Expenses must have a positive or negative value.',
    });
  }

  // 7. Negative amount
  if (!isNaN(amountVal) && amountVal < 0) {
    anomalies.push({
      detector: 'negative_amount',
      severity: 'WARNING',
      suggestedAction: 'Review: negative amount. Approve if it cancels out/corrects another expense; reject otherwise.',
    });
  }

  // 8. Invalid currency code
  if (cleanCurrency && !SUPPORTED_CURRENCIES.includes(cleanCurrency)) {
    anomalies.push({
      detector: 'invalid_currency_code',
      severity: 'ERROR',
      suggestedAction: `Reject: currency "${cleanCurrency}" is not supported. Only INR and USD are allowed.`,
    });
  }

  // 9. Settlement logged as expense
  const isSettlementKeyword = SETTLEMENT_KEYWORDS.some((kw) => cleanDesc.toLowerCase().includes(kw));
  if (isSettlementKeyword) {
    anomalies.push({
      detector: 'settlement_as_expense',
      severity: 'WARNING',
      suggestedAction: 'Reclassify: description suggests a settlement/repayment. Approve to write to settlements table instead of expenses.',
    });
  }

  // Normalize user names for lookup
  const normPayer = normalizeName(cleanPayer);
  const payerUser = allUsers.find((u) => u.name.toLowerCase() === normPayer.toLowerCase());
  const payerMembership = payerUser ? groupMembers.find((m) => m.userId === payerUser.id) : null;

  // 10. Unknown member (Payer)
  if (normPayer.toLowerCase() !== "dev's friend kabir") {
    if (!payerUser) {
      anomalies.push({
        detector: 'unknown_member',
        severity: 'WARNING',
        suggestedAction: `Review: payer "${cleanPayer}" is not registered in the system. Will register and join them if approved.`,
      });
    } else if (!payerMembership) {
      anomalies.push({
        detector: 'unknown_member',
        severity: 'WARNING',
        suggestedAction: `Review: payer "${cleanPayer}" is not a member of this group. Will add them to the group if approved.`,
      });
    }
  }

  // Check split_with participants
  const splitWithStr = row.split_with || '';
  const splitNames = splitWithStr.split(';').map((n) => n.trim()).filter(Boolean);

  splitNames.forEach((name) => {
    const normName = normalizeName(name);
    if (normName.toLowerCase() === "dev's friend kabir") return; // Kabir is excluded from system registration

    const spUser = allUsers.find((u) => u.name.toLowerCase() === normName.toLowerCase());
    const spMembership = spUser ? groupMembers.find((m) => m.userId === spUser.id) : null;

    if (!spUser) {
      anomalies.push({
        detector: 'unknown_member',
        severity: 'WARNING',
        suggestedAction: `Review: participant "${name}" is not registered in the system. Will register and join them if approved.`,
      });
    } else if (!spMembership) {
      anomalies.push({
        detector: 'unknown_member',
        severity: 'WARNING',
        suggestedAction: `Review: participant "${name}" is not a member of this group. Will add them to the group if approved.`,
      });
    }

    // 11. Expense after member left / joined timing checks
    if (parsedDate && spMembership) {
      if (spMembership.leftAt && parsedDate >= new Date(spMembership.leftAt)) {
        anomalies.push({
          detector: 'expense_after_member_left',
          severity: 'WARNING',
          suggestedAction: `Review: transaction date falls after participant "${name}" left the group (${new Date(spMembership.leftAt).toISOString().slice(0, 10)}).`,
        });
      }
      if (parsedDate < new Date(spMembership.joinedAt)) {
        anomalies.push({
          detector: 'expense_before_member_joined',
          severity: 'WARNING',
          suggestedAction: `Review: transaction date falls before participant "${name}" joined the group (${new Date(spMembership.joinedAt).toISOString().slice(0, 10)}).`,
        });
      }
    }
  });

  // Payer timing checks
  if (parsedDate && payerMembership) {
    if (payerMembership.leftAt && parsedDate >= new Date(payerMembership.leftAt)) {
      anomalies.push({
        detector: 'expense_after_member_left',
        severity: 'WARNING',
        suggestedAction: `Review: transaction date falls after payer "${cleanPayer}" left the group (${new Date(payerMembership.leftAt).toISOString().slice(0, 10)}).`,
      });
    }
    if (parsedDate < new Date(payerMembership.joinedAt)) {
      anomalies.push({
        detector: 'expense_before_member_joined',
        severity: 'WARNING',
        suggestedAction: `Review: transaction date falls before payer "${cleanPayer}" joined the group (${new Date(payerMembership.joinedAt).toISOString().slice(0, 10)}).`,
      });
    }
  }

  // 12. Duplicate expense in same batch / database
  if (parsedDate && !isNaN(amountVal)) {
    // Check inside this batch (same date, amount, description)
    const dupesInBatch = allRows.filter(
      (r) =>
        r !== row &&
        r.date === row.date &&
        parseAmount(r.amount) === amountVal &&
        (r.description || '').trim().toLowerCase() === cleanDesc.toLowerCase()
    );

    // Check inside database
    const dupesInDb = groupExpenses.filter(
      (e) =>
        new Date(e.date).toISOString().slice(0, 10) === parsedDate.toISOString().slice(0, 10) &&
        Math.abs(Number(e.amount) - amountVal) < 0.01 &&
        e.description.trim().toLowerCase() === cleanDesc.toLowerCase()
    );

    if (dupesInBatch.length > 0 || dupesInDb.length > 0) {
      anomalies.push({
        detector: 'duplicate',
        severity: 'WARNING',
        suggestedAction: 'Review: identical transaction found. Flagged as duplicate. Require manual approval to import.',
      });
    }
  }

  // 13. Currency mismatch
  // Assuming group base currency is INR for standard consolidation, any USD is flagged for warning review
  if (cleanCurrency && cleanCurrency === 'USD') {
    anomalies.push({
      detector: 'currency_mismatch',
      severity: 'WARNING',
      suggestedAction: 'Review: USD currency transaction will be converted to INR. Verify exchange rate.',
    });
  }

  // 14. Duplicate settlement
  if (isSettlementKeyword && parsedDate && !isNaN(amountVal) && payerUser) {
    // Determine possible receiver
    const receiverName = splitNames[0] || '';
    const normReceiver = normalizeName(receiverName);
    const receiverUser = allUsers.find((u) => u.name.toLowerCase() === normReceiver.toLowerCase());

    if (receiverUser) {
      const dbDupes = groupSettlements.filter(
        (s) =>
          new Date(s.settlementDate).toISOString().slice(0, 10) === parsedDate.toISOString().slice(0, 10) &&
          Math.abs(Number(s.amount) - amountVal) < 0.01 &&
          s.fromUserId === payerUser.id &&
          s.toUserId === receiverUser.id
      );

      if (dbDupes.length > 0) {
        anomalies.push({
          detector: 'duplicate_settlement',
          severity: 'WARNING',
          suggestedAction: 'Review: duplicate settlement record exists. Reject or verify if duplicate.',
        });
      }
    }
  }

  return anomalies;
}
