"use client";

import Link from "next/link";

interface NavbarProps {
  isLoggedIn: boolean;
  username?: string;
}

export default function Navbar({ isLoggedIn, username }: NavbarProps) {
  return (
    <nav className="w-full flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/[0.06] backdrop-blur-md bg-[#161412]/80 sticky top-0 z-50">
      <Link href={isLoggedIn ? "/dashboard" : "/"} className="text-2xl font-black tracking-wider hover:opacity-95 transition-all select-none">
        KNIGHT<span className="text-[#81b64c]">X</span>
      </Link>

      <div className="flex gap-4 items-center">
        {isLoggedIn ? (
          <>
            <span className="text-[11px] font-extrabold text-[#7a7a6e] font-mono">@{username}</span>
            <Link
              href="/dashboard"
              className="
                px-5 py-2.5 rounded-xl bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs
                transition-all shadow-[0_0_15px_rgba(129,182,76,0.25)] hover:shadow-[0_0_20px_rgba(129,182,76,0.4)]
              "
            >
              Go to Dashboard
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="
                px-5 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/5 text-[#a0a09a] hover:text-white font-extrabold text-xs
                transition-all
              "
            >
              Login
            </Link>
            <Link
              href="/register"
              className="
                px-5 py-2.5 rounded-xl bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs
                transition-all shadow-[0_0_15px_rgba(129,182,76,0.25)] hover:shadow-[0_0_20px_rgba(129,182,76,0.4)]
              "
            >
              Play Now
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}