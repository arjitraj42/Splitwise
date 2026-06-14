import { Settlement } from '@prisma/client';

export interface ISettlementRepository {
  create(data: {
    groupId: number;
    fromUserId: number;
    toUserId: number;
    amount: number;
    currency: string;
    exchangeRate: number;
    normalizedAmountInInr: number;
    settlementDate: Date;
    note?: string;
  }): Promise<Settlement>;

  findByGroup(groupId: number): Promise<any[]>;
  findUserSentInGroup(groupId: number, userId: number): Promise<Settlement[]>;
  findUserReceivedInGroup(groupId: number, userId: number): Promise<Settlement[]>;
}
