import type { Metadata } from 'next';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'KnightX — Forgot Password',
  description: 'Reset your KnightX chess account password.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
