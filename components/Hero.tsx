"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface HeroProps {
  isLoggedIn: boolean;
}

export default function Hero({ isLoggedIn }: HeroProps) {
  return (
    <section className="flex flex-col items-center justify-center text-center min-h-[75vh] px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#81b64c]/5 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="text-6xl md:text-8xl font-black leading-tight tracking-tight bg-gradient-to-b from-white via-white to-gray-500 bg-clip-text text-transparent"
      >
        MASTER CHESS
        <br />
        WITH <span className="text-[#81b64c] drop-shadow-[0_0_25px_rgba(129,182,76,0.25)]">AI</span>
      </motion.h1>
 
      <motion.p
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 1 }}
        className="max-w-xl mt-6 text-[#a0a09a] text-sm md:text-base leading-relaxed font-medium"
      >
        Play against customized computer bots, train with live voice coaches, analyze moves with depth engine reviews, and climb leaderboards on the ultimate chess arena.
      </motion.p>
 
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-4 mt-10 w-full sm:w-auto z-10"
      >
        <Link
          href={isLoggedIn ? "/dashboard" : "/register"}
          className="
            px-10 py-4.5 rounded-2xl bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-sm tracking-wide text-center
            shadow-[0_0_20px_rgba(129,182,76,0.25)] hover:shadow-[0_0_25px_rgba(129,182,76,0.45)]
            transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
          "
        >
          ♟ Play Now
        </Link>
 
        <a
          href="#features"
          className="
            px-10 py-4.5 rounded-2xl border border-white/[0.08] hover:bg-white/5 text-white font-extrabold text-sm tracking-wide text-center
            transition-all duration-200 active:scale-[0.98]
          "
        >
          Learn More
        </a>
      </motion.div>
    </section>
  );
}