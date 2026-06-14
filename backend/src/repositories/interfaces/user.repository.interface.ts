import { User } from '@prisma/client';

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByName(name: string): Promise<User | null>;
  create(data: { name: string; email: string; passwordHash: string }): Promise<User>;
  findAll(): Promise<{ id: number; name: string; email: string }[]>;
}
