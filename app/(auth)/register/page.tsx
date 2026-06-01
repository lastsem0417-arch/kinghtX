import type { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'KnightX — Create Account',
  description: 'Join KnightX and start your chess journey today.',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
