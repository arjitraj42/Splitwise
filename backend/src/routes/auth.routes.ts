import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { RegisterSchema, LoginSchema } from '../validators/schemas';

const router = Router();

router.post('/register', validateRequest(RegisterSchema), register);
router.post('/login', validateRequest(LoginSchema), login);

export default router;
