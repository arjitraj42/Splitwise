import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../repositories/interfaces/user.repository.interface';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_signing_key_change_me_in_production';

export class AuthService {
  constructor(private userRepo: IUserRepository) {}

  async register(name: string, email: string, passwordHash: string) {
    const existingEmail = await this.userRepo.findByEmail(email);
    if (existingEmail) {
      throw new Error('Email is already registered');
    }

    const hashed = await bcrypt.hash(passwordHash, 10);
    const user = await this.userRepo.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash: hashed,
    });

    const token = this.generateToken(user.id, user.email);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async login(email: string, passwordHash: string) {
    const user = await this.userRepo.findByEmail(email.toLowerCase().trim());
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.email);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  private generateToken(userId: number, email: string): string {
    return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
  }
}
