import { Router } from 'express';
import { createGroup, listGroups, getGroup, updateGroup, addMember, removeMember } from '../controllers/group.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { CreateGroupSchema, AddMemberSchema, RemoveMemberSchema } from '../validators/schemas';

const router = Router();

router.use(authenticate as any);

router.post('/', validateRequest(CreateGroupSchema), createGroup);
router.get('/', listGroups);
router.get('/:id', getGroup);
router.put('/:id', validateRequest(CreateGroupSchema), updateGroup);

// Member management
router.post('/:id/members', validateRequest(AddMemberSchema), addMember);
router.delete('/:id/members/:userId', validateRequest(RemoveMemberSchema), removeMember);

export default router;
