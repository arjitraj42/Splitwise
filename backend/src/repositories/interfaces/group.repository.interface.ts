import { Group, GroupMembership } from '@prisma/client';

export interface IGroupRepository {
  findById(id: number): Promise<Group | null>;
  findWithMembers(id: number): Promise<(Group & { memberships: any[] }) | null>;
  create(name: string): Promise<Group>;
  update(id: number, name: string): Promise<Group>;
  delete(id: number): Promise<void>;
  addMember(groupId: number, userId: number, joinedAt: Date, leftAt?: Date | null): Promise<GroupMembership>;
  updateMemberWindow(groupId: number, userId: number, joinedAt: Date, leftAt: Date | null): Promise<GroupMembership>;
  getMemberships(groupId: number): Promise<any[]>;
  findMembership(groupId: number, userId: number): Promise<GroupMembership | null>;
  findActiveGroupsForUser(userId: number): Promise<Group[]>;
}
