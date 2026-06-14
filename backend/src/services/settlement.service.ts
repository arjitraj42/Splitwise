import { ISettlementRepository } from '../repositories/interfaces/settlement.repository.interface';
import { IGroupRepository } from '../repositories/interfaces/group.repository.interface';
import { getExchangeRate } from './currency.service';

export class SettlementService {
  constructor(
    private settlementRepo: ISettlementRepository,
    private groupRepo: IGroupRepository
  ) {}

  async createSettlement(data: {
    groupId: number;
    fromUserId: number;
    toUserId: number;
    amount: number;
    currency: string;
    settlementDate: Date | string;
    note?: string;
  }) {
    const group = await this.groupRepo.findById(data.groupId);
    if (!group) throw new Error('Group not found');

    const currency = (data.currency || 'INR').trim().toUpperCase();
    const sDate = new Date(data.settlementDate);

    // Validate memberships
    const fromMembership = await this.groupRepo.findMembership(data.groupId, data.fromUserId);
    const toMembership = await this.groupRepo.findMembership(data.groupId, data.toUserId);

    if (!fromMembership || !toMembership) {
      throw new Error('Both sender and receiver must be members of the group');
    }

    // Convert currency to INR
    let exchangeRate = 1.0;
    let normalizedAmountInInr = Number(data.amount);

    if (currency !== 'INR') {
      exchangeRate = await getExchangeRate(currency, 'INR', sDate);
      normalizedAmountInInr = Number(data.amount) * exchangeRate;
    }

    return this.settlementRepo.create({
      groupId: data.groupId,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      amount: data.amount,
      currency,
      exchangeRate,
      normalizedAmountInInr,
      settlementDate: sDate,
      note: data.note,
    });
  }

  async listSettlementsForGroup(groupId: number) {
    return this.settlementRepo.findByGroup(groupId);
  }
}
