import { Router } from 'express';
import { groupBalances, userBalance, explainBalance } from '../controllers/balance.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate as any);

router.get('/group/:id', groupBalances);
router.get('/user/:id', userBalance);
router.get('/explain/:userId', explainBalance);

export default router;
