import { IExpenseRepository } from '../repositories/interfaces/expense.repository.interface';
import { IGroupRepository } from '../repositories/interfaces/group.repository.interface';
import { getExchangeRate } from './currency.service';
import { computeSplits, SplitItem } from './split.service';

export class ExpenseService {
  constructor(
    private expenseRepo: IExpenseRepository,
    private groupRepo: IGroupRepository
  ) {}

  async createExpense(data: {
    groupId: number;
    paidById: number;
    amount: number;
    currency: string;
    description: string;
    date: Date | string;
    splitType: string;
    splitData: { userIds?: number[]; splits?: SplitItem[] };
    importBatchId?: number;
  }) {
    const expenseDate = new Date(data.date);
    const currency = (data.currency || 'INR').trim().toUpperCase();

    // 1. Fetch group members and their active timing windows
    const memberships = await this.groupRepo.getMemberships(data.groupId);
    if (!memberships.length) {
      throw new Error('Group does not exist or has no members');
    }

    // 2. Validate timing window for payer
    const payerMembership = memberships.find((m) => m.userId === data.paidById);
    if (!payerMembership) {
      throw new Error(`Payer is not a member of the group`);
    }

    const joined = new Date(payerMembership.joinedAt);
    const left = payerMembership.leftAt ? new Date(payerMembership.leftAt) : null;
    if (expenseDate < joined || (left && expenseDate >= left)) {
      throw new Error(`Payer is not active on the expense date (${expenseDate.toISOString().slice(0, 10)})`);
    }

    // 3. Determine active userIds for split calculation
    let targetParticipantIds: number[] = [];

    if (data.splitType === 'EQUAL') {
      // If EQUAL, default to all members active on expense date if userIds is not supplied
      const inputIds = data.splitData.userIds;
      if (inputIds && inputIds.length > 0) {
        targetParticipantIds = inputIds;
      } else {
        // Auto-select active members on the expense date
        targetParticipantIds = memberships
          .filter((m) => {
            const j = new Date(m.joinedAt);
            const l = m.leftAt ? new Date(m.leftAt) : null;
            return j <= expenseDate && (!l || expenseDate < l);
          })
          .map((m) => m.userId);
      }
    } else {
      // EXACT, PERCENTAGE, SHARES use splits array
      const inputSplits = data.splitData.splits;
      if (!inputSplits || !inputSplits.length) {
        throw new Error('This split type requires shares definition');
      }
      targetParticipantIds = inputSplits.map((s) => s.userId);
    }

    if (!targetParticipantIds.length) {
      throw new Error('No active group members to split with on this date');
    }

    // 4. Validate timing window for split participants
    targetParticipantIds.forEach((uId) => {
      const mem = memberships.find((m) => m.userId === uId);
      if (!mem) {
        throw new Error(`Participant (ID: ${uId}) is not in the group`);
      }
      const j = new Date(mem.joinedAt);
      const l = mem.leftAt ? new Date(mem.leftAt) : null;
      if (expenseDate < j || (l && expenseDate >= l)) {
        throw new Error(`Participant "${mem.user?.name || uId}" is not active on this date`);
      }
    });

    // 5. Convert original currency to INR
    let exchangeRate = 1.0;
    let amountInInr = Number(data.amount);
    if (currency !== 'INR') {
      exchangeRate = await getExchangeRate(currency, 'INR', expenseDate);
      amountInInr = Number(data.amount) * exchangeRate;
    }

    // 6. Calculate splits
    const finalSplits = computeSplits(
      data.splitType,
      amountInInr,
      data.splitType === 'EQUAL' ? { userIds: targetParticipantIds } : data.splitData
    );

    // 7. Save to repository
    return this.expenseRepo.create({
      groupId: data.groupId,
      paidById: data.paidById,
      amount: data.amount,
      currency,
      amountInInr,
      exchangeRate,
      description: data.description,
      date: expenseDate,
      splitType: data.splitType,
      splits: finalSplits,
      importBatchId: data.importBatchId,
    });
  }

  async getExpenseDetails(id: number) {
    const expense = await this.expenseRepo.findById(id);
    if (!expense) throw new Error('Expense not found');
    return expense;
  }

  async listExpensesForGroup(groupId: number) {
    return this.expenseRepo.findByGroup(groupId);
  }

  async updateExpense(
    id: number,
    data: {
      paidById?: number;
      amount?: number;
      currency?: string;
      description?: string;
      date?: Date | string;
      splitType?: string;
      splitData?: { userIds?: number[]; splits?: SplitItem[] };
    }
  ) {
    const existing = await this.expenseRepo.findById(id);
    if (!existing) throw new Error('Expense not found');

    const newDate = data.date ? new Date(data.date) : new Date(existing.date);
    const newAmount = data.amount !== undefined ? Number(data.amount) : Number(existing.amount);
    const newCurrency = (data.currency || existing.currency).trim().toUpperCase();
    const newPaidById = data.paidById || existing.paidById;

    // Fetch group memberships to validatetiming
    const memberships = await this.groupRepo.getMemberships(existing.groupId);

    // Validate timing window for payer
    const payerMem = memberships.find((m) => m.userId === newPaidById);
    if (!payerMem) throw new Error('Payer is not in the group');
    const j = new Date(payerMem.joinedAt);
    const l = payerMem.leftAt ? new Date(payerMem.leftAt) : null;
    if (newDate < j || (l && newDate >= l)) {
      throw new Error(`Payer is not active on this date`);
    }

    // Convert currency if changed
    let exchangeRate = Number(existing.exchangeRate);
    let amountInInr = Number(existing.amountInInr);
    if (data.amount !== undefined || data.currency !== undefined || data.date !== undefined) {
      if (newCurrency !== 'INR') {
        exchangeRate = await getExchangeRate(newCurrency, 'INR', newDate);
        amountInInr = newAmount * exchangeRate;
      } else {
        exchangeRate = 1.0;
        amountInInr = newAmount;
      }
    }

    // Recompute splits if splits data, splitType, or amount changed
    let finalSplits = undefined;
    if (data.splitData || data.splitType || data.amount !== undefined || data.currency !== undefined) {
      const splitType = data.splitType || existing.splitType;
      
      let targetParticipantIds: number[] = [];
      if (splitType === 'EQUAL') {
        const inputIds = data.splitData?.userIds;
        if (inputIds && inputIds.length > 0) {
          targetParticipantIds = inputIds;
        } else {
          // Use members active on the new date
          targetParticipantIds = memberships
            .filter((m) => {
              const j = new Date(m.joinedAt);
              const l = m.leftAt ? new Date(m.leftAt) : null;
              return j <= newDate && (!l || newDate < l);
            })
            .map((m) => m.userId);
        }
      } else {
        const inputSplits = data.splitData?.splits;
        if (!inputSplits || !inputSplits.length) {
          throw new Error('Custom split details required');
        }
        targetParticipantIds = inputSplits.map((s) => s.userId);
      }

      if (!targetParticipantIds.length) {
        throw new Error('No active members to split with on this date');
      }

      // Timing validation for participants
      targetParticipantIds.forEach((uId) => {
        const mem = memberships.find((m) => m.userId === uId);
        if (!mem) throw new Error(`Participant is not in the group`);
        const j = new Date(mem.joinedAt);
        const l = mem.leftAt ? new Date(mem.leftAt) : null;
        if (newDate < j || (l && newDate >= l)) {
          throw new Error(`Participant "${mem.user?.name || uId}" is not active on this date`);
        }
      });

      finalSplits = computeSplits(
        splitType,
        amountInInr,
        splitType === 'EQUAL' ? { userIds: targetParticipantIds } : (data.splitData || { splits: [] })
      );
    }

    return this.expenseRepo.update(id, {
      paidById: newPaidById,
      amount: newAmount,
      currency: newCurrency,
      amountInInr,
      exchangeRate,
      description: data.description,
      date: newDate,
      splitType: data.splitType,
      splits: finalSplits,
    });
  }

  async deleteExpense(id: number) {
    const existing = await this.expenseRepo.findById(id);
    if (!existing) throw new Error('Expense not found');
    await this.expenseRepo.delete(id);
  }
}
