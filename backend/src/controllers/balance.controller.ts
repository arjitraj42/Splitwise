import { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { balanceService } from '../config/services';

export const groupBalances = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const groupId = Number(req.params.id);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Valid group ID parameter is required' });
  }

  const [balances, simplifiedDebts] = await Promise.all([
    balanceService.calculateGroupBalances(groupId),
    balanceService.simplifyDebts(groupId),
  ]);

  res.json({
    balances,
    simplifiedDebts,
  });
});

export const userBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.params.id);
  const groupId = Number(req.query.groupId);

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Valid user ID parameter is required' });
  }

  const explanation = await balanceService.explainUserBalance(userId, isNaN(groupId) ? undefined : groupId);
  res.json(explanation);
});

export const explainBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.params.userId);
  const groupId = Number(req.query.groupId);

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Valid user ID parameter is required' });
  }

  const explanation = await balanceService.explainUserBalance(userId, isNaN(groupId) ? undefined : groupId);
  res.json(explanation);
});
