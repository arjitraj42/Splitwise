import { Expense, ExpenseSplit } from '@prisma/client';
import { IExpenseRepository } from '../interfaces/expense.repository.interface';
import prisma from '../../config/prisma';

export class PrismaExpenseRepository implements IExpenseRepository {
  async create(data: {
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
  }): Promise<Expense & { splits: ExpenseSplit[] }> {
    const { splits, ...expenseData } = data;
    return prisma.expense.create({
      data: {
        ...expenseData,
        splits: {
          create: splits.map((s) => ({
            userId: s.userId,
            shareAmount: s.shareAmount,
          })),
        },
      },
      include: { splits: true },
    });
  }

  async findById(id: number): Promise<(Expense & { paidBy: any; splits: any[] }) | null> {
    return prisma.expense.findUnique({
      where: { id },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: { include: { user: { select: { id: true, name: true } } } },
      },
    }) as any;
  }

  async findByGroup(groupId: number): Promise<any[]> {
    return prisma.expense.findMany({
      where: { groupId },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async update(
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
  ): Promise<Expense & { splits: ExpenseSplit[] }> {
    const { splits, ...expenseFields } = data;

    return prisma.$transaction(async (tx) => {
      if (splits) {
        // Clear previous splits
        await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
      }

      return tx.expense.update({
        where: { id },
        data: {
          ...expenseFields,
          ...(splits && {
            splits: {
              create: splits.map((s) => ({
                userId: s.userId,
                shareAmount: s.shareAmount,
              })),
            },
          }),
        },
        include: { splits: true },
      });
    });
  }

  async delete(id: number): Promise<void> {
    await prisma.$transaction([
      prisma.expenseSplit.deleteMany({ where: { expenseId: id } }),
      prisma.expense.delete({ where: { id } }),
    ]);
  }

  async findUserPaidExpensesInGroup(groupId: number, userId: number, joinedAt: Date, leftAt?: Date | null): Promise<any[]> {
    return prisma.expense.findMany({
      where: {
        groupId,
        paidById: userId,
        date: {
          gte: joinedAt,
          ...(leftAt ? { lt: leftAt } : {}),
        },
      },
      select: { id: true, description: true, date: true, amountInInr: true, currency: true, amount: true },
    });
  }

  async findUserSharesInGroup(groupId: number, userId: number, joinedAt: Date, leftAt?: Date | null): Promise<any[]> {
    return prisma.expenseSplit.findMany({
      where: {
        userId,
        expense: {
          groupId,
          date: {
            gte: joinedAt,
            ...(leftAt ? { lt: leftAt } : {}),
          },
        },
      },
      include: {
        expense: { select: { id: true, description: true, date: true, amountInInr: true, currency: true, amount: true } },
      },
    });
  }
}
