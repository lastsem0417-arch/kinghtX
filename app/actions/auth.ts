'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import { createSession, deleteSession } from '@/lib/session';
import {
  SignupFormSchema,
  LoginFormSchema,
  SignupFormState,
  LoginFormState,
} from '@/lib/definitions';
import User from '@/models/User';

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export async function signup(
  state: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  // 1. Validate fields
  const validated = SignupFormSchema.safeParse({
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { username, email, password } = validated.data;

  await connectToDatabase();

  // 2. Check for existing user
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      return { message: 'An account with this email already exists.' };
    }
    return { message: 'This username is already taken.' };
  }

  // 3. Hash password and create user
  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await User.create({
    username,
    email,
    passwordHash,
  });

  if (!newUser) {
    return { message: 'Something went wrong. Please try again.' };
  }

  // 4. Create session
  await createSession({
    userId: newUser._id.toString(),
    username: newUser.username,
    email: newUser.email,
  });

  // 5. Redirect to dashboard
  redirect('/dashboard');
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(
  state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  // 1. Validate fields
  const validated = LoginFormSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  await connectToDatabase();

  // 2. Find user
  const user = await User.findOne({ email });

  if (!user) {
    return { message: 'Invalid email or password.' };
  }

  // 3. Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    return { message: 'Invalid email or password.' };
  }

  // 4. Update lastSeen
  await User.findByIdAndUpdate(user._id, { lastSeen: new Date() });

  // 5. Create session
  await createSession({
    userId: user._id.toString(),
    username: user.username,
    email: user.email,
  });

  // 6. Redirect to dashboard
  redirect('/dashboard');
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
