import { IGroupRepository } from '../repositories/interfaces/group.repository.interface';
import { IExpenseRepository } from '../repositories/interfaces/expense.repository.interface';
import { ISettlementRepository } from '../repositories/interfaces/settlement.repository.interface';

export interface UserBalance {
  user: { id: number; name: string; email: string };
  joinedAt: Date;
  leftAt: Date | null;
  netBalance: number;
  totalPaid: number;
  totalOwed: number;
  totalSent: number;
  totalReceived: number;
  breakdown: {
    paidExpenses: any[];
    splitRows: any[];
    sentPayments: any[];
    receivedPayments: any[];
  };
}

export interface SimplifiedSettlement {
  fromUser: { id: number; name: string };
  toUser: { id: number; name: string };
  amount: number;
}

export class BalanceService {
  constructor(
    private groupRepo: IGroupRepository,
    private expenseRepo: IExpenseRepository,
    private settlementRepo: ISettlementRepository
  ) {}

  /**
   * Calculate group balances for all members, respecting historical membership windows.
   */
  async calculateGroupBalances(groupId: number): Promise<UserBalance[]> {
    const memberships = await this.groupRepo.getMemberships(groupId);

    const balances = await Promise.all(
      memberships.map((m) => this.calculateUserBalanceInGroup(groupId, m.userId, m.joinedAt, m.leftAt, m.user))
    );

    return balances;
  }

  /**
   * Calculate single user balance details within a group.
   */
  async calculateUserBalanceInGroup(
    groupId: number,
    userId: number,
    joinedAt: Date,
    leftAt: Date | null,
    userDetail: { id: number; name: string; email: string }
  ): Promise<UserBalance> {
    // 1. Fetch expenses paid by the user within their active membership window
    const paidExpenses = await this.expenseRepo.findUserPaidExpensesInGroup(groupId, userId, joinedAt, leftAt);
    const totalPaid = paidExpenses.reduce((s, e) => s + Number(e.amountInInr), 0);

    // 2. Fetch splits (debts) owed by this user within their active membership window
    const splitRows = await this.expenseRepo.findUserSharesInGroup(groupId, userId, joinedAt, leftAt);
    const totalOwed = splitRows.reduce((s, r) => s + Number(r.shareAmount), 0);

    // 3. Fetch settlements sent by the user (settlements can happen anytime, but are stored in group context)
    const sentPayments = await this.settlementRepo.findUserSentInGroup(groupId, userId);
    const totalSent = sentPayments.reduce((s, p) => s + Number(p.normalizedAmountInInr), 0);

    // 4. Fetch settlements received by the user
    const receivedPayments = await this.settlementRepo.findUserReceivedInGroup(groupId, userId);
    const totalReceived = receivedPayments.reduce((s, p) => s + Number(p.normalizedAmountInInr), 0);

    // netBalance = paid - owed + sent - received
    const netBalance = totalPaid - totalOwed + totalSent - totalReceived;

    return {
      user: userDetail,
      joinedAt,
      leftAt,
      netBalance: Math.round(netBalance * 100) / 100, // round to nearest paisa
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOwed: Math.round(totalOwed * 100) / 100,
      totalSent: Math.round(totalSent * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      breakdown: {
        paidExpenses,
        splitRows: splitRows.map((r) => ({
          id: r.id,
          shareAmount: Number(r.shareAmount),
          expense: r.expense,
        })),
        sentPayments: sentPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          currency: p.currency,
          normalizedAmountInInr: Number(p.normalizedAmountInInr),
          settlementDate: p.settlementDate,
          toUser: (p as any).toUser,
        })),
        receivedPayments: receivedPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          currency: p.currency,
          normalizedAmountInInr: Number(p.normalizedAmountInInr),
          settlementDate: p.settlementDate,
          fromUser: (p as any).fromUser,
        })),
      },
    };
  }

  /**
   * Explain a user's balance across all groups or a specific group.
   */
  async explainUserBalance(userId: number, groupId?: number): Promise<any> {
    let activeMemberships: any[] = [];

    if (groupId) {
      const membership = await this.groupRepo.findMembership(groupId, userId);
      if (membership) {
        const group = await this.groupRepo.findById(groupId);
        activeMemberships.push({
          groupId,
          groupName: group?.name || 'Group',
          joinedAt: membership.joinedAt,
          leftAt: membership.leftAt,
        });
      }
    } else {
      // Fetch all memberships for user
      const groups = await this.groupRepo.findActiveGroupsForUser(userId);
      for (const g of groups) {
        const m = await this.groupRepo.findMembership(g.id, userId);
        if (m) {
          activeMemberships.push({
            groupId: g.id,
            groupName: g.name,
            joinedAt: m.joinedAt,
            leftAt: m.leftAt,
          });
        }
      }
    }

    const explanations = await Promise.all(
      activeMemberships.map(async (m) => {
        const bal = await this.calculateUserBalanceInGroup(m.groupId, userId, m.joinedAt, m.leftAt, {} as any);
        return {
          groupId: m.groupId,
          groupName: m.groupName,
          joinedAt: m.joinedAt,
          leftAt: m.leftAt,
          netBalance: bal.netBalance,
          totalPaid: bal.totalPaid,
          totalOwed: bal.totalOwed,
          totalSent: bal.totalSent,
          totalReceived: bal.totalReceived,
          breakdown: bal.breakdown,
        };
      })
    );

    const totalBalance = explanations.reduce((s, e) => s + e.netBalance, 0);

    return {
      userId,
      totalBalance: Math.round(totalBalance * 100) / 100,
      groups: explanations,
    };
  }

  /**
   * Run the debt simplification algorithm on a group.
   * Minimal settlements = who pays whom and how much.
   */
  async simplifyDebts(groupId: number): Promise<SimplifiedSettlement[]> {
    const balances = await this.calculateGroupBalances(groupId);

    // Separate into debtors (net balance < 0) and creditors (net balance > 0)
    // We filter out people who are already settled (balance very close to zero)
    const debtors = balances
      .filter((b) => b.netBalance < -0.01)
      .map((b) => ({
        user: b.user,
        amount: Math.abs(b.netBalance),
      }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = balances
      .filter((b) => b.netBalance > 0.01)
      .map((b) => ({
        user: b.user,
        amount: b.netBalance,
      }))
      .sort((a, b) => b.amount - a.amount);

    const settlements: SimplifiedSettlement[] = [];

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const transferAmount = Math.min(debtor.amount, creditor.amount);

      // Record optimized settlement
      settlements.push({
        fromUser: { id: debtor.user.id, name: debtor.user.name },
        toUser: { id: creditor.user.id, name: creditor.user.name },
        amount: Math.round(transferAmount * 100) / 100,
      });

      debtor.amount -= transferAmount;
      creditor.amount -= transferAmount;

      if (debtor.amount < 0.01) {
        dIdx++;
      }
      if (creditor.amount < 0.01) {
        cIdx++;
      }
    }

    return settlements;
  }
}
