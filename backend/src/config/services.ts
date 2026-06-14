import { PrismaUserRepository } from '../repositories/prisma/user.repository';
import { PrismaGroupRepository } from '../repositories/prisma/group.repository';
import { PrismaExpenseRepository } from '../repositories/prisma/expense.repository';
import { PrismaSettlementRepository } from '../repositories/prisma/settlement.repository';
import { PrismaImportRepository } from '../repositories/prisma/import.repository';

import { AuthService } from '../services/auth.service';
import { GroupService } from '../services/group.service';
import { ExpenseService } from '../services/expense.service';
import { SettlementService } from '../services/settlement.service';
import { BalanceService } from '../services/balance.service';
import { ImportService } from '../services/import.service';

// Instantiate Repositories
const userRepository = new PrismaUserRepository();
const groupRepository = new PrismaGroupRepository();
const expenseRepository = new PrismaExpenseRepository();
const settlementRepository = new PrismaSettlementRepository();
const importRepository = new PrismaImportRepository();

// Instantiate Services
export const authService = new AuthService(userRepository);
export const groupService = new GroupService(groupRepository, userRepository);
export const expenseService = new ExpenseService(expenseRepository, groupRepository);
export const settlementService = new SettlementService(settlementRepository, groupRepository);
export const balanceService = new BalanceService(groupRepository, expenseRepository, settlementRepository);
export const importService = new ImportService(
  importRepository,
  groupRepository,
  userRepository,
  expenseRepository,
  settlementRepository
);
export { userRepository, groupRepository, expenseRepository, settlementRepository, importRepository };
