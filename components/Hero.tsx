"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center min-h-[80vh] px-6">
      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="text-6xl md:text-8xl font-extrabold leading-tight"
      >
        MASTER CHESS
        <br />
        WITH <span className="text-green-400">AI</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 1 }}
        className="max-w-2xl mt-6 text-gray-400 text-lg"
      >
        Play, learn, analyze, and improve with the most premium
        AI-powered chess platform ever built.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-4 mt-10"
      >
        <Button className="bg-green-500 hover:bg-green-600 text-lg px-8 py-6 text-black font-bold rounded-2xl">
          Play Now
        </Button>

        <Button
          variant="outline"
          className="text-lg px-8 py-6 rounded-2xl"
        >
          Learn More
        </Button>
      </motion.div>
    </section>
  );
}