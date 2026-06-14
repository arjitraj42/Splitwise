import { Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { groupService } from '../config/services';

export const createGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  const userId = req.user!.id;
  const group = await groupService.createGroup(name, userId);
  res.status(201).json(group);
});

export const listGroups = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const groups = await groupService.listGroupsForUser(userId);
  res.json(groups);
});

export const getGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const groupId = Number(req.params.id);
  const details = await groupService.getGroupDetails(groupId);
  res.json(details);
});

export const updateGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const groupId = Number(req.params.id);
  const { name } = req.body;
  const updated = await groupService.updateGroup(groupId, name);
  res.json(updated);
});

export const addMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const groupId = Number(req.params.id);
  const { userId, joinedAt } = req.body;
  const jDate = joinedAt ? new Date(joinedAt) : new Date();
  const membership = await groupService.addMember(groupId, userId, jDate);
  res.status(201).json(membership);
});

export const removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const groupId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const { leftAt } = req.body;
  const lDate = leftAt ? new Date(leftAt) : new Date();
  const membership = await groupService.removeMember(groupId, userId, lDate);
  res.json(membership);
});
