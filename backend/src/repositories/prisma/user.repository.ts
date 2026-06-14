import { User } from '@prisma/client';
import { IUserRepository } from '../interfaces/user.repository.interface';
import prisma from '../../config/prisma';

export class PrismaUserRepository implements IUserRepository {
  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByName(name: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    return prisma.user.create({ data });
  }

  async findAll(): Promise<{ id: number; name: string; email: string }[]> {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
