'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestPasswordReset, resetPassword, verifyResetToken } from '@/app/actions/auth';
import { ArrowLeft, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'verify' | 'reset' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [generatedToken, setGeneratedToken] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    const res = await requestPasswordReset(email);
    setLoading(false);

    if (res.success && res.token) {
      setGeneratedToken(res.token);
      setStep('verify');
    } else {
      setErrorMsg(res.message || 'Something went wrong.');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredCode) {
      setErrorMsg('Please enter the verification code.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    const res = await verifyResetToken(email, enteredCode);
    setLoading(false);

    if (res.success) {
      setStep('reset');
    } else {
      setErrorMsg(res.message || 'Invalid or expired verification code.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMsg('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    const res = await resetPassword(email, newPassword, enteredCode);
    setLoading(false);

    if (res.success) {
      setStep('success');
    } else {
      setErrorMsg(res.message || 'Reset failed. Please try again.');
    }
  };

  return (
    <div className="w-full">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[#81b64c] text-4xl">♞</span>
          <span className="text-white text-3xl font-black tracking-tight">
            Knight<span className="text-[#81b64c]">X</span>
          </span>
        </div>
        <p className="text-[#7a7a6e] text-sm">Account Recovery Portal</p>
      </div>

      {/* Main Card */}
      <div className="bg-[#1a1917] border border-white/[0.08] rounded-2xl p-8 shadow-2xl space-y-6">
        
        {/* Error message banner */}
        {errorMsg && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 animate-fadeIn">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Input Email */}
        {step === 'email' && (
          <form onSubmit={handleRequestToken} className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-white">Reset Password</h2>
              <p className="text-xs text-[#a0a09a] leading-relaxed">
                Enter your email address. We will verify your account and provide a recovery token to reset your password.
              </p>
            </div>

            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-semibold text-[#a0a09a] uppercase tracking-wider mb-2"
              >
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="
                  w-full px-4 py-3 rounded-lg
                  bg-[#111010] border border-white/[0.08]
                  text-white placeholder-[#4a4a44] text-sm
                  focus:outline-none focus:border-[#81b64c]/50 focus:ring-1 focus:ring-[#81b64c]/30
                  transition-all duration-200
                "
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3.5 rounded-lg
                bg-[#81b64c] hover:bg-[#90c957]
                text-[#0f0e0c] font-bold text-sm tracking-wide
                transition-all duration-200 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-[0_0_20px_rgba(129,182,76,0.2)]
              "
            >
              {loading ? 'Verifying Account…' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 2: Verification Code Screen */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[#81b64c] font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 fill-current" />
                <span>Token Sent</span>
              </div>
              <h2 className="text-lg font-extrabold text-white">Enter Recovery Code</h2>
              <p className="text-xs text-[#a0a09a] leading-relaxed">
                A verification token has been simulated to your registered email address. Copy and paste it here:
              </p>
            </div>

            {/* Simulated Email Box */}
            <div className="bg-[#111010] border border-[#81b64c]/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                <span className="text-[10px] text-[#7a7a6e] font-mono">From: accounts@knightx.com</span>
                <span className="bg-[#81b64c]/10 text-[#81b64c] text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full">Simulated Email</span>
              </div>
              <div className="text-xs font-semibold text-white leading-relaxed">
                Your secure KnightX reset code is:
              </div>
              <div className="bg-black/40 border border-white/[0.04] font-mono font-bold tracking-widest text-[#81b64c] text-center py-2.5 rounded-lg select-all">
                {generatedToken}
              </div>
            </div>

            <div>
              <label
                htmlFor="verification-token"
                className="block text-xs font-semibold text-[#a0a09a] uppercase tracking-wider mb-2"
              >
                Verification Code
              </label>
              <input
                id="verification-token"
                type="text"
                required
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                placeholder="Paste code here"
                className="
                  w-full px-4 py-3 rounded-lg font-mono text-center tracking-wider
                  bg-[#111010] border border-white/[0.08]
                  text-white placeholder-[#4a4a44] text-sm
                  focus:outline-none focus:border-[#81b64c]/50 focus:ring-1 focus:ring-[#81b64c]/30
                  transition-all duration-200
                "
              />
            </div>

            <button
              type="submit"
              className="
                w-full py-3.5 rounded-lg
                bg-[#81b64c] hover:bg-[#90c957]
                text-[#0f0e0c] font-bold text-sm tracking-wide
                transition-all duration-200 active:scale-[0.98]
              "
            >
              Verify Code
            </button>
          </form>
        )}

        {/* Step 3: Enter New Password */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-white">Create New Password</h2>
              <p className="text-xs text-[#a0a09a]">
                Please enter a secure password containing at least 8 characters, a letter, and a number.
              </p>
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-[#a0a09a] uppercase tracking-wider mb-2"
              >
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 letter, 1 number"
                className="
                  w-full px-4 py-3 rounded-lg
                  bg-[#111010] border border-white/[0.08]
                  text-white placeholder-[#4a4a44] text-sm
                  focus:outline-none focus:border-[#81b64c]/50
                  transition-all duration-200
                "
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-[#a0a09a] uppercase tracking-wider mb-2"
              >
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="
                  w-full px-4 py-3 rounded-lg
                  bg-[#111010] border border-white/[0.08]
                  text-white placeholder-[#4a4a44] text-sm
                  focus:outline-none focus:border-[#81b64c]/50
                  transition-all duration-200
                "
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="
                w-full py-3.5 rounded-lg
                bg-[#81b64c] hover:bg-[#90c957]
                text-[#0f0e0c] font-bold text-sm tracking-wide
                transition-all duration-200 active:scale-[0.98]
                disabled:opacity-50
              "
            >
              {loading ? 'Saving Password…' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* Step 4: Success Message Screen */}
        {step === 'success' && (
          <div className="text-center space-y-6 py-4 animate-scaleUp">
            <div className="h-16 w-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto text-green-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-white">Password Updated!</h2>
              <p className="text-xs text-[#a0a09a] max-w-sm mx-auto leading-relaxed">
                Your password has been successfully reset. You can now log into your KnightX account using your new credentials.
              </p>
            </div>

            <Link
              href="/login"
              className="
                block w-full py-3.5 rounded-lg
                bg-[#81b64c] hover:bg-[#90c957]
                text-[#0f0e0c] font-bold text-sm tracking-wide
                transition-all duration-200 text-center
              "
            >
              Sign In Now
            </Link>
          </div>
        )}

        {/* Card Footer (Go back to login) */}
        {step !== 'success' && (
          <div className="border-t border-white/[0.04] pt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-[#7a7a6e] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
