'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { LoginFormState } from '@/lib/definitions';
import Link from 'next/link';

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(
    login,
    undefined
  );

  return (
    <div className="w-full">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[#81b64c] text-4xl">♞</span>
          <span className="text-white text-3xl font-black tracking-tight">
            Knight<span className="text-[#81b64c]">X</span>
          </span>
        </div>
        <p className="text-[#7a7a6e] text-sm">Welcome back, champion</p>
      </div>

      {/* Card */}
      <div className="bg-[#1a1917] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
        {/* Global error */}
        {state?.message && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {state.message}
          </div>
        )}

        <form action={action} className="space-y-5">
          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-[#a0a09a] uppercase tracking-wider mb-2"
            >
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className="
                w-full px-4 py-3 rounded-lg
                bg-[#111010] border border-white/[0.08]
                text-white placeholder-[#4a4a44] text-sm
                focus:outline-none focus:border-[#81b64c]/50 focus:ring-1 focus:ring-[#81b64c]/30
                transition-all duration-200
              "
            />
            {state?.errors?.email && (
              <p className="mt-1.5 text-xs text-red-400">
                {state.errors.email[0]}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#a0a09a] uppercase tracking-wider"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#81b64c] hover:text-[#90c957] transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              className="
                w-full px-4 py-3 rounded-lg
                bg-[#111010] border border-white/[0.08]
                text-white placeholder-[#4a4a44] text-sm
                focus:outline-none focus:border-[#81b64c]/50 focus:ring-1 focus:ring-[#81b64c]/30
                transition-all duration-200
              "
            />
            {state?.errors?.password && (
              <p className="mt-1.5 text-xs text-red-400">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={pending}
            className="
              w-full py-3.5 rounded-lg
              bg-[#81b64c] hover:bg-[#90c957]
              text-[#0f0e0c] font-bold text-sm tracking-wide
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              active:scale-[0.98]
              shadow-[0_0_20px_rgba(129,182,76,0.2)]
              hover:shadow-[0_0_25px_rgba(129,182,76,0.35)]
            "
          >
            {pending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-75" />
                </svg>
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="px-3 text-xs text-[#4a4a44]">or</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Play as guest */}
        <Link
          href="/game"
          className="
            block w-full py-3 rounded-lg text-center
            border border-white/[0.08] hover:border-white/[0.15]
            text-[#a0a09a] hover:text-white text-sm font-medium
            transition-all duration-200 hover:bg-white/[0.03]
          "
        >
          ♟ Play as Guest
        </Link>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-[#7a7a6e]">
          New to KnightX?{' '}
          <Link
            href="/register"
            className="text-[#81b64c] hover:text-[#90c957] font-semibold transition-colors"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
