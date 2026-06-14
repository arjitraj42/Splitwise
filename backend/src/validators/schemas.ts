import { z } from 'zod';

export const RegisterSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const LoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const CreateGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Group name must be at least 2 characters'),
  }),
});

export const AddMemberSchema = z.object({
  body: z.object({
    userId: z.number().int().positive('User ID must be a positive integer'),
    joinedAt: z.string().datetime({ message: 'joinedAt must be a valid ISO timestamp' }).optional(),
  }),
});

export const RemoveMemberSchema = z.object({
  body: z.object({
    leftAt: z.string().datetime({ message: 'leftAt must be a valid ISO timestamp' }).optional(),
  }),
});

export const CreateExpenseSchema = z.object({
  body: z.object({
    paidById: z.number().int().positive('paidById must be a positive integer'),
    amount: z.number().positive('Amount must be a positive number'),
    currency: z.enum(['INR', 'USD']).default('INR'),
    description: z.string().min(1, 'Description is required'),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date string',
    }),
    splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']),
    splitData: z.object({
      userIds: z.array(z.number().int().positive()).optional(),
      splits: z
        .array(
          z.object({
            userId: z.number().int().positive(),
            amount: z.number().optional(),
            percentage: z.number().optional(),
            shares: z.number().optional(),
          })
        )
        .optional(),
    }),
  }),
});

export const CreateSettlementSchema = z.object({
  body: z.object({
    fromUserId: z.number().int().positive('Sender ID is required'),
    toUserId: z.number().int().positive('Receiver ID is required'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['INR', 'USD']).default('INR'),
    settlementDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid settlement date',
    }),
    note: z.string().optional(),
  }),
});
