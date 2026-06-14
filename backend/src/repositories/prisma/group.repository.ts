import { Group, GroupMembership } from '@prisma/client';
import { IGroupRepository } from '../interfaces/group.repository.interface';
import prisma from '../../config/prisma';

export class PrismaGroupRepository implements IGroupRepository {
  async findById(id: number): Promise<Group | null> {
    return prisma.group.findUnique({ where: { id } });
  }

  async findWithMembers(id: number): Promise<(Group & { memberships: any[] }) | null> {
    return prisma.group.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }

  async create(name: string): Promise<Group> {
    return prisma.group.create({ data: { name } });
  }

  async update(id: number, name: string): Promise<Group> {
    return prisma.group.update({
      where: { id },
      data: { name },
    });
  }

  async delete(id: number): Promise<void> {
    await prisma.group.delete({ where: { id } });
  }

  async addMember(groupId: number, userId: number, joinedAt: Date, leftAt?: Date | null): Promise<GroupMembership> {
    return prisma.groupMembership.create({
      data: {
        groupId,
        userId,
        joinedAt,
        leftAt,
      },
    });
  }

  async updateMemberWindow(groupId: number, userId: number, joinedAt: Date, leftAt: Date | null): Promise<GroupMembership> {
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new Error('Membership not found');
    return prisma.groupMembership.update({
      where: { id: membership.id },
      data: { joinedAt, leftAt },
    });
  }

  async getMemberships(groupId: number): Promise<any[]> {
    return prisma.groupMembership.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findMembership(groupId: number, userId: number): Promise<GroupMembership | null> {
    return prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
  }

  async findActiveGroupsForUser(userId: number): Promise<Group[]> {
    const memberships = await prisma.groupMembership.findMany({
      where: { userId, leftAt: null },
      include: { group: true },
    });
    return memberships.map((m) => m.group);
  }
}
