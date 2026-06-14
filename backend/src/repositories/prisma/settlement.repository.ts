import { Settlement } from '@prisma/client';
import { ISettlementRepository } from '../interfaces/settlement.repository.interface';
import prisma from '../../config/prisma';

export class PrismaSettlementRepository implements ISettlementRepository {
  async create(data: {
    groupId: number;
    fromUserId: number;
    toUserId: number;
    amount: number;
    currency: string;
    exchangeRate: number;
    normalizedAmountInInr: number;
    settlementDate: Date;
    note?: string;
  }): Promise<Settlement> {
    return prisma.settlement.create({ data });
  }

  async findByGroup(groupId: number): Promise<any[]> {
    return prisma.settlement.findMany({
      where: { groupId },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
      orderBy: { settlementDate: 'desc' },
    });
  }

  async findUserSentInGroup(groupId: number, userId: number): Promise<Settlement[]> {
    return prisma.settlement.findMany({
      where: { groupId, fromUserId: userId },
      include: {
        toUser: { select: { name: true } },
      },
      orderBy: { settlementDate: 'asc' },
    });
  }

  async findUserReceivedInGroup(groupId: number, userId: number): Promise<Settlement[]> {
    return prisma.settlement.findMany({
      where: { groupId, toUserId: userId },
      include: {
        fromUser: { select: { name: true } },
      },
      orderBy: { settlementDate: 'asc' },
    });
  }
}
