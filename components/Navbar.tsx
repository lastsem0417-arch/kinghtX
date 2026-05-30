"use client";

import { Button } from "@/components/ui/button";

export default function Navbar() {
  return (
    <nav className="w-full flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur-md">
      <h1 className="text-3xl font-bold tracking-wide">
        KNIGHT<span className="text-green-400">X</span>
      </h1>

      <div className="flex gap-4">
        <Button variant="outline">Login</Button>
        <Button className="bg-green-500 hover:bg-green-600 text-black font-bold">
          Play Now
        </Button>
      </div>
    </nav>
  );
}