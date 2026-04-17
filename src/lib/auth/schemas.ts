import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().max(200).optional(),
});

export const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordBodySchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const patchMeBodySchema = z
  .object({
    full_name: z.string().max(200).optional(),
    email: z.string().email().optional(),
  })
  .refine((b) => b.full_name !== undefined || b.email !== undefined, {
    message: 'At least one of full_name or email is required',
  });
