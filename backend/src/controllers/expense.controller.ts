import { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { expenseService } from '../config/services';

export const createExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { groupId, paidById, amount, currency, description, date, splitType, splitData } = req.body;
  const expense = await expenseService.createExpense({
    groupId: Number(groupId),
    paidById: Number(paidById),
    amount: Number(amount),
    currency,
    description,
    date,
    splitType,
    splitData,
  });
  res.status(201).json(expense);
});

export const listExpenses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const groupId = Number(req.query.groupId);
  if (isNaN(groupId)) {
    return res.status(400).json({ error: 'Valid query parameter groupId is required' });
  }
  const expenses = await expenseService.listExpensesForGroup(groupId);
  res.json(expenses);
});

export const getExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const expenseId = Number(req.params.id);
  const expense = await expenseService.getExpenseDetails(expenseId);
  res.json(expense);
});

export const updateExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const expenseId = Number(req.params.id);
  const updated = await expenseService.updateExpense(expenseId, req.body);
  res.json(updated);
});

export const deleteExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const expenseId = Number(req.params.id);
  await expenseService.deleteExpense(expenseId);
  res.status(204).send();
});
