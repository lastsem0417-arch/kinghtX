import { z } from 'zod';

// ─── Form Schemas ────────────────────────────────────────────────────────────

export const SignupFormSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters.' })
    .max(20, { message: 'Username cannot exceed 20 characters.' })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'Username can only contain letters, numbers, and underscores.',
    })
    .trim(),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' })
    .trim(),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters.' })
    .regex(/[a-zA-Z]/, { message: 'Password must contain at least one letter.' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
    .trim(),
});

export const LoginFormSchema = z.object({
  email: z
    .string()
    .email({ message: 'Please enter a valid email address.' })
    .trim(),
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .trim(),
});

// ─── Form State Types ─────────────────────────────────────────────────────────

export type SignupFormState =
  | {
      errors?: {
        username?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
