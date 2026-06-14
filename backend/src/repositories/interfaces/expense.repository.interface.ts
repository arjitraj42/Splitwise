import { Expense, ExpenseSplit } from '@prisma/client';

export interface IExpenseRepository {
  create(data: {
    groupId: number;
    paidById: number;
    amount: number;
    currency: string;
    amountInInr: number;
    exchangeRate: number;
    description: string;
    date: Date;
    splitType: string;
    splits: { userId: number; shareAmount: number }[];
    importBatchId?: number;
  }): Promise<Expense & { splits: ExpenseSplit[] }>;
  
  findById(id: number): Promise<(Expense & { paidBy: any; splits: any[] }) | null>;
  findByGroup(groupId: number): Promise<any[]>;
  
  update(
    id: number,
    data: {
      paidById?: number;
      amount?: number;
      currency?: string;
      amountInInr?: number;
      exchangeRate?: number;
      description?: string;
      date?: Date;
      splitType?: string;
      splits?: { userId: number; shareAmount: number }[];
    }
  ): Promise<Expense & { splits: ExpenseSplit[] }>;
  
  delete(id: number): Promise<void>;
  
  findUserPaidExpensesInGroup(groupId: number, userId: number, joinedAt: Date, leftAt?: Date | null): Promise<any[]>;
  findUserSharesInGroup(groupId: number, userId: number, joinedAt: Date, leftAt?: Date | null): Promise<any[]>;
}
