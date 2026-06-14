import * as fs from 'fs';
import bcrypt from 'bcryptjs';
import { IImportRepository } from '../repositories/interfaces/import.repository.interface';
import { IGroupRepository } from '../repositories/interfaces/group.repository.interface';
import { IUserRepository } from '../repositories/interfaces/user.repository.interface';
import { IExpenseRepository } from '../repositories/interfaces/expense.repository.interface';
import { ISettlementRepository } from '../repositories/interfaces/settlement.repository.interface';
import { parseCSV, parseAmount, parseDate, ParsedCsvRow } from './csv.service';
import { runAnomalyDetectors, SETTLEMENT_KEYWORDS } from './anomaly.service';
import { computeSplits } from './split.service';
import { getExchangeRate } from './currency.service';

const ALIAS_MAP: Record<string, string> = {
  'priya s': 'Priya',
  'priya': 'Priya',
  'rohan': 'Rohan',
  'aisha': 'Aisha',
  'meera': 'Meera',
  'dev': 'Dev',
  'sam': 'Sam',
};

function normalizeName(name: string): string {
  if (!name) return '';
  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (ALIAS_MAP[lower]) {
    return ALIAS_MAP[lower];
  }
  return clean;
}

export class ImportService {
  constructor(
    private importRepo: IImportRepository,
    private groupRepo: IGroupRepository,
    private userRepo: IUserRepository,
    private expenseRepo: IExpenseRepository,
    private settlementRepo: ISettlementRepository
  ) {}

  async importCSV(groupId: number, filePath: string, userId: number) {
    const rows = parseCSV(filePath);
    // Cleanup temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Failed to delete temp file:', err);
    }

    const normalizationsLog: string[] = [];

    // 1. Identify users and their transaction date ranges to automatically manage memberships
    const userDates: Record<string, { earliest: Date; latest: Date }> = {};

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const date = parseDate(row.date);
      if (!date) return;

      // Check paid_by
      if (row.paid_by && row.paid_by.trim()) {
        const normPayer = normalizeName(row.paid_by);
        if (row.paid_by.trim() !== normPayer) {
          normalizationsLog.push(`Row ${rowNum}: '${row.paid_by}' normalized to '${normPayer}'`);
        }

        if (normPayer.toLowerCase() !== "dev's friend kabir") {
          if (!userDates[normPayer]) {
            userDates[normPayer] = { earliest: date, latest: date };
          } else {
            if (date < userDates[normPayer].earliest) userDates[normPayer].earliest = date;
            if (date > userDates[normPayer].latest) userDates[normPayer].latest = date;
          }
        }
      }

      // Check split_with
      if (row.split_with) {
        row.split_with.split(';').forEach((name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          const normName = normalizeName(trimmed);
          if (trimmed !== normName) {
            normalizationsLog.push(`Row ${rowNum}: '${trimmed}' normalized to '${normName}'`);
          }

          if (normName.toLowerCase() !== "dev's friend kabir") {
            if (!userDates[normName]) {
              userDates[normName] = { earliest: date, latest: date };
            } else {
              if (date < userDates[normName].earliest) userDates[normName].earliest = date;
              if (date > userDates[normName].latest) userDates[normName].latest = date;
            }
          }
        });
      }
    });

    // 2. Automatically register new users and establish historical membership dates
    for (const normName of Object.keys(userDates)) {
      const dates = userDates[normName];
      let user = await this.userRepo.findByName(normName);

      if (!user) {
        const emailBase = normName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const email = `${emailBase}@example.com`;
        const passwordHash = await bcrypt.hash('password123', 10);
        user = await this.userRepo.create({
          name: normName,
          email,
          passwordHash,
        });
      }

      // Default membership range: 1 day before earliest transaction to infinity
      const joinedAt = new Date(dates.earliest.getTime() - 24 * 60 * 60 * 1000);
      let leftAt: Date | null = null;

      // Special rule for Meera who left on March 31, 2026
      if (normName.toLowerCase() === 'meera') {
        leftAt = new Date('2026-03-31');
      }

      const membership = await this.groupRepo.findMembership(groupId, user.id);
      if (!membership) {
        await this.groupRepo.addMember(groupId, user.id, joinedAt, leftAt);
      } else {
        // Update membership window based on imported dates
        await this.groupRepo.updateMemberWindow(groupId, user.id, joinedAt, leftAt || membership.leftAt);
      }
    }

    // 3. Fetch fresh group memberships and database references
    const groupMemberships = await this.groupRepo.getMemberships(groupId);
    const allUsers = await this.userRepo.findAll();
    const groupExpenses = await this.expenseRepo.findByGroup(groupId);
    const groupSettlements = await this.settlementRepo.findByGroup(groupId);

    const userMap = new Map<string, any>();
    allUsers.forEach((u) => userMap.set(u.name.toLowerCase().trim(), u));

    // Create the batch import job
    const batch = await this.importRepo.createBatch(
      'CSV_Import',
      userId,
      JSON.stringify(normalizationsLog)
    );

    const cleanRows: { row: ParsedCsvRow; rowNumber: number }[] = [];
    const anomalyInserts: any[] = [];

    // 4. Validate each row against the 14 anomaly detectors
    rows.forEach((row, idx) => {
      const rowNumber = idx + 2;
      const flags = runAnomalyDetectors(
        row,
        rows,
        groupMemberships,
        allUsers,
        groupExpenses,
        groupSettlements
      );

      if (flags.length === 0) {
        cleanRows.push({ row, rowNumber });
      } else {
        flags.forEach((f) => {
          anomalyInserts.push({
            batchId: batch.id,
            rowNumber,
            rowData: JSON.stringify(row),
            detectorName: f.detector,
            suggestedAction: f.suggestedAction,
            status: 'PENDING',
          });
        });
      }
    });

    // Save anomalies to database
    if (anomalyInserts.length > 0) {
      await this.importRepo.createAnomalies(anomalyInserts);
    }

    // 5. Instantly commit the clean rows
    let committedCount = 0;

    for (const item of cleanRows) {
      try {
        const row = item.row;
        const currency = (row.currency || 'INR').trim().toUpperCase();
        let exchangeRate = 1.0;
        const parsedAmt = parseAmount(row.amount);
        let amountInInr = parsedAmt;
        const parsedDt = parseDate(row.date)!;

        if (currency !== 'INR') {
          exchangeRate = await getExchangeRate(currency, 'INR', parsedDt);
          amountInInr = parsedAmt * exchangeRate;
        }

        const normPayer = normalizeName(row.paid_by);
        const payerUser = userMap.get(normPayer.toLowerCase());
        if (!payerUser) continue; // skip if payer missing

        // Determine splits participants active on the date
        let splitUserIds: number[] = [];

        if (row.split_with && row.split_with.trim()) {
          const splitNames = row.split_with.split(';').map((n) => n.trim());
          splitNames.forEach((name) => {
            if (!name) return;
            const normParticipant = normalizeName(name);

            if (normParticipant.toLowerCase() === "dev's friend kabir") {
              // Kabir is excluded from split
              return;
            }

            const u = userMap.get(normParticipant.toLowerCase());
            if (u) {
              const mem = groupMemberships.find((m) => m.userId === u.id);
              if (mem) {
                const j = new Date(mem.joinedAt);
                const l = mem.leftAt ? new Date(mem.leftAt) : null;
                if (j <= parsedDt && (!l || parsedDt < l)) {
                  splitUserIds.push(u.id);
                }
              }
            }
          });
        } else {
          // Default: split among all active group members on this date
          splitUserIds = groupMemberships
            .filter((m) => {
              const j = new Date(m.joinedAt);
              const l = m.leftAt ? new Date(m.leftAt) : null;
              return j <= parsedDt && (!l || parsedDt < l);
            })
            .map((m) => m.userId);
        }

        if (splitUserIds.length === 0) {
          throw new Error('No active group members on this date');
        }

        const splits = computeSplits('EQUAL', amountInInr, {
          userIds: splitUserIds,
        });

        await this.expenseRepo.create({
          groupId,
          paidById: payerUser.id,
          amount: parsedAmt,
          currency,
          amountInInr,
          exchangeRate,
          description: row.description || 'Imported Expense',
          date: parsedDt,
          splitType: 'EQUAL',
          importBatchId: batch.id,
          splits,
        });

        committedCount++;
      } catch (err: any) {
        console.error(`Row ${item.rowNumber} failed to commit:`, err.message);
      }
    }

    return {
      batchId: batch.id,
      totalRows: rows.length,
      committed: committedCount,
      anomalyCount: anomalyInserts.length,
      normalizations: normalizationsLog,
    };
  }

  async getBatchReport(batchId: number) {
    const batch = await this.importRepo.findBatchById(batchId);
    if (!batch) throw new Error('Import batch job not found');

    const report = {
      batch: {
        id: batch.id,
        filename: batch.filename,
        createdAt: batch.createdAt,
      },
      totalRows: batch.expenses.length + batch.anomalies.length,
      committed: batch.expenses.length,
      anomalyCount: batch.anomalies.length,
      anomalies: batch.anomalies.map((a) => ({
        id: a.id,
        rowNumber: a.rowNumber,
        detectorName: a.detectorName,
        suggestedAction: a.suggestedAction,
        status: a.status,
        rowData: JSON.parse(a.rowData),
        resolvedAt: a.resolvedAt,
      })),
      expenses: batch.expenses,
      normalizations: batch.normalizations ? JSON.parse(batch.normalizations) : [],
    };

    return report;
  }

  async listBatchAnomalies(batchId: number) {
    return this.importRepo.findAnomaliesByBatch(batchId);
  }

  async resolveAnomaly(anomalyId: number, action: 'APPROVED' | 'REJECTED', groupId: number) {
    const anomaly = await this.importRepo.findAnomalyById(anomalyId);
    if (!anomaly) throw new Error('Anomaly not found');
    if (anomaly.status !== 'PENDING') throw new Error('Anomaly already resolved');

    if (action === 'APPROVED') {
      const row = JSON.parse(anomaly.rowData) as ParsedCsvRow;
      const desc = row.description || 'Imported Expense';
      const parsedAmt = parseAmount(row.amount);
      const parsedDt = parseDate(row.date);
      const currency = (row.currency || 'INR').trim().toUpperCase();

      if (isNaN(parsedAmt) || !parsedDt) {
        throw new Error('Cannot approve anomaly with invalid date or amount');
      }

      // Check if it is a settlement reclassification
      const isSettlementKeyword = SETTLEMENT_KEYWORDS.some((kw: string) => desc.toLowerCase().includes(kw));
      const allUsers = await this.userRepo.findAll();
      const userMap = new Map<string, any>();
      allUsers.forEach((u) => userMap.set(u.name.toLowerCase().trim(), u));

      const normPayer = normalizeName(row.paid_by);
      const payerUser = userMap.get(normPayer.toLowerCase());

      if (!payerUser) throw new Error(`Payer "${row.paid_by}" does not exist`);

      let exchangeRate = 1.0;
      let inrAmount = parsedAmt;
      if (currency !== 'INR') {
        exchangeRate = await getExchangeRate(currency, 'INR', parsedDt);
        inrAmount = parsedAmt * exchangeRate;
      }

      if (anomaly.detectorName === 'settlement_as_expense' || isSettlementKeyword) {
        // RECLASSIFY: write to settlements table instead
        const splitWithStr = row.split_with || '';
        const receiverName = splitWithStr.split(';')[0]?.trim() || '';
        const normReceiver = normalizeName(receiverName);
        const receiverUser = userMap.get(normReceiver.toLowerCase());

        if (!receiverUser) throw new Error(`Receiver user "${receiverName}" not found for settlement`);

        await this.settlementRepo.create({
          groupId,
          fromUserId: payerUser.id,
          toUserId: receiverUser.id,
          amount: Math.abs(parsedAmt), // ensure positive amount for settlements
          currency,
          exchangeRate,
          normalizedAmountInInr: Math.abs(inrAmount),
          settlementDate: parsedDt,
          note: `Imported Settlement: ${desc}`,
        });
      } else {
        // Standard expense creation
        const groupMemberships = await this.groupRepo.getMemberships(groupId);
        let splitUserIds: number[] = [];

        if (row.split_with && row.split_with.trim()) {
          const splitNames = row.split_with.split(';').map((n) => n.trim());
          splitNames.forEach((name) => {
            if (!name) return;
            const normParticipant = normalizeName(name);
            if (normParticipant.toLowerCase() === "dev's friend kabir") return; // exclude Kabir

            const u = userMap.get(normParticipant.toLowerCase());
            if (u) {
              const mem = groupMemberships.find((m) => m.userId === u.id);
              if (mem) {
                const j = new Date(mem.joinedAt);
                const l = mem.leftAt ? new Date(mem.leftAt) : null;
                if (j <= parsedDt && (!l || parsedDt < l)) {
                  splitUserIds.push(u.id);
                }
              }
            }
          });
        } else {
          // Default: split among all active group members on this date
          splitUserIds = groupMemberships
            .filter((m) => {
              const j = new Date(m.joinedAt);
              const l = m.leftAt ? new Date(m.leftAt) : null;
              return j <= parsedDt && (!l || parsedDt < l);
            })
            .map((m) => m.userId);
        }

        if (splitUserIds.length === 0) {
          throw new Error('No active group members on the transaction date');
        }

        const splits = computeSplits('EQUAL', inrAmount, {
          userIds: splitUserIds,
        });

        await this.expenseRepo.create({
          groupId,
          paidById: payerUser.id,
          amount: parsedAmt,
          currency,
          amountInInr: inrAmount,
          exchangeRate,
          description: desc,
          date: parsedDt,
          splitType: 'EQUAL',
          importBatchId: anomaly.batchId,
          splits,
        });
      }
    }

    return this.importRepo.resolveAnomaly(anomalyId, action);
  }
}
