import type { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'KnightX — Sign In',
  description: 'Sign in to your KnightX chess account and start playing.',
};

export default function LoginPage() {
  return <LoginForm />;
}
