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

// ─── Forgot/Reset Password ───────────────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  try {
    await connectToDatabase();
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return { success: false, message: 'No account found with this email address.' };
    }
    
    // Generate a secure mock reset token for local preview/development
    const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const token = `KNIGHTX-RESET-${pin}`;

    // Store secure verification details in DB
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity
    await user.save();

    console.log(`[PASSWORD RESET] Simulated email sent to ${user.email} with code: ${token}`);

    return { 
      success: true, 
      token, 
      email: user.email,
      message: 'Secure verification token generated and saved successfully.' 
    };
  } catch (err) {
    console.error('Password reset request error:', err);
    return { success: false, message: 'An error occurred. Please try again.' };
  }
}

export async function verifyResetToken(email: string, token: string) {
  try {
    await connectToDatabase();
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetToken: token.trim().toUpperCase(),
      resetTokenExpires: { $gt: new Date() }
    });
    if (!user) {
      return { success: false, message: 'Invalid or expired verification token.' };
    }
    return { success: true };
  } catch (err) {
    console.error('Verify reset token error:', err);
    return { success: false, message: 'Failed to verify token. Please try again.' };
  }
}

export async function resetPassword(email: string, password: string, token: string) {
  try {
    // Basic password validation
    if (password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long.' };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { success: false, message: 'Password must contain at least one letter and one number.' };
    }

    await connectToDatabase();
    
    // Find user with valid token
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetToken: token.trim().toUpperCase(),
      resetTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      return { success: false, message: 'Invalid or expired verification token. Please start the recovery process again.' };
    }

    // Hash new password using bcrypt
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Update user record and clear reset token
    user.passwordHash = passwordHash;
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    return { success: true, message: 'Your password has been reset successfully.' };
  } catch (err) {
    console.error('Password reset completion error:', err);
    return { success: false, message: 'Failed to reset password. Please try again.' };
  }
}

