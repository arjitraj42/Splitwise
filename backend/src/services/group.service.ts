import { IGroupRepository } from '../repositories/interfaces/group.repository.interface';
import { IUserRepository } from '../repositories/interfaces/user.repository.interface';

export class GroupService {
  constructor(private groupRepo: IGroupRepository, private userRepo: IUserRepository) {}

  async createGroup(name: string, creatorUserId: number) {
    const user = await this.userRepo.findById(creatorUserId);
    if (!user) throw new Error('Creator user not found');

    const group = await this.groupRepo.create(name);
    // Auto-add creator as active member starting now
    await this.groupRepo.addMember(group.id, creatorUserId, new Date(), null);
    return group;
  }

  async updateGroup(id: number, name: string) {
    const group = await this.groupRepo.findById(id);
    if (!group) throw new Error('Group not found');
    return this.groupRepo.update(id, name);
  }

  async getGroupDetails(id: number) {
    const details = await this.groupRepo.findWithMembers(id);
    if (!details) throw new Error('Group not found');
    return details;
  }

  async addMember(groupId: number, userId: number, joinedAt: Date = new Date()) {
    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new Error('Group not found');

    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const existing = await this.groupRepo.findMembership(groupId, userId);
    if (existing) {
      if (existing.leftAt !== null) {
        // Re-join the group: update joinedAt and clear leftAt
        return this.groupRepo.updateMemberWindow(groupId, userId, joinedAt, null);
      }
      throw new Error('User is already a member of this group');
    }

    return this.groupRepo.addMember(groupId, userId, joinedAt, null);
  }

  async removeMember(groupId: number, userId: number, leftAt: Date = new Date()) {
    const membership = await this.groupRepo.findMembership(groupId, userId);
    if (!membership) throw new Error('User is not a member of this group');
    if (membership.leftAt !== null) throw new Error('User has already left this group');

    if (leftAt <= membership.joinedAt) {
      throw new Error('Leave date must be after join date');
    }

    return this.groupRepo.updateMemberWindow(groupId, userId, membership.joinedAt, leftAt);
  }

  async listGroupsForUser(userId: number) {
    return this.groupRepo.findActiveGroupsForUser(userId);
  }
}
