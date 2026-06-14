import { Router } from 'express';
import authRoutes from './auth.routes';
import groupRoutes from './group.routes';
import expenseRoutes from './expense.routes';
import settlementRoutes from './settlement.routes';
import balanceRoutes from './balance.routes';
import importRoutes from './import.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/groups', groupRoutes);
router.use('/expenses', expenseRoutes);
router.use('/settlements', settlementRoutes);
router.use('/balances', balanceRoutes);
router.use('/imports', importRoutes);

export default router;
export { router };
