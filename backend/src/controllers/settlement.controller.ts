import { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { settlementService } from '../config/services';

export const createSettlement = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { groupId, fromUserId, toUserId, amount, currency, settlementDate, note } = req.body;
  const settlement = await settlementService.createSettlement({
    groupId: Number(groupId),
    fromUserId: Number(fromUserId),
    toUserId: Number(toUserId),
    amount: Number(amount),
    currency,
    settlementDate,
    note,
  });
  res.status(201).json(settlement);
});

export const listSettlements = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const groupId = Number(req.query.groupId);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Valid query parameter groupId is required' });
  }
  const settlements = await settlementService.listSettlementsForGroup(groupId);
  res.json(settlements);
});
