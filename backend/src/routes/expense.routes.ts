import { Router } from 'express';
import { createExpense, listExpenses, getExpense, updateExpense, deleteExpense } from '../controllers/expense.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { CreateExpenseSchema } from '../validators/schemas';

const router = Router();

router.use(authenticate as any);

router.post('/', validateRequest(CreateExpenseSchema), createExpense);
router.get('/', listExpenses);
router.get('/:id', getExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
