import { Router } from 'express';
import { createSettlement, listSettlements } from '../controllers/settlement.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { CreateSettlementSchema } from '../validators/schemas';

const router = Router();

router.use(authenticate as any);

router.post('/', validateRequest(CreateSettlementSchema), createSettlement);
router.get('/', listSettlements);

export default router;
